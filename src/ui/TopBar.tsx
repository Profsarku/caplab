// TopBar — method selector + live voltage + Gemini step indicator
import { useRepairStore } from '../store/repairStore'
import type { DischargeMethod } from '../store/repairStore'
import { useMachineStore } from '../store/machineStore'
import { StateBadge } from './StateBadge'
import { LabState } from '../state-machine/LabStateMachine'
import { GEMINI_STEP } from '../data/scenario'

const METHODS: { id: DischargeMethod; label: string; icon: string; safe: boolean }[] = [
  { id: 'tool',        label: 'Discharge Probe', icon: '🔌', safe: true  },
  { id: 'resistor',    label: '33kΩ Bleeder',    icon: '🟫', safe: true  },
  { id: 'bulb',        label: 'HV Lamp',         icon: '💡', safe: true  },
  { id: 'screwdriver', label: 'Screwdriver',     icon: '🔧', safe: false },
]

const STEP_COLORS: Record<number, string> = {
  1: 'text-violet-300 border-violet-600 bg-violet-900/40',
  2: 'text-blue-300 border-blue-600 bg-blue-900/40',
  3: 'text-amber-300 border-amber-600 bg-amber-900/40',
  4: 'text-green-300 border-green-600 bg-green-900/40',
}

export function TopBar() {
  const { method, setMethod, solverState } = useRepairStore()
  const machineState = useMachineStore(s => s.machineState)
  const reset        = useMachineStore(s => s.reset)
  const resetRepair  = useRepairStore(s => s.reset)
  const isComplete   = machineState === LabState.COMPLETE
  const geminiStep   = GEMINI_STEP[machineState] ?? 1

  const handleSetMethod = (m: DischargeMethod) => {
    reset()
    resetRepair()
    setMethod(m)
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-slate-900/97 backdrop-blur-md border-b border-slate-700 px-4 pt-safe">
      <div className="flex items-center justify-between py-2">
        {/* Brand + Gemini step indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-bold text-sm tracking-wide">CapLab</span>
          {/* 4-step progress dots */}
          <div className="flex items-center gap-1 ml-1">
            {[1, 2, 3, 4].map(s => (
              <div
                key={s}
                className={`w-2 h-2 rounded-full transition-all duration-500 ${
                  s < geminiStep ? 'bg-green-400' :
                  s === geminiStep ? 'bg-amber-400 scale-125' :
                  'bg-slate-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Gemini step label (compact) */}
          <div className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border hidden sm:block ${STEP_COLORS[geminiStep]}`}>
            STEP {geminiStep}/4
          </div>

          {/* State machine badge */}
          <StateBadge />

          {/* Live voltage — red when dangerous, green when safe */}
          <div className={`px-2 py-0.5 rounded-full text-xs font-mono font-bold border ${
            isComplete
              ? 'bg-green-900/60 text-green-400 border-green-600'
              : solverState && solverState.voltage < 50
                ? 'bg-amber-900/60 text-amber-400 border-amber-600'
                : 'bg-red-900/60 text-red-400 border-red-700'
          }`}>
            {isComplete
              ? '✓ SAFE'
              : `${solverState ? solverState.voltage.toFixed(0) : '450'}V`
            }
          </div>
        </div>
      </div>

      {/* Method selector — screwdriver marked unsafe */}
      <div className="flex gap-1 pb-2 overflow-x-auto scrollbar-none">
        {METHODS.map(m => (
          <button
            key={m.id}
            onClick={() => handleSetMethod(m.id)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              method === m.id
                ? m.safe
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                  : 'bg-red-800 text-red-100 shadow-lg shadow-red-500/30'
                : m.safe
                  ? 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  : 'bg-red-950/50 text-red-400 hover:bg-red-900/50 border border-red-900/50'
            }`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
            {!m.safe && <span className="text-[9px] text-red-400">⚠</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
