import { Canvas } from '@react-three/fiber'
import { Suspense, useEffect } from 'react'
import { LabScene } from './scenes/LabScene'
import { TutorialManager } from './ui/TutorialManager'
import { TopBar } from './ui/TopBar'
import { ToolTray } from './ui/ToolTray'
import { ErrorOverlay } from './ui/ErrorOverlay'
import { CoachBubble } from './ui/CoachBubble'
import { ScoreHUD } from './ui/ScoreHUD'
import { EndReport } from './ui/EndReport'
import { coachingEngine } from './coaching/CoachingEngine'
import { useCoachStore } from './store/coachStore'

export default function App() {
  // Init coaching engine once on mount
  useEffect(() => {
    coachingEngine.init()
    return () => coachingEngine.destroy()
  }, [])

  // Drive coach timer via rAF — purely state-driven, no solver needed
  useEffect(() => {
    let last = performance.now()
    let rafId: number
    const tick = (now: number) => {
      const delta = (now - last) / 1000
      last = now
      useCoachStore.getState().tick(delta)
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <div className="fixed inset-0 bg-slate-950 flex flex-col overflow-hidden">
      {/* Layer stack (z-order): EndReport > ErrorOverlay > CoachBubble > ScoreHUD > TopBar > Canvas */}

      {/* Completion report — full screen on COMPLETE */}
      <EndReport />

      {/* Error/warning overlay */}
      <ErrorOverlay />

      {/* AI coaching bubble */}
      <CoachBubble />

      {/* Live score + timer HUD */}
      <ScoreHUD />

      {/* Top bar */}
      <TopBar />

      {/* 3D Canvas */}
      <div className="flex-1 w-full" style={{ paddingTop: '88px', paddingBottom: '228px' }}>
        <Canvas
          camera={{ position: [0, 1.5, 4], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: false }}
          className="w-full h-full touch-none"
        >
          <Suspense fallback={null}>
            <LabScene />
          </Suspense>
        </Canvas>
      </div>

      {/* Tool tray */}
      <ToolTray />

      {/* Tutorial bottom sheet */}
      <TutorialManager />
    </div>
  )
}
