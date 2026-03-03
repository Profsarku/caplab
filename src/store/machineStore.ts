// Central state machine store — drives every gate in the lab
import { create } from 'zustand'
import { LabState, transition, isAtLeast } from '../state-machine/LabStateMachine'
import type { LabAction, ErrorInfo, MachineContext } from '../state-machine/LabStateMachine'
import { repairEvents } from '../events/RepairEvents'

export interface MachineStore {
  // State
  machineState: LabState
  prevState: LabState
  errorInfo: ErrorInfo | null
  context: MachineContext

  // Derived flags (convenient selectors)
  isPowerSafe: boolean
  canGrabTools: boolean
  canConnectTerminals: boolean

  // Actions
  dispatch: (action: LabAction) => boolean  // returns false if blocked
  setPowerConnected: (on: boolean) => void
  setPpeConfirmed: (confirmed: boolean) => void
  setMeasuredVoltage: (v: number) => void
  setSelectedTool: (toolId: string | null) => void
  acknowledgeError: () => void
  reset: () => void
}

const DEFAULT_CONTEXT: MachineContext = {
  selectedTool: null,
  measuredVoltage: 24,
  isPowerConnected: true,   // Starts with power ON — must disconnect first
  ppeConfirmed: false,
}

export const useMachineStore = create<MachineStore>((set, get) => ({
  machineState: LabState.IDLE,
  prevState: LabState.IDLE,
  errorInfo: null,
  context: { ...DEFAULT_CONTEXT },
  isPowerSafe: false,
  canGrabTools: false,
  canConnectTerminals: false,

  dispatch: (action) => {
    const { machineState, context } = get()
    const result = transition(machineState, action, context)

    if (result.error) {
      set({
        prevState: machineState,
        machineState: result.nextState,
        errorInfo: result.error,
      })
      repairEvents.emit('onSafetyViolation', {
        code: result.error.code,
        message: result.error.message,
        severity: result.error.severity,
      })
      return false
    }

    // Successful transition
    set(s => ({
      prevState: s.machineState,
      machineState: result.nextState,
      errorInfo: null,
      isPowerSafe: !context.isPowerConnected,
      canGrabTools: isAtLeast(result.nextState, LabState.TOOL_READY) && !context.isPowerConnected,
      canConnectTerminals:
        result.nextState === LabState.TOOL_GRABBED ||
        result.nextState === LabState.TERMINAL_A,
    }))

    // Auto-trigger events on key transitions
    if (result.nextState === LabState.BOTH_CONNECTED) {
      repairEvents.emit('onToolConnected', {})
    }
    if (result.nextState === LabState.COMPLETE) {
      repairEvents.emit('onDischargeComplete', {})
    }

    return true
  },

  setPowerConnected: (on) => {
    set(s => ({
      context: { ...s.context, isPowerConnected: on },
      isPowerSafe: !on,
    }))
  },

  setPpeConfirmed: (confirmed) => {
    set(s => ({ context: { ...s.context, ppeConfirmed: confirmed } }))
  },

  setMeasuredVoltage: (v) => {
    set(s => ({ context: { ...s.context, measuredVoltage: v } }))
  },

  setSelectedTool: (toolId) => {
    set(s => ({ context: { ...s.context, selectedTool: toolId } }))
  },

  acknowledgeError: () => {
    const { context } = get()
    set(s => ({
      machineState: context.isPowerConnected ? LabState.POWER_ON : LabState.POWER_OFF,
      prevState: s.machineState,
      errorInfo: null,
      canGrabTools: false,
    }))
  },

  reset: () => {
    set({
      machineState: LabState.IDLE,
      prevState: LabState.IDLE,
      errorInfo: null,
      context: { ...DEFAULT_CONTEXT },
      isPowerSafe: false,
      canGrabTools: false,
      canConnectTerminals: false,
    })
  },
}))
