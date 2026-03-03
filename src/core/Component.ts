// Abstract base for all circuit components
export type ComponentType = 'capacitor' | 'resistor' | 'voltageSource' | 'inductor' | 'bulb' | 'wire'

export interface CircuitComponent {
  id: string
  type: ComponentType
  nodeA: string   // positive terminal node ID
  nodeB: string   // negative terminal node ID
  value: number   // Farads / Ohms / Volts / Henrys
  state: ComponentState
}

export interface ComponentState {
  voltage: number   // Volts across component
  current: number   // Amps through component
  temperature: number // °C (for heat shader)
  isConnected: boolean
}

export function createComponentState(): ComponentState {
  return { voltage: 0, current: 0, temperature: 25, isConnected: false }
}
