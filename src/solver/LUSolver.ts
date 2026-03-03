// ============================================================
// LU Decomposition with Partial Pivoting
// Solves Ax = b for dense matrices (n typically 2–10 for circuits)
//
// Algorithm: Doolittle's method + row permutation for stability
// Complexity: O(n³) — negligible for small circuit matrices
// ============================================================

export interface LUResult {
  L: number[][]    // Lower triangular (unit diagonal)
  U: number[][]    // Upper triangular
  P: number[]      // Permutation vector: P[i] = original row for row i
  singular: boolean
}

const SINGULARITY_THRESHOLD = 1e-14

/**
 * LU decompose matrix A with partial pivoting.
 * Returns L, U, P such that P*A = L*U
 */
export function luDecompose(A: number[][]): LUResult {
  const n = A.length
  // Deep copy A into U — we modify in place
  const U = A.map(row => [...row])
  const L = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 1.0 : 0.0))
  )
  const P = Array.from({ length: n }, (_, i) => i)

  for (let k = 0; k < n; k++) {
    // ── Partial pivoting: find max |U[i][k]| for i >= k ───
    let pivotVal = Math.abs(U[k][k])
    let pivotRow = k
    for (let i = k + 1; i < n; i++) {
      if (Math.abs(U[i][k]) > pivotVal) {
        pivotVal = Math.abs(U[i][k])
        pivotRow = i
      }
    }

    if (pivotVal < SINGULARITY_THRESHOLD) {
      // Nearly singular — add tiny regularization to diagonal
      U[k][k] += SINGULARITY_THRESHOLD
    }

    // ── Swap rows k and pivotRow in U, L (partial cols), P ─
    if (pivotRow !== k) {
      ;[U[k], U[pivotRow]] = [U[pivotRow], U[k]]
      ;[P[k], P[pivotRow]] = [P[pivotRow], P[k]]
      // Only swap already-computed L columns (j < k)
      for (let j = 0; j < k; j++) {
        ;[L[k][j], L[pivotRow][j]] = [L[pivotRow][j], L[k][j]]
      }
    }

    // ── Elimination ─────────────────────────────────────────
    for (let i = k + 1; i < n; i++) {
      const factor = U[i][k] / U[k][k]
      L[i][k] = factor
      for (let j = k; j < n; j++) {
        U[i][j] -= factor * U[k][j]
      }
    }
  }

  return { L, U, P, singular: false }
}

/**
 * Solve Ax = b using LU decomposition.
 * Runs luDecompose internally — call this directly for one-off solves.
 */
export function luSolve(A: number[][], b: number[]): number[] {
  const n = A.length
  const { L, U, P } = luDecompose(A)

  // Apply permutation to b: pb[i] = b[P[i]]
  const pb = P.map(i => b[i])

  // ── Forward substitution: solve Ly = pb ─────────────────
  const y = new Array<number>(n).fill(0)
  for (let i = 0; i < n; i++) {
    y[i] = pb[i]
    for (let j = 0; j < i; j++) {
      y[i] -= L[i][j] * y[j]
    }
    // L has unit diagonal — no division needed
  }

  // ── Backward substitution: solve Ux = y ─────────────────
  const x = new Array<number>(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = y[i]
    for (let j = i + 1; j < n; j++) {
      x[i] -= U[i][j] * x[j]
    }
    if (Math.abs(U[i][i]) < SINGULARITY_THRESHOLD) {
      x[i] = 0   // guard: singular pivot → zero solution
    } else {
      x[i] /= U[i][i]
    }
  }

  return x
}

/**
 * Euclidean norm of a vector — used for convergence checks.
 */
export function vecNorm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0))
}

/**
 * Max-norm (infinity norm) — faster convergence check in NR.
 */
export function vecMaxNorm(v: number[]): number {
  return v.reduce((max, x) => Math.max(max, Math.abs(x)), 0)
}
