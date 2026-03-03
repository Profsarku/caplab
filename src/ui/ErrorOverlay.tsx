// ErrorOverlay — top-of-screen banner for safety violations and warnings
// Driven by machineStore.errorInfo
import { useEffect, useState } from 'react'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'

export function ErrorOverlay() {
  const errorInfo = useMachineStore(s => s.errorInfo)
  const machineState = useMachineStore(s => s.machineState)
  const acknowledgeError = useMachineStore(s => s.acknowledgeError)
  const [visible, setVisible] = useState(false)
  const [shake, setShake] = useState(false)

  const isError = machineState === LabState.ERROR
  const isWarning = machineState === LabState.WARNING

  useEffect(() => {
    if (errorInfo) {
      setVisible(true)
      setShake(true)
      const t = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(t)
    } else {
      const t = setTimeout(() => setVisible(false), 300)
      return () => clearTimeout(t)
    }
  }, [errorInfo])

  if (!visible || !errorInfo) return null

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        shake ? 'animate-[shake_0.4s_ease-in-out]' : ''
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={`mx-3 mt-2 rounded-2xl border-2 shadow-2xl overflow-hidden ${
          isError
            ? 'bg-red-950 border-red-500 shadow-red-500/30'
            : 'bg-amber-950 border-amber-500 shadow-amber-500/20'
        }`}
      >
        {/* Severity bar */}
        <div className={`h-1 w-full ${isError ? 'bg-red-500' : 'bg-amber-400'} ${isError ? 'animate-pulse' : ''}`} />

        <div className="px-4 py-3 flex items-start gap-3">
          {/* Icon */}
          <div className={`text-2xl flex-shrink-0 ${isError ? 'animate-bounce' : ''}`}>
            {isError ? '🚨' : '⚠️'}
          </div>

          <div className="flex-1 min-w-0">
            {/* Code badge */}
            <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold mb-1 ${
              isError ? 'bg-red-800 text-red-300' : 'bg-amber-800 text-amber-300'
            }`}>
              {errorInfo.code}
            </div>

            {/* Message */}
            <p className={`font-bold text-sm leading-tight mb-1 ${
              isError ? 'text-red-200' : 'text-amber-200'
            }`}>
              {errorInfo.message}
            </p>

            {/* Hint */}
            <p className={`text-xs leading-snug ${
              isError ? 'text-red-400' : 'text-amber-400'
            }`}>
              {errorInfo.hint}
            </p>
          </div>

          {/* Dismiss button */}
          <button
            onClick={acknowledgeError}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isError
                ? 'bg-red-700 hover:bg-red-600 text-white'
                : 'bg-amber-700 hover:bg-amber-600 text-white'
            }`}
          >
            {isError ? 'Reset' : 'OK'}
          </button>
        </div>
      </div>

      {/* Keyframe for shake */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
