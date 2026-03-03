import { CircuitComponent, createComponentState } from './Component'

export interface VoltageSource extends CircuitComponent {
  type: 'voltageSource'
  voltage: number // Volts
}

export function createVoltageSource(
  id: string,
  nodeA: string,
  nodeB: string,
  voltage: number
): VoltageSource {
  return {
    id,
    type: 'voltageSource',
    nodeA,
    nodeB,
    value: voltage,
    voltage,
    state: { ...createComponentState(), voltage, isConnected: true },
  }
}
