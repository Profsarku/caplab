// StateBadge — compact state machine indicator in the top bar
import { useMachineStore } from '../store/machineStore'
import { LabState, STATE_LABELS } from '../state-machine/LabStateMachine'

const STATE_COLORS: Partial<Record<LabState, string>> = {
  [LabState.ERROR]:          'bg-red-800 text-red-300 border-red-600',
  [LabState.WARNING]:        'bg-amber-800 text-amber-300 border-amber-600',
  [LabState.POWER_ON]:       'bg-red-900 text-red-400 border-red-700',
  [LabState.COMPLETE]:       'bg-green-900 text-green-400 border-green-700',
  [LabState.DISCHARGING]:    'bg-orange-900 text-orange-400 border-orange-700',
  [LabState.BOTH_CONNECTED]: 'bg-blue-900 text-blue-400 border-blue-700',
}

export function StateBadge() {
  const machineState = useMachineStore(s => s.machineState)
  const colorClass = STATE_COLORS[machineState] ?? 'bg-slate-800 text-slate-400 border-slate-600'

  return (
    <div className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wide ${colorClass}`}>
      {STATE_LABELS[machineState]}
    </div>
  )
}
