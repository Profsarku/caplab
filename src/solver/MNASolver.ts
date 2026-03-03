// ============================================================
// MNA Solver — Newton-Raphson iteration over the full MNA system
//
// Algorithm per time step:
//   1. Set initial guess V^(0) = V from previous time step
//   2. Build linearized MNA matrix G^(k) and RHS b^(k) at V^(k)
//      - Linear elements: exact stamps (same every iteration)
//      - Non-linear (diodes): linearized about V^(k)  [G_eq, I_eq]
//      - Capacitors: companion model (Geq = C/dt, Ieq = Geq * Vprev)
//   3. Solve:  G^(k) * ΔV = b^(k) - G^(k) * V^(k)
//      Equivalently: G^(k) * V^(k+1) = b^(k)
//   4. Update: V^(k+1) = solution
//   5. Check convergence: ||V^(k+1) - V^(k)|| < VNTOL + RELTOL * ||V^(k+1)||
//   6. Repeat from 2 until converged or max iterations
// ============================================================

import { luSolve, vecMaxNorm } from './LUSolver'
import {
  stampResistor,
  stampResistorThermal,
  stampCapacitor,
  stampDiode,
  stampVoltageSource,
  stampCurrentSource,
} from './ElementStamps'
import type {
  SPICECircuit,
  SPICEElement,
  SPICECapacitor,
  SPICEResistor,
  SPICEDiode,
  SPICEVoltageSource,
  SPICECurrentSource,
  TransientResult,
  SPICEEvent,
  VisualizationState,
} from './SpiceTypes'

// SPICE-standard convergence tolerances
const VNTOL   = 1e-6    // V  — absolute voltage tolerance
const RELTOL  = 1e-3    // —  — relative tolerance
const ABSTOL  = 1e-12   // A  — absolute current tolerance
const MAX_NR_ITER = 150

export class MNASolver {
  private matSize: number   // nNodes + nVSources

  constructor(private circuit: SPICECircuit) {
    this.matSize = circuit.nodeCount + circuit.vSourceCount
  }

  // ── Build linearized MNA matrix at current voltage guess V ──
  private buildMatrix(
    V: number[],  // current guess [V_node1, ..., V_nodeN, J_0, ...]
    dt: number
  ): { G: number[][]; b: number[] } {
    const sz = this.matSize
    const G = Array.from({ length: sz }, () => new Array<number>(sz).fill(0))
    const b = new Array<number>(sz).fill(0)

    for (const elem of this.circuit.elements) {
      // Voltage across this element at current operating point
      const Vp = elem.nodeP !== 0 ? V[elem.nodeP - 1] : 0
      const Vn = elem.nodeN !== 0 ? V[elem.nodeN - 1] : 0
      const Vd = Vp - Vn

      switch (elem.type) {
        case 'R': {
          const r = elem as SPICEResistor
          // Temperature-dependent resistance
          stampResistorThermal(
            G,
            elem.nodeP, elem.nodeN,
            elem.value,
            r.tc1 ?? 0,
            r.tc2 ?? 0,
            r.state.temperature,
            r.tempNominal ?? 25
          )
          break
        }

        case 'C': {
          const cap = elem as SPICECapacitor
          stampCapacitor(G, b, elem.nodeP, elem.nodeN, elem.value, dt, cap.prevVoltage)
          break
        }

        case 'D': {
          const diode = elem as SPICEDiode
          stampDiode(G, b, elem.nodeP, elem.nodeN, Vd, diode.Is, diode.Vt, diode.n)
          break
        }

        case 'V': {
          const vs = elem as SPICEVoltageSource
          stampVoltageSource(G, b, elem.nodeP, elem.nodeN, vs.branchIndex, elem.value, this.circuit.nodeCount)
          break
        }

        case 'I': {
          stampCurrentSource(b, elem.nodeP, elem.nodeN, elem.value)
          break
        }
      }
    }

    return { G, b }
  }

  // ── Newton-Raphson iteration for one time step ───────────────
  solveStep(Vprev: number[], dt: number): {
    V: number[]
    converged: boolean
    iterations: number
    residual: number
  } {
    // Initial guess = previous solution (warm start)
    let V = [...Vprev]

    for (let iter = 0; iter < MAX_NR_ITER; iter++) {
      const { G, b } = this.buildMatrix(V, dt)

      // Solve G * V_new = b
      const V_new = luSolve(G, b)

      // Convergence check: max |V_new[i] - V[i]| < VNTOL + RELTOL * |V_new[i]|
      const dV = V_new.map((v, i) => v - V[i])
      const residual = vecMaxNorm(dV)
      const maxV = vecMaxNorm(V_new)
      const threshold = VNTOL + RELTOL * maxV

      V = V_new

      if (residual < threshold) {
        return { V, converged: true, iterations: iter + 1, residual }
      }
    }

    // Did not converge in MAX_NR_ITER iterations
    return { V, converged: false, iterations: MAX_NR_ITER, residual: Infinity }
  }

  // ── Update element states from solution vector ────────────────
  updateStates(V: number[], dt: number): {
    branchCurrents: Record<string, number>
    elementPower: Record<string, number>
    events: SPICEEvent[]
    vizState: VisualizationState
  } {
    const branchCurrents: Record<string, number> = {}
    const elementPower: Record<string, number> = {}
    const events: SPICEEvent[] = []
    const { thresholds } = this.circuit

    let capacitorChargeRatio = 1
    let totalCurrent = 0
    let totalPower = 0

    for (const elem of this.circuit.elements) {
      const Vp = elem.nodeP !== 0 ? V[elem.nodeP - 1] : 0
      const Vn = elem.nodeN !== 0 ? V[elem.nodeN - 1] : 0
      const Vd = Vp - Vn

      let current = 0
      let power = 0

      switch (elem.type) {
        case 'R': {
          const r = elem as SPICEResistor
          const dT = r.state.temperature - (r.tempNominal ?? 25)
          const Reff = elem.value * (1 + (r.tc1 ?? 0) * dT)
          current = Vd / Reff
          power = current * current * Reff
          // Thermal model: dT/dt = P/thermal_mass - (T-T_amb)/R_thermal
          r.state.temperature += (power * 50 - (r.state.temperature - 25) * 0.5) * dt
          // Overheat event
          if (power > (r.ratedPower ?? Infinity)) {
            events.push({
              type: 'overheat', elementId: elem.id,
              value: power, time: 0,
              message: `${elem.id} overheating: ${power.toFixed(2)}W exceeds rated ${r.ratedPower}W`,
            })
          }
          break
        }

        case 'C': {
          const cap = elem as SPICECapacitor
          const Geq = elem.value / dt
          current = Geq * (Vd - cap.prevVoltage)
          power = Math.abs(current * Vd)
          cap.prevVoltage = Vd
          // Capacitor charge ratio (0=discharged, 1=full)
          const initV = (cap.initialVoltage ?? thresholds.maxVoltage) || 1
          capacitorChargeRatio = Math.max(0, Math.abs(Vd) / initV)
          // Overvoltage
          if (Math.abs(Vd) > (cap.ratedVoltage ?? thresholds.maxVoltage)) {
            events.push({
              type: 'overvoltage', elementId: elem.id, nodeId: elem.nodeP,
              value: Math.abs(Vd), time: 0,
              message: `Overvoltage on ${elem.id}: ${Vd.toFixed(2)}V`,
            })
          }
          // Voltage reversal → arc
          if (Vd < -1 && cap.prevVoltage >= 0) {
            events.push({
              type: 'arc_flash', elementId: elem.id,
              value: Math.abs(Vd), time: 0,
              message: 'Capacitor voltage reversal — arc flash risk!',
            })
          }
          break
        }

        case 'D': {
          const diode = elem as SPICEDiode
          const Vd_clamped = Math.max(-40 * diode.n * diode.Vt, Math.min(Vd, 40 * diode.n * diode.Vt))
          current = diode.Is * (Math.exp(Vd_clamped / (diode.n * diode.Vt)) - 1)
          power = current * Vd
          // Reverse breakdown
          if (Vd < -diode.Vbreak) {
            events.push({
              type: 'arc_flash', elementId: elem.id,
              value: Math.abs(Vd), time: 0,
              message: `Diode breakdown at ${Vd.toFixed(2)}V`,
            })
          }
          break
        }

        case 'V': {
          const vs = elem as SPICEVoltageSource
          const J = V[this.circuit.nodeCount + vs.branchIndex]
          current = J ?? 0
          power = Math.abs(current * Vd)
          break
        }
      }

      elem.state.voltage = Vd
      elem.state.current = current
      elem.state.power = power
      branchCurrents[elem.id] = current
      elementPower[elem.id] = power

      if (elem.type !== 'V' && elem.type !== 'C') {
        totalCurrent += Math.abs(current)
        totalPower += power
      }

      // Overcurrent check
      if (Math.abs(current) > thresholds.maxCurrent) {
        events.push({
          type: 'overcurrent', elementId: elem.id,
          value: Math.abs(current), time: 0,
          message: `Overcurrent through ${elem.id}: ${(current * 1000).toFixed(1)}mA`,
        })
      }
    }

    // Discharge complete
    const capNode1 = V[0] ?? 0
    const isComplete = Math.abs(capNode1) <= thresholds.dischargeVoltage
    if (isComplete) {
      events.push({
        type: 'discharge_complete', value: capNode1, time: 0,
        message: `Discharge complete. Node 1 voltage: ${capNode1.toFixed(3)}V`,
      })
    }

    // Arc intensity: normalized current vs max
    const arcIntensity = Math.min(totalCurrent / thresholds.maxCurrent, 1)

    const vizState: VisualizationState = {
      nodeGlowIntensity: V.slice(0, this.circuit.nodeCount).map(v =>
        Math.min(Math.abs(v) / Math.max(thresholds.maxVoltage, 1), 1)
      ),
      capacitorChargeRatio,
      currentMagnitude: totalCurrent,
      powerDissipation: totalPower,
      arcIntensity,
      isDischargeComplete: isComplete,
      lastIterationCount: 0,    // filled in by TransientEngine
      isConverged: true,
    }

    return { branchCurrents, elementPower, events, vizState }
  }
}
