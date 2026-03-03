// RepairManager as Zustand store — central controller
import { create } from 'zustand'
import { repairEvents } from '../events/RepairEvents'
import { TransientEngine } from '../solver/TransientEngine'
import type { TransientState, DischargeMethod } from '../solver/TransientEngine'

export type { DischargeMethod }

export type ToolId = 'screwdriver' | 'resistor_10k' | 'resistor_1k' | 'bulb_60w' | 'discharge_tool'

export interface RepairState {
  // Scene state
  method: DischargeMethod
  selectedTool: ToolId | null
  isToolConnected: boolean
  isDischarging: boolean
  isComplete: boolean

  // Solver (TransientEngine replaces LinearSolver)
  engine: TransientEngine | null
  solverState: TransientState | null
  elapsed: number

  // Tutorial
  currentStep: number
  totalSteps: number
  safetyViolation: string | null

  // Actions
  setMethod: (method: DischargeMethod) => void
  selectTool: (tool: ToolId) => void
  connectTool: (terminalA: string, terminalB: string) => void
  disconnectTool: () => void
  startDischarge: () => void
  tickSolver: (dt: number) => void
  nextStep: () => void
  prevStep: () => void
  reset: () => void
}

// Industrial PSU scenario: 450V 1000µF capacitor
// Screwdriver is ALWAYS unsafe at this voltage (would cause 45kA arc flash)
const V0_PER_METHOD: Record<DischargeMethod, number> = {
  screwdriver: 450,
  resistor:    450,
  bulb:        450,
  tool:        450,
}

const STEPS_PER_METHOD: Record<DischargeMethod, number> = {
  screwdriver: 5,
  resistor:    7,
  bulb:        6,
  tool:        5,
}

export const useRepairStore = create<RepairState>((set, get) => ({
  method: 'tool',   // default: discharge probe (correct tool for 450V HV)
  selectedTool: null,
  isToolConnected: false,
  isDischarging: false,
  isComplete: false,
  engine: null,
  solverState: null,
  elapsed: 0,
  currentStep: 0,
  totalSteps: 7,
  safetyViolation: null,

  setMethod: (method) => {
    set({
      method,
      totalSteps: STEPS_PER_METHOD[method],
      currentStep: 0,
      isDischarging: false,
      isComplete: false,
      isToolConnected: false,
      selectedTool: null,
      engine: null,
      solverState: null,
      elapsed: 0,
      safetyViolation: null,
    })
  },

  selectTool: (tool) => {
    // Screwdriver is always unsafe at 450V — near-short creates 45kA arc flash
    if (tool === 'screwdriver') {
      set({ safetyViolation: 'Screwdriver UNSAFE at 450V — use a rated discharge probe!' })
      repairEvents.emit('onSafetyViolation', { reason: 'Screwdriver creates 45kA arc flash at 450V' })
      return
    }
    set({ selectedTool: tool, safetyViolation: null })
  },

  connectTool: (_terminalA, _terminalB) => {
    const { method, selectedTool } = get()
    if (!selectedTool) return
    const engine = new TransientEngine(method)
    set({ isToolConnected: true, engine, elapsed: 0 })
    repairEvents.emit('onToolConnected', { tool: selectedTool })
  },

  disconnectTool: () => {
    set({ isToolConnected: false })
    repairEvents.emit('onToolDisconnected', {})
  },

  startDischarge: () => {
    const { isToolConnected, engine } = get()
    if (!isToolConnected || !engine) return
    set({ isDischarging: true })
  },

  tickSolver: (dt) => {
    const { engine, elapsed, isDischarging } = get()
    if (!engine || !isDischarging) return

    const state = engine.tick(dt)
    set({ elapsed: elapsed + dt, solverState: state })

    // TransientEngine.tick() emits voltage/current/discharge events internally
    if (state.isComplete && !get().isComplete) {
      set({ isComplete: true, isDischarging: false })
    }
  },

  nextStep: () => {
    const { currentStep, totalSteps } = get()
    if (currentStep < totalSteps - 1) {
      const next = currentStep + 1
      set({ currentStep: next })
      repairEvents.emit('onStepComplete', { step: currentStep })
    }
  },

  prevStep: () => {
    const { currentStep } = get()
    if (currentStep > 0) set({ currentStep: currentStep - 1 })
  },

  reset: () => {
    const { method } = get()
    get().setMethod(method)
  },
}))
