import { CircuitComponent, createComponentState } from './Component'

export interface Capacitor extends CircuitComponent {
  type: 'capacitor'
  capacitance: number    // Farads
  initialVoltage: number // Starting charge voltage
  chargePercent: number  // 0–1, drives glow intensity
}

export function createCapacitor(
  id: string,
  nodeA: string,
  nodeB: string,
  capacitance: number,
  initialVoltage: number
): Capacitor {
  return {
    id,
    type: 'capacitor',
    nodeA,
    nodeB,
    value: capacitance,
    capacitance,
    initialVoltage,
    chargePercent: 1.0,
    state: { ...createComponentState(), voltage: initialVoltage },
  }
}
