// ============================================================
// MNA Element Stamps
//
// Each element modifies the conductance matrix G and RHS b.
// Node indices: 0 = ground (excluded from matrix).
// Matrix index for node n = n - 1  (since node 0 is ground).
//
// MNA structure:
//   [G   B] [V]   [I]
//   [C_t D] [J] = [E]
//
//   G = n×n  conductance (nodal)
//   B = n×m  voltage-source node incidence (+1/-1)
//   C_t = m×n (transpose of B)
//   D = m×m  (zeros for ideal sources)
//   V = node voltages (unknowns)
//   J = branch currents through voltage sources (unknowns)
//   I = external current injections
//   E = voltage source values
// ============================================================

// Shorthand: add to matrix position if node is non-ground
function addG(G: number[][], i: number, j: number, val: number) {
  if (i !== 0 && j !== 0) G[i - 1][j - 1] += val
}

function addI(Iv: number[], i: number, val: number) {
  if (i !== 0) Iv[i - 1] += val
}

// ── Resistor (linear) ────────────────────────────────────────
// Conductance stamp: g = 1/R
//   G[p][p] += g,  G[n][n] += g
//   G[p][n] -= g,  G[n][p] -= g
export function stampResistor(
  G: number[][],
  nodeP: number,
  nodeN: number,
  R: number
) {
  const g = 1 / Math.max(R, 1e-12)   // prevent divide-by-zero
  addG(G, nodeP, nodeP, +g)
  addG(G, nodeN, nodeN, +g)
  addG(G, nodeP, nodeN, -g)
  addG(G, nodeN, nodeP, -g)
}

// ── Temperature-dependent resistor ──────────────────────────
// R(T) = R0 * (1 + tc1*(T-T0) + tc2*(T-T0)²)
export function stampResistorThermal(
  G: number[][],
  nodeP: number,
  nodeN: number,
  R0: number,
  tc1: number,
  tc2: number,
  T: number,
  T0: number
) {
  const dT = T - T0
  const R = R0 * (1 + tc1 * dT + tc2 * dT * dT)
  stampResistor(G, nodeP, nodeN, R)
  return R
}

// ── Capacitor companion model (Backward Euler) ───────────────
// C * dV/dt ≈ C/h * (V_n - V_{n-1})
// → Equivalent circuit: G_eq = C/h  in parallel with  I_eq = C/h * V_prev
//   (Norton equivalent of the differentiated capacitor)
//
//   G: add G_eq conductance stamp
//   I: inject I_eq current from nodeN to nodeP (= charging current)
export function stampCapacitor(
  G: number[][],
  Iv: number[],
  nodeP: number,
  nodeN: number,
  C: number,
  dt: number,
  Vprev: number   // voltage across capacitor at previous time step
) {
  const Geq = C / dt
  const Ieq = Geq * Vprev   // companion current source

  // Conductance stamp (same as resistor 1/Geq)
  addG(G, nodeP, nodeP, +Geq)
  addG(G, nodeN, nodeN, +Geq)
  addG(G, nodeP, nodeN, -Geq)
  addG(G, nodeN, nodeP, -Geq)

  // Current injection: positive terminal gains Ieq, negative loses it
  addI(Iv, nodeP, +Ieq)
  addI(Iv, nodeN, -Ieq)
}

// ── Diode (non-linear — Newton-Raphson linearization) ────────
// Shockley diode equation: I_D = Is * (exp(V_D / (n * Vt)) - 1)
//
// Linearized at operating point V_D0:
//   G_eq = dI_D/dV|_{V_D0} = Is/(n*Vt) * exp(V_D0/(n*Vt))
//   I_eq = I_D(V_D0) - G_eq * V_D0   ← Norton companion
//
//   Stamp: conductance G_eq + current source I_eq (nodeN→nodeP)
//
// Clamping: prevent exp overflow by limiting V_D to VMAX
export function stampDiode(
  G: number[][],
  Iv: number[],
  nodeP: number,
  nodeN: number,
  Vd: number,      // current voltage across diode (nodeP - nodeN)
  Is: number,      // saturation current (A)
  Vt: number,      // thermal voltage (V)
  n: number        // ideality factor
): { Geq: number; Id: number } {
  // Clamp to prevent overflow (typical: ±40 * n * Vt)
  const VCLAMP = 40 * n * Vt
  const Vd_clamped = Math.max(-VCLAMP, Math.min(Vd, VCLAMP))

  const expVal = Math.exp(Vd_clamped / (n * Vt))
  const Id = Is * (expVal - 1)
  const Geq = (Is / (n * Vt)) * expVal

  // Norton companion current: I_eq = Id - Geq * Vd
  const Ieq = Id - Geq * Vd_clamped

  // Conductance stamp
  addG(G, nodeP, nodeP, +Geq)
  addG(G, nodeN, nodeN, +Geq)
  addG(G, nodeP, nodeN, -Geq)
  addG(G, nodeN, nodeP, -Geq)

  // Current injection (diode current flows nodeP → nodeN internally)
  addI(Iv, nodeP, -Ieq)
  addI(Iv, nodeN, +Ieq)

  return { Geq, Id }
}

// ── Ideal Voltage Source ─────────────────────────────────────
// Adds branch current J_k as an unknown.
// Extended MNA adds rows/cols:
//   Row nodeP: +J_k
//   Row nodeN: -J_k
//   Row n+k:   V_nodeP - V_nodeN = E_k
//
// In the combined matrix (size = nNodes + nVSources):
//   B[nodeP-1][k] = +1,  B[nodeN-1][k] = -1
//   C_t[k][nodeP-1] = +1, C_t[k][nodeN-1] = -1
//   E[nNodes + k] = voltage
export function stampVoltageSource(
  Gext: number[][],   // extended matrix (nNodes+nVS) × (nNodes+nVS)
  bext: number[],     // extended RHS
  nodeP: number,
  nodeN: number,
  branchIndex: number,
  voltage: number,
  nNodes: number
) {
  const col = nNodes + branchIndex   // column for J_k
  const row = nNodes + branchIndex   // row for voltage constraint

  // B matrix block (current contribution to node KCL)
  if (nodeP !== 0) {
    Gext[nodeP - 1][col] += 1
    Gext[col][nodeP - 1] += 1
  }
  if (nodeN !== 0) {
    Gext[nodeN - 1][col] -= 1
    Gext[col][nodeN - 1] -= 1
  }

  // Voltage constraint: V_P - V_N = E
  bext[row] += voltage
}

// ── Current Source (ideal) ───────────────────────────────────
// Injects 'current' from nodeN to nodeP
export function stampCurrentSource(
  Iv: number[],
  nodeP: number,
  nodeN: number,
  current: number
) {
  addI(Iv, nodeP, +current)
  addI(Iv, nodeN, -current)
}
