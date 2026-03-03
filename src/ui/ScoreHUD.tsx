// ScoreHUD — live score, timer, streak indicator
// All values reactive to coachStore state — no timers or animation loops
import { useRef, useState, useEffect } from 'react'
import { useCoachStore } from '../store/coachStore'
import { useRepairStore } from '../store/repairStore'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'

function useFlash(value: number) {
  const [flash, setFlash] = useState<'gain' | 'lose' | ''>('')
  const prevRef = useRef(value)

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? 'gain' : 'lose')
      prevRef.current = value
    }
  }, [value])

  const clearFlash = () => setFlash('')
  return { flash, clearFlash }
}

export function ScoreHUD() {
  const score         = useCoachStore(s => s.score)
  const elapsed       = useCoachStore(s => s.elapsedSeconds)
  const streak        = useCoachStore(s => s.currentStreak)
  const mistakeCount  = useCoachStore(s => s.mistakeCount)
  const machineState  = useMachineStore(s => s.machineState)
  const solverState   = useRepairStore(s => s.solverState)
  const { flash, clearFlash } = useFlash(score)

  const isActive = machineState !== LabState.IDLE && machineState !== LabState.COMPLETE
  if (!isActive) return null

  const mins = Math.floor(elapsed / 60)
  const secs = Math.floor(elapsed % 60)
  const timeStr = `${mins}:${secs.toString().padStart(2, '0')}`

  // Score color: green > 700, amber > 400, red below
  const scoreColor =
    score >= 700 ? 'text-green-400' :
    score >= 400 ? 'text-amber-400' : 'text-red-400'

  return (
    <div
      className="fixed left-3 z-30 flex flex-col gap-1"
      style={{ top: '100px' }}
    >
      {/* Score card */}
      <div className={`
        bg-slate-900/90 backdrop-blur border border-slate-700
        rounded-xl px-2.5 py-1.5 shadow-lg
        ${flash === 'gain' ? 'animate-[flashGreen_0.5s_ease-out]' : ''}
        ${flash === 'lose' ? 'animate-[flashRed_0.5s_ease-out]' : ''}
      `}
        onAnimationEnd={clearFlash}
      >
        <p className="text-[9px] text-slate-500 font-mono">SCORE</p>
        <p className={`text-lg font-mono font-bold leading-none ${scoreColor}`}>
          {score}
        </p>
      </div>

      {/* Timer */}
      <div className="bg-slate-900/90 backdrop-blur border border-slate-700 rounded-xl px-2.5 py-1.5">
        <p className="text-[9px] text-slate-500 font-mono">TIME</p>
        <p className="text-sm font-mono text-slate-300 leading-none">{timeStr}</p>
      </div>

      {/* Streak */}
      {streak >= 2 && (
        <div className="bg-orange-950/90 border border-orange-700 rounded-xl px-2.5 py-1.5">
          <p className="text-[9px] text-orange-500 font-mono">STREAK</p>
          <p className="text-sm font-mono text-orange-300 leading-none">🔥 {streak}</p>
        </div>
      )}

      {/* Mistake counter */}
      {mistakeCount > 0 && (
        <div className="bg-red-950/80 border border-red-800 rounded-xl px-2.5 py-1">
          <p className="text-[9px] text-red-400 font-mono">{mistakeCount} ✗</p>
        </div>
      )}

      {/* CSS keyframes */}
      <style>{`
        @keyframes flashGreen {
          0%,100% { box-shadow: none; }
          40%     { box-shadow: 0 0 12px 2px #22c55e88; }
        }
        @keyframes flashRed {
          0%,100% { box-shadow: none; }
          40%     { box-shadow: 0 0 12px 2px #ef444488; }
        }
      `}</style>
    </div>
  )
}
