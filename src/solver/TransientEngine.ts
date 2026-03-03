// ============================================================
// TransientEngine — adaptive time-stepping wrapper over MNASolver
//
// Per-frame flow:
//   wallDt  → simBudget = wallDt * timeScale
//   inner loop: try currentDt, halve on NR failure, grow on fast convergence
//   after each accepted step → updateStates (advances cap.prevVoltage, temp)
//   emits RepairEvents (voltage, current, arcs, discharge-complete)
//   returns TransientState (backward-compat with LinearSolver consumers)
// ============================================================

import { MNASolver } from './MNASolver'
import { repairEvents } from '../events/RepairEvents'
import type {
  SPICECircuit,
  SPICECapacitor,
  SPICEResistor,
  VisualizationState,
  SPICEEvent,
} from './SpiceTypes'

export type DischargeMethod = 'screwdriver' | 'resistor' | 'bulb' | 'tool'

// What repairStore and LabScene consume — backward-compatible with LinearSolver.SolverState
export interface TransientState {
  simTime:    number
  voltage:    number            // capacitor node voltage
  current:    number            // total current magnitude
  power:      number            // total power dissipation
  isComplete: boolean
  converged:  boolean
  iterations: number
  vizState:   VisualizationState
}

// ── Adaptive time-stepping config ────────────────────────────
const MAX_STEPS_PER_TICK = 50
const MAX_HALVE_ATTEMPTS  = 6
const DT_GROW_FACTOR      = 1.5
const DT_SHRINK_FACTOR    = 0.5
const FAST_ITER_THRESH    = 5      // grow dt when NR converges in ≤ this many iters

// ── Per-method circuit configuration ─────────────────────────
interface MethodCfg {
  R: number; C: number; V0: number
  ratedPower: number
  timeScale: number   // wallDt * timeScale = simulation time advanced per frame
}

// Industrial PSU scenario: 450V 1000µF capacitor
// Discharge complete threshold: < 1.0V (safe to handle)
const METHOD_CFG: Record<DischargeMethod, MethodCfg> = {
  // R = 10 mΩ → catastrophic arc flash at 450V (45kA peak) — educational danger only
  screwdriver: { R: 0.01,   C: 0.001, V0: 450, ratedPower: 999999, timeScale: 1e-4 },
  // R = 33 kΩ bleeder → τ = 33s; standard HV bleeder for 450V PSU
  resistor:    { R: 33000,  C: 0.001, V0: 450, ratedPower: 6.1,    timeScale: 1.0   },
  // R = 4 kΩ bulb → τ = 4s at 450V (high-wattage lamp load)
  bulb:        { R: 4000,   C: 0.001, V0: 450, ratedPower: 50,     timeScale: 1.0   },
  // R = 1 kΩ HV probe → τ = 1s; professional discharge probe, rated for HV
  tool:        { R: 1000,   C: 0.001, V0: 450, ratedPower: 202.5,  timeScale: 1.0   },
}

// ── Build SPICECircuit for a given method ─────────────────────
function buildCircuit(cfg: MethodCfg): SPICECircuit {
  const cap: SPICECapacitor = {
    id: 'C1', type: 'C',
    nodeP: 1, nodeN: 0,
    value: cfg.C,
    initialVoltage: cfg.V0,
    prevVoltage: cfg.V0,
    ratedVoltage: 50,
    state: { voltage: cfg.V0, current: 0, power: 0, temperature: 25 },
  }

  const res: SPICEResistor = {
    id: 'R1', type: 'R',
    nodeP: 1, nodeN: 0,
    value: cfg.R,
    tc1: 0.004,       // 0.4%/°C (copper-like)
    tc2: 0,
    tempNominal: 25,
    ratedPower: cfg.ratedPower,
    state: { voltage: 0, current: 0, power: 0, temperature: 25 },
  }

  // Overcurrent threshold: generous headroom for shorts (screwdriver method)
  const maxCurrent = cfg.R < 1 ? 10000 : (cfg.V0 / cfg.R) * 5

  return {
    nodeCount: 1,
    vSourceCount: 0,
    elements: [cap, res],
    initialVoltages: [cfg.V0],
    thresholds: {
      maxVoltage:       600,                // 450V nominal, some headroom
      maxCurrent,
      maxPower:         cfg.ratedPower * 3,
      dischargeVoltage: 1.0,   // "safe" when node 1 < 1.0V (IEC standard for HV caps)
    },
  }
}

function initialVizState(V0: number): VisualizationState {
  return {
    nodeGlowIntensity:  [1],
    capacitorChargeRatio: 1,
    currentMagnitude:   0,
    powerDissipation:   0,
    arcIntensity:       0,
    isDischargeComplete: false,
    lastIterationCount: 0,
    isConverged:        true,
  }
}

// ── TransientEngine ───────────────────────────────────────────
export class TransientEngine {
  private solver:    MNASolver
  private circuit:   SPICECircuit
  private V:         number[]        // current node voltage vector
  private simTime  = 0
  private currentDt: number         // adaptive step size (simulation seconds)
  private timeScale: number
  private tau:       number          // RC time constant
  private complete = false
  private dischargeEmitted = false   // fire onDischargeComplete only once
  private warnedKeys = new Set<string>()  // deduplicate safety events per session
  private lastViz: VisualizationState

  constructor(method: DischargeMethod) {
    const cfg    = METHOD_CFG[method]
    this.circuit = buildCircuit(cfg)
    this.solver  = new MNASolver(this.circuit)
    this.V       = [...this.circuit.initialVoltages]
    this.tau     = cfg.R * cfg.C
    this.timeScale  = cfg.timeScale
    this.currentDt  = this.tau / 100        // seed dt at τ/100
    this.lastViz    = initialVizState(cfg.V0)
  }

  // ── Called every animation frame with the wall-clock delta ──
  tick(wallDt: number): TransientState {
    if (this.complete) return this.snapshot()

    const simBudget   = wallDt * this.timeScale
    let   remaining   = simBudget
    let   steps       = 0
    let   lastIter    = 0
    let   lastConvgd  = true
    const allEvents: SPICEEvent[] = []

    while (remaining > 1e-16 && steps < MAX_STEPS_PER_TICK && !this.complete) {
      // Candidate dt: never overshoot remaining budget
      let tryDt   = Math.min(this.currentDt, remaining)
      let accepted = false

      for (let attempt = 0; attempt < MAX_HALVE_ATTEMPTS; attempt++) {
        const result = this.solver.solveStep(this.V, tryDt)

        if (result.converged) {
          // ── Accept this NR step ──────────────────────────────
          this.V       = result.V
          this.simTime += tryDt
          remaining    -= tryDt
          lastIter      = result.iterations
          lastConvgd    = true

          // updateStates advances cap.prevVoltage + resistor temperature
          const { events, vizState } = this.solver.updateStates(this.V, tryDt)
          this.lastViz = vizState
          allEvents.push(...events)

          // Grow dt on fast convergence — capped at one frame's budget
          if (result.iterations <= FAST_ITER_THRESH) {
            this.currentDt = Math.min(this.currentDt * DT_GROW_FACTOR, simBudget)
          }
          // Never shrink below τ/10 000
          this.currentDt = Math.max(this.currentDt, this.tau / 10000)

          if (vizState.isDischargeComplete) this.complete = true
          accepted = true
          break
        }

        // ── NR failed → halve dt and retry ──────────────────────
        tryDt      *= DT_SHRINK_FACTOR
        lastConvgd  = false
      }

      if (!accepted) {
        // All halving attempts exhausted — skip remainder of this budget
        lastConvgd = false
        remaining  = 0
      }

      steps++
    }

    // Stamp convergence metadata onto the last viz state
    this.lastViz = {
      ...this.lastViz,
      lastIterationCount: lastIter,
      isConverged:        lastConvgd,
      isDischargeComplete: this.complete,
    }

    this.processEvents(allEvents)
    return this.snapshot()
  }

  // ── Emit RepairEvents from collected SPICE events ─────────────
  private processEvents(events: SPICEEvent[]) {
    for (const ev of events) {
      switch (ev.type) {
        case 'discharge_complete':
          if (!this.dischargeEmitted) {
            this.dischargeEmitted = true
            repairEvents.emit('onDischargeComplete', {})
          }
          break

        case 'arc_flash':
        case 'overvoltage': {
          const key = `${ev.type}:${ev.elementId ?? 'node'}`
          if (!this.warnedKeys.has(key)) {
            this.warnedKeys.add(key)
            repairEvents.emit('onSafetyViolation', {
              reason: ev.message,
              severity: 'critical',
            })
          }
          break
        }

        case 'overcurrent':
        case 'overheat': {
          const key = `${ev.type}:${ev.elementId ?? ''}`
          if (!this.warnedKeys.has(key)) {
            this.warnedKeys.add(key)
            repairEvents.emit('onSafetyViolation', {
              reason: ev.message,
              severity: 'warning',
            })
          }
          break
        }
      }
    }

    // Emit observable physics state every tick (coaching engine listens)
    repairEvents.emit('onVoltageChanged', { voltage: this.V[0] ?? 0 })
    repairEvents.emit('onCurrentChanged', { current: this.lastViz.currentMagnitude })
  }

  // ── Build return value from current engine state ──────────────
  private snapshot(): TransientState {
    return {
      simTime:    this.simTime,
      voltage:    this.V[0] ?? 0,
      current:    this.lastViz.currentMagnitude,
      power:      this.lastViz.powerDissipation,
      isComplete: this.complete,
      converged:  this.lastViz.isConverged,
      iterations: this.lastViz.lastIterationCount,
      vizState:   { ...this.lastViz },
    }
  }
}
