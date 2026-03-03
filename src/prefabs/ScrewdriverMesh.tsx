import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group, Mesh } from 'three'
import * as THREE from 'three'
import { GrabInteraction } from '../interaction/GrabInteraction'
import { TERMINAL_SNAP_ZONES } from '../interaction/SnapZone'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'
import { createSpring, excite, stepSpring, settleSpring } from '../physics/spring'
import type { Spring } from '../physics/spring'

export function ScrewdriverMesh() {
  const shaftRef  = useRef<Mesh>(null)
  const groupRef  = useRef<Group>(null)
  // Spring-based wrist rotation — impulse on snap, physics decay. No timers.
  const rotSpring  = useRef<Spring>(createSpring(38, 10))
  const pushSpring = useRef<Spring>(createSpring(60, 14))
  const dispatch   = useMachineStore(s => s.dispatch)
  const machineState = useMachineStore(s => s.machineState)

  useFrame((_, delta) => {
    // ── Arc flash — reactive to machine state, not a timeline ─
    if (shaftRef.current) {
      const mat = shaftRef.current.material as THREE.MeshStandardMaterial
      const discharging = machineState === LabState.BOTH_CONNECTED
      // Target emissive: 1 if discharging (flickers), 0 otherwise
      const flickerTarget = discharging
        ? 0.5 + 0.5 * Math.abs(Math.sin(Date.now() / 80))
        : 0
      mat.emissiveIntensity += (flickerTarget - mat.emissiveIntensity) * Math.min(delta * 8, 1)
    }

    // ── Spring-based wrist rotation (not time-driven) ─────
    if (groupRef.current) {
      const rot  = stepSpring(rotSpring.current, delta)
      const push = stepSpring(pushSpring.current, delta)
      groupRef.current.rotation.y = rot
      groupRef.current.position.z = push
    }
  })

  const handleSnap = (zoneId: string) => {
    // Fire impulse into spring — physics handles the wrist-twist decay
    excite(rotSpring.current, 6)    // twist impulse
    excite(pushSpring.current, -0.08) // forward push into terminal

    dispatch('SNAP_TERMINAL_A')
    dispatch('SNAP_TERMINAL_B') // screwdriver bridges both at once
  }

  return (
    <GrabInteraction
      homePosition={[2.2, 0.2, 0.5]}
      snapZones={TERMINAL_SNAP_ZONES}
      onGrab={() => dispatch('GRAB_TOOL')}
      onSnap={handleSnap}
      hitboxSize={[1.0, 0.3, 0.3]}
    >
      <group ref={groupRef} rotation={[0, 0, Math.PI / 6]}>
        {/* Rubber handle */}
        <mesh castShadow>
          <cylinderGeometry args={[0.07, 0.09, 0.5, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.9} metalness={0.0} />
        </mesh>
        {/* Handle grip ridges */}
        {[-0.15, -0.05, 0.05, 0.15].map((y, i) => (
          <mesh key={i} position={[0, y, 0]} castShadow>
            <cylinderGeometry args={[0.075, 0.075, 0.04, 16]} />
            <meshStandardMaterial color="#c00" roughness={0.8} />
          </mesh>
        ))}
        {/* Metal shaft */}
        <mesh ref={shaftRef} position={[0, 0.45, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.5, 8]} />
          <meshStandardMaterial
            color="#aaaaaa" metalness={0.95} roughness={0.05}
            emissive="#ffaa00" emissiveIntensity={0}
          />
        </mesh>
        {/* Flat-head tip */}
        <mesh position={[0, 0.71, 0]} castShadow>
          <boxGeometry args={[0.05, 0.025, 0.01]} />
          <meshStandardMaterial color="#888" metalness={1} roughness={0} />
        </mesh>
      </group>
    </GrabInteraction>
  )
}
