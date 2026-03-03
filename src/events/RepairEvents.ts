// Event bus — fired by RepairManager, consumed by AnimationSubscriber + TutorialManager

export type RepairEventType =
  | 'onVoltageChanged'
  | 'onCurrentChanged'
  | 'onDischargeComplete'
  | 'onSafetyViolation'
  | 'onToolConnected'
  | 'onToolDisconnected'
  | 'onStepComplete'

export interface RepairEvent {
  type: RepairEventType
  payload?: Record<string, unknown>
}

type Listener = (event: RepairEvent) => void

class EventBus {
  private listeners: Map<RepairEventType, Listener[]> = new Map()

  on(type: RepairEventType, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, [])
    this.listeners.get(type)!.push(listener)
  }

  off(type: RepairEventType, listener: Listener) {
    const list = this.listeners.get(type) ?? []
    this.listeners.set(type, list.filter(l => l !== listener))
  }

  emit(type: RepairEventType, payload?: Record<string, unknown>) {
    const event: RepairEvent = { type, payload }
    ;(this.listeners.get(type) ?? []).forEach(l => l(event))
  }
}

// Singleton — import repairEvents anywhere
export const repairEvents = new EventBus()
