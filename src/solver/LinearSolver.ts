// RC Discharge solver — V(t) = V₀ × e^(-t/RC)
// Stepped numerically for real-time animation

export interface SolverState {
  voltage: number     // Current capacitor voltage
  current: number     // Current through discharge path
  power: number       // P = I²R (for heat)
  timeElapsed: number // Seconds since discharge started
  isComplete: boolean // Voltage < threshold
}

const DISCHARGE_THRESHOLD = 0.5 // Volts — "safe" level

export class LinearSolver {
  private V0: number        // Initial voltage
  private R: number         // Resistance (Ohms)
  private C: number         // Capacitance (Farads)
  private tau: number       // Time constant τ = RC

  constructor(initialVoltage: number, resistance: number, capacitance: number) {
    this.V0 = initialVoltage
    this.R = resistance
    this.C = capacitance
    this.tau = resistance * capacitance
  }

  // Compute state at time t (seconds)
  solve(t: number): SolverState {
    const voltage = this.V0 * Math.exp(-t / this.tau)
    const current = voltage / this.R
    const power = current * current * this.R

    return {
      voltage,
      current,
      power,
      timeElapsed: t,
      isComplete: voltage < DISCHARGE_THRESHOLD,
    }
  }

  // Euler step — call every animation frame (dt = seconds since last frame)
  step(currentVoltage: number, dt: number): number {
    const dV = -currentVoltage / this.tau * dt
    return Math.max(0, currentVoltage + dV)
  }

  getTau(): number { return this.tau }
  getV0(): number { return this.V0 }
}
