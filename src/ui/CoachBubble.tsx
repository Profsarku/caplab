// CoachBubble — reactive coaching message display
// Appears/disappears driven by coachStore.activeMessage state
// Dismiss: tap bubble, CSS bar reaches end, or state overrides (critical)
import { useEffect, useRef } from 'react'
import { useCoachStore } from '../store/coachStore'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'

const SEVERITY_STYLE = {
  info:     { bg: 'bg-slate-800',  border: 'border-slate-600', icon: '🤖', text: 'text-slate-200' },
  tip:      { bg: 'bg-blue-950',   border: 'border-blue-500',  icon: '💡', text: 'text-blue-100' },
  warning:  { bg: 'bg-amber-950',  border: 'border-amber-500', icon: '⚠️', text: 'text-amber-100' },
  critical: { bg: 'bg-red-950',    border: 'border-red-500',   icon: '🚨', text: 'text-red-100' },
}

export function CoachBubble() {
  const activeMessage = useCoachStore(s => s.activeMessage)
  const dismissMessage = useCoachStore(s => s.dismissMessage)
  const machineState = useMachineStore(s => s.machineState)
  const barRef = useRef<HTMLDivElement>(null)

  // Driven by machineState — auto-clear low-priority messages on progress
  useEffect(() => {
    if (
      activeMessage?.severity === 'info' &&
      machineState !== LabState.WARNING &&
      machineState !== LabState.ERROR
    ) {
      const t = setTimeout(dismissMessage, activeMessage.duration)
      return () => clearTimeout(t)
    }
  }, [activeMessage?.id, machineState])

  // Animate countdown bar — CSS transition, event-driven end
  useEffect(() => {
    if (!barRef.current || !activeMessage) return
    const bar = barRef.current
    bar.style.transition = 'none'
    bar.style.width = '100%'

    // Force reflow then start drain
    void bar.offsetWidth
    bar.style.transition = `width ${activeMessage.duration}ms linear`
    bar.style.width = '0%'
  }, [activeMessage?.id])

  const handleBarEnd = () => {
    if (activeMessage?.severity !== 'critical') dismissMessage()
  }

  if (!activeMessage) return null

  const style = SEVERITY_STYLE[activeMessage.severity]

  return (
    <div
      className={`fixed z-40 right-3 rounded-2xl border shadow-2xl overflow-hidden
        ${style.bg} ${style.border}
        animate-[slideInRight_0.25s_ease-out]`}
      style={{
        top: '100px',
        width: 'calc(100% - 80px)',
        maxWidth: '320px',
      }}
    >
      {/* Countdown bar — drains via CSS, fires dismiss on end */}
      <div
        ref={barRef}
        className={`h-0.5 ${
          activeMessage.severity === 'critical' ? 'bg-red-500' :
          activeMessage.severity === 'warning'  ? 'bg-amber-400' : 'bg-blue-400'
        }`}
        style={{ width: '100%' }}
        onTransitionEnd={handleBarEnd}
      />

      <div
        className="px-3 py-2.5 flex items-start gap-2 cursor-pointer"
        onClick={() => activeMessage.severity !== 'critical' && dismissMessage()}
      >
        <span className="text-xl flex-shrink-0 mt-0.5">{style.icon}</span>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${style.text}`}>
            {activeMessage.text}
          </p>
          {activeMessage.hint && (
            <p className="text-xs text-slate-400 mt-1 leading-snug">
              → {activeMessage.hint}
            </p>
          )}
        </div>

        {/* Points delta */}
        {activeMessage.pointsDelta !== undefined && (
          <div className={`flex-shrink-0 text-xs font-mono font-bold px-1.5 py-0.5 rounded-lg ${
            activeMessage.pointsDelta >= 0
              ? 'bg-green-900 text-green-400'
              : 'bg-red-900 text-red-400'
          }`}>
            {activeMessage.pointsDelta >= 0 ? '+' : ''}{activeMessage.pointsDelta}
          </div>
        )}
      </div>

      {/* CSS keyframe */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}
