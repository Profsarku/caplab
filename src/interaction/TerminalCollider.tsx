// TerminalCollider — visual snap zone indicators on capacitor terminals
// Highlights when tool is grabbed, confirms connection on snap
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import * as THREE from 'three'
import { LabState } from '../state-machine/LabStateMachine'
import { useMachineStore } from '../store/machineStore'

interface TerminalZoneProps {
  position: [number, number, number]
  polarity: '+' | '-'
  connected: boolean
}

function TerminalZone({ position, polarity, connected }: TerminalZoneProps) {
  const ringRef = useRef<Mesh>(null)
  const machineState = useMachineStore(s => s.machineState)
  const isToolGrabbed = machineState === LabState.TOOL_GRABBED

  useFrame(({ clock }) => {
    if (!ringRef.current) return
    const mat = ringRef.current.material as THREE.MeshStandardMaterial
    const t = clock.getElapsedTime()

    if (connected) {
      // Solid green when connected
      mat.color.set('#22c55e')
      mat.emissive.set('#22c55e')
      mat.emissiveIntensity = 0.8
      ringRef.current.scale.setScalar(1)
    } else if (isToolGrabbed) {
      // Pulse amber — tool is in hand, ready to snap here
      const pulse = 0.6 + 0.4 * Math.sin(t * 4)
      mat.color.set(polarity === '+' ? '#f97316' : '#60a5fa')
      mat.emissive.set(polarity === '+' ? '#f97316' : '#3b82f6')
      mat.emissiveIntensity = pulse
      ringRef.current.scale.setScalar(0.9 + 0.15 * Math.sin(t * 4))
    } else {
      // Dim neutral
      mat.color.set(polarity === '+' ? '#7c2d12' : '#1e3a5f')
      mat.emissive.set('#000000')
      mat.emissiveIntensity = 0
      ringRef.current.scale.setScalar(1)
    }
  })

  return (
    <group position={position}>
      {/* Snap ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.12, 0.02, 8, 24]} />
        <meshStandardMaterial
          color={polarity === '+' ? '#7c2d12' : '#1e3a5f'}
          emissive="#000"
          emissiveIntensity={0}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Polarity label disc */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.07, 16]} />
        <meshBasicMaterial
          color={connected ? '#22c55e' : polarity === '+' ? '#f97316' : '#60a5fa'}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

interface TerminalCollidersProps {
  terminalAConnected: boolean
  terminalBConnected: boolean
}

export function TerminalColliders({ terminalAConnected, terminalBConnected }: TerminalCollidersProps) {
  return (
    <>
      <TerminalZone
        position={[0.1, 0.68, 0]}
        polarity="+"
        connected={terminalAConnected}
      />
      <TerminalZone
        position={[-0.1, 0.68, 0]}
        polarity="-"
        connected={terminalBConnected}
      />
    </>
  )
}
