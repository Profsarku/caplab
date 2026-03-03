import { CircuitComponent, createComponentState } from './Component'

export interface Resistor extends CircuitComponent {
  type: 'resistor'
  resistance: number // Ohms
}

export function createResistor(
  id: string,
  nodeA: string,
  nodeB: string,
  resistance: number
): Resistor {
  return {
    id,
    type: 'resistor',
    nodeA,
    nodeB,
    value: resistance,
    resistance,
    state: createComponentState(),
  }
}
