// EndReport — completion screen driven by machineState === COMPLETE
// Shows score breakdown, violations, star rating, replay button
import { useMachineStore } from '../store/machineStore'
import { useCoachStore } from '../store/coachStore'
import { useRepairStore } from '../store/repairStore'
import { LabState } from '../state-machine/LabStateMachine'

function starRating(score: number, max: number): number {
  const ratio = score / max
  if (ratio >= 0.95) return 5
  if (ratio >= 0.80) return 4
  if (ratio >= 0.60) return 3
  if (ratio >= 0.40) return 2
  return 1
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

export function EndReport() {
  const machineState   = useMachineStore(s => s.machineState)
  const resetMachine   = useMachineStore(s => s.reset)
  const resetRepair    = useRepairStore(s => s.reset)
  const {
    score, maxScore, elapsedSeconds, violations,
    mistakeCount, bestStreak, cleanSteps, resetCoach
  } = useCoachStore()

  if (machineState !== LabState.COMPLETE) return null

  const stars = starRating(score, maxScore)
  const isPerfect = mistakeCount === 0

  const handleRestart = () => {
    resetMachine()
    resetRepair()
    resetCoach()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-lg flex flex-col overflow-y-auto">
      <div className="flex-1 px-5 py-8 flex flex-col items-center">

        {/* Gemini Step 4 completion header */}
        <div className="w-full mb-4 px-4 py-3 bg-green-950/50 border border-green-800 rounded-2xl text-center">
          <p className="text-green-400 text-[10px] font-mono font-bold mb-1 tracking-wider">STEP 4 — SAFE HANDLING & MAINTENANCE</p>
          <p className="text-green-300 text-sm leading-relaxed">
            The 450V capacitor is confirmed at 0.00V. Sarah can now safely desolder it using a soldering iron and desoldering pump — exactly as shown in the Gemini reference scenario.
          </p>
        </div>

        {/* Stars */}
        <div className="text-4xl mb-3 tracking-widest">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className={i < stars ? 'text-amber-400' : 'text-slate-700'}>★</span>
          ))}
        </div>

        {/* Score */}
        <div className={`text-6xl font-mono font-black mb-1 ${
          stars >= 4 ? 'text-green-400' : stars >= 3 ? 'text-amber-400' : 'text-red-400'
        }`}>
          {score}
        </div>
        <p className="text-slate-400 text-sm mb-2">out of {maxScore} pts</p>

        {isPerfect && (
          <div className="px-4 py-1.5 bg-green-900 border border-green-600 rounded-full text-green-300 text-sm font-bold mb-4">
            ⚡ Perfect Run — No Violations! (Sarah would approve)
          </div>
        )}

        {/* Stats grid */}
        <div className="w-full grid grid-cols-3 gap-2 mb-5">
          {[
            { label: 'Time', value: formatTime(elapsedSeconds) },
            { label: 'Mistakes', value: mistakeCount.toString() },
            { label: 'Best Streak', value: `🔥 ${bestStreak}` },
          ].map(stat => (
            <div key={stat.label} className="bg-slate-800 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 font-mono">{stat.label}</p>
              <p className="text-white font-bold text-sm mt-0.5">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Violations list */}
        {violations.length > 0 && (
          <div className="w-full mb-5">
            <p className="text-slate-400 text-xs font-mono mb-2 uppercase tracking-wider">
              Violations Log ({violations.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {violations.map((v, i) => (
                <div key={i} className={`px-3 py-2 rounded-xl border text-xs flex items-start gap-2 ${
                  v.severity === 'critical'
                    ? 'bg-red-950/60 border-red-800 text-red-300'
                    : 'bg-amber-950/60 border-amber-800 text-amber-300'
                }`}>
                  <span className="flex-shrink-0">{v.severity === 'critical' ? '🚨' : '⚠️'}</span>
                  <div>
                    <span className="font-mono text-[10px] opacity-70">{v.code} @ {formatTime(v.timeElapsed)}</span>
                    <p className="mt-0.5 leading-snug">{v.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Score breakdown */}
        <div className="w-full bg-slate-800/60 rounded-xl p-3 mb-6">
          <p className="text-slate-400 text-xs font-mono mb-2 uppercase tracking-wider">Score Breakdown</p>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300">Base score</span>
              <span className="text-slate-300 font-mono">1000</span>
            </div>
            {violations.map((v, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-red-400">{v.code}</span>
                <span className="text-red-400 font-mono">
                  {v.severity === 'critical' ? '−150' : '−25'}
                </span>
              </div>
            ))}
            {score > (1000 - violations.reduce((acc, v) =>
              acc + (v.severity === 'critical' ? 150 : 25), 0)
            ) && (
              <div className="flex justify-between text-xs border-t border-slate-700 pt-1 mt-1">
                <span className="text-green-400">Bonuses</span>
                <span className="text-green-400 font-mono">
                  +{score - 1000 + violations.reduce((acc, v) =>
                    acc + (v.severity === 'critical' ? 150 : 25), 0
                  )}
                </span>
              </div>
            )}
            <div className="flex justify-between font-bold border-t border-slate-600 pt-1 mt-1">
              <span className="text-white">Final Score</span>
              <span className="text-amber-400 font-mono">{score}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="w-full flex gap-3">
          <button
            onClick={handleRestart}
            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
              text-white font-bold rounded-2xl text-base transition-colors shadow-lg"
          >
            Try Again
          </button>
        </div>

        <p className="text-slate-600 text-xs mt-4">
          Tap "Try Again" to practice a different discharge method
        </p>
      </div>
    </div>
  )
}
