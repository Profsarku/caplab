// GrabInteraction — wraps any 3D mesh with touch/mouse grab + snap logic
// Architecture: Tool Prefab → GrabInteraction → LabScene → RepairManager
import { useRef, useCallback, ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import * as THREE from 'three'
import { findNearestZone } from './SnapZone'
import type { SnapZoneConfig } from './SnapZone'
import { useMachineStore } from '../store/machineStore'
import { audioEngine } from '../audio/AudioEngine'
import { haptics } from '../haptics/HapticFeedback'

interface GrabInteractionProps {
  children: ReactNode
  homePosition: [number, number, number]
  dragPlaneY?: number
  snapZones?: SnapZoneConfig[]
  onGrab?: () => void
  onSnap?: (zoneId: string, polarity: '+' | '-' | 'any') => void
  onRelease?: () => void        // released without snap
  disabled?: boolean
  hitboxSize?: [number, number, number]
}

export function GrabInteraction({
  children,
  homePosition,
  dragPlaneY = 0.7,
  snapZones = [],
  onGrab,
  onSnap,
  onRelease,
  disabled = false,
  hitboxSize = [0.5, 0.5, 0.5],
}: GrabInteractionProps) {
  const groupRef   = useRef<Group>(null)
  const isDragging = useRef(false)
  const isSnapped  = useRef(false)
  const targetPos  = useRef(new THREE.Vector3(...homePosition))
  const raycaster  = useRef(new THREE.Raycaster())
  const dragPlane  = useRef(
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -dragPlaneY)
  )
  const canGrabTools = useMachineStore(s => s.canGrabTools)

  // ── Pointer handlers ──────────────────────────────────
  const handlePointerDown = useCallback((e: any) => {
    e.stopPropagation()       // always block OrbitControls from stealing the event
    if (disabled || !canGrabTools) return
    isDragging.current = true
    isSnapped.current = false
    e.target.setPointerCapture?.(e.pointerId)
    audioEngine.unlock()      // unblock audio context on user gesture
    haptics.warning()         // gentle buzz — "you picked something up"
    onGrab?.()
  }, [disabled, canGrabTools, onGrab])

  const handlePointerUp = useCallback(() => {
    if (!isDragging.current) return
    isDragging.current = false

    if (!groupRef.current) return

    const zone = findNearestZone(groupRef.current.position, snapZones)

    if (zone) {
      // Snap to terminal — fire haptics + audio
      targetPos.current.set(...zone.position)
      isSnapped.current = true
      haptics.snap()          // double-tap feel
      audioEngine.playSnap()  // click SFX
      onSnap?.(zone.id, zone.polarity)
    } else {
      // Spring back home
      targetPos.current.set(...homePosition)
      isSnapped.current = false
      onRelease?.()
    }
  }, [snapZones, homePosition, onSnap, onRelease])

  // ── Per-frame: follow pointer while dragging ──────────
  useFrame(({ pointer, camera }) => {
    if (!groupRef.current) return

    if (isDragging.current) {
      raycaster.current.setFromCamera(pointer, camera)
      const hit = new THREE.Vector3()
      if (raycaster.current.ray.intersectPlane(dragPlane.current, hit)) {
        targetPos.current.copy(hit)
      }
    }

    // Smooth lerp toward target (drag follow OR spring home OR snap)
    const speed = isDragging.current ? 0.35 : 0.2
    groupRef.current.position.lerp(targetPos.current, speed)
  })

  return (
    <group ref={groupRef} position={homePosition}>
      {/* Invisible enlarged hitbox — easier to tap on mobile */}
      <mesh
        visible={false}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <boxGeometry args={hitboxSize} />
        <meshBasicMaterial />
      </mesh>

      {/* Actual visual mesh */}
      {children}
    </group>
  )
}
