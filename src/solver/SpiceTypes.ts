// ============================================================
// SPICE Types — full circuit description and result types
// ============================================================

// Node 0 is always ground (reference, V=0)
// Non-ground nodes are numbered 1..nodeCount

export type ElementType = 'R' | 'C' | 'L' | 'V' | 'I' | 'D'

export interface SPICEElementState {
  voltage: number      // V across element (nodeP minus nodeN)
  current: number      // A through element (into nodeP)
  power: number        // W  (I²R or V*I)
  temperature: number  // °C (thermal model)
}

// ── Base element ────────────────────────────────────────────
export interface SPICEElement {
  id: string
  type: ElementType
  nodeP: number        // + terminal node index (0 = ground)
  nodeN: number        // − terminal node index (0 = ground)
  value: number        // R(Ω), C(F), L(H), V(V), I(A)
  state: SPICEElementState
}

// ── Resistor (linear, optional temperature coefficient) ─────
export interface SPICEResistor extends SPICEElement {
  type: 'R'
  tc1: number          // first-order temperature coefficient (1/°C)
  tc2: number          // second-order temperature coefficient (1/°C²)
  tempNominal: number  // nominal temperature (°C)
  ratedPower: number   // W — overheat threshold
}

// ── Capacitor (non-linear in transient via companion model) ─
export interface SPICECapacitor extends SPICEElement {
  type: 'C'
  initialVoltage: number  // V at t=0
  prevVoltage: number     // V at previous time step (for companion model)
  ratedVoltage: number    // V — overvoltage threshold
}

// ── Diode (non-linear — requires Newton-Raphson) ────────────
export interface SPICEDiode extends SPICEElement {
  type: 'D'
  Is: number     // saturation current (A), ~1e-12
  Vt: number     // thermal voltage (V), ~0.02585 at 25°C (kT/q)
  n: number      // ideality factor (1–2)
  Vbreak: number // reverse breakdown voltage (V)
}

// ── Ideal voltage source ────────────────────────────────────
export interface SPICEVoltageSource extends SPICEElement {
  type: 'V'
  branchIndex: number  // row/column index in the extended MNA matrix
}

// ── Current source ──────────────────────────────────────────
export interface SPICECurrentSource extends SPICEElement {
  type: 'I'
}

// ── Circuit description ─────────────────────────────────────
export interface SPICECircuit {
  nodeCount: number            // non-ground nodes (matrix size = nodeCount + vSourceCount)
  vSourceCount: number         // voltage sources (expand matrix)
  elements: SPICEElement[]
  initialVoltages: number[]    // [V_node1, V_node2, ...] indexed 0..nodeCount-1

  // Safety thresholds (trigger events when exceeded)
  thresholds: {
    maxVoltage: number         // V — arc flash trigger
    maxCurrent: number         // A — overcurrent trigger
    maxPower: number           // W — overheat trigger
    dischargeVoltage: number   // V — "safe" level (discharge complete)
  }
}

// ── Solver output ───────────────────────────────────────────
export interface TransientResult {
  time: number
  nodeVoltages: number[]               // V[0] = ground(0), V[1..n] = node voltages
  branchCurrents: Record<string, number>
  elementPower: Record<string, number>
  converged: boolean
  iterations: number
  dt: number                           // actual time step used
  events: SPICEEvent[]
}

// ── Events fired during simulation ──────────────────────────
export type SPICEEventType =
  | 'arc_flash'
  | 'overvoltage'
  | 'overcurrent'
  | 'overheat'
  | 'discharge_complete'
  | 'convergence_failure'
  | 'nr_step'             // debug: each NR iteration

export interface SPICEEvent {
  type: SPICEEventType
  elementId?: string
  nodeId?: number
  value: number
  time: number
  message: string
}

// ── Visualization output (what the 3D scene reads) ──────────
export interface VisualizationState {
  // Per-node
  nodeGlowIntensity: number[]   // 0..1 (normalized to rated voltage)

  // Derived
  capacitorChargeRatio: number  // 0..1  (V_cap / V_initial)
  currentMagnitude: number      // A  (drives particle flow rate)
  powerDissipation: number      // W  (drives heat shader)
  arcIntensity: number          // 0..1 (arc flash visual)
  isDischargeComplete: boolean

  // SPICE convergence quality
  lastIterationCount: number
  isConverged: boolean
}
