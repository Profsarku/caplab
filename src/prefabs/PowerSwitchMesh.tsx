// PowerSwitchMesh — must be tapped to "disconnect power" before any work
// If user tries to grab tools while power is ON → error fires
import { useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'

export function PowerSwitchMesh({ position = [-2, 0, 0] as [number, number, number] }) {
  const switchRef = useRef<Mesh>(null)
  const housingRef = useRef<Mesh>(null)
  const isPowerOn = useMachineStore(s => s.context.isPowerConnected)
  const dispatch = useMachineStore(s => s.dispatch)
  const setPowerConnected = useMachineStore(s => s.setPowerConnected)
  const machineState = useMachineStore(s => s.machineState)
  const [hovered, setHovered] = useState(false)

  useFrame(({ clock }) => {
    if (!housingRef.current) return
    const mat = housingRef.current.material as THREE.MeshStandardMaterial

    if (isPowerOn) {
      // Red pulse — danger
      const pulse = 0.6 + 0.4 * Math.sin(clock.getElapsedTime() * 3)
      mat.emissive.set('#dc2626')
      mat.emissiveIntensity = pulse * 0.4
    } else {
      mat.emissive.set('#22c55e')
      mat.emissiveIntensity = 0.15
    }

    // Switch lever angle
    if (switchRef.current) {
      const targetAngle = isPowerOn ? -Math.PI / 6 : Math.PI / 6
      switchRef.current.rotation.z +=
        (targetAngle - switchRef.current.rotation.z) * 0.15
    }
  })

  const handleTap = () => {
    if (machineState === LabState.COMPLETE || machineState === LabState.DISCHARGING) return
    if (isPowerOn) {
      // Check PPE first
      if (!useMachineStore.getState().context.ppeConfirmed) {
        dispatch('DISCONNECT_POWER') // Will fire ERR_NO_PPE guard
        return
      }
      setPowerConnected(false)
      dispatch('DISCONNECT_POWER')
    }
    // Cannot reconnect power during training
  }

  return (
    <group position={position}>
      {/* Housing */}
      <mesh
        ref={housingRef}
        onPointerDown={handleTap}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        castShadow
      >
        <boxGeometry args={[0.4, 0.55, 0.15]} />
        <meshStandardMaterial
          color={isPowerOn ? '#1a0000' : '#001a00'}
          emissive="#000"
          emissiveIntensity={0}
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      {/* Status LED */}
      <mesh position={[0, 0.18, 0.078]}>
        <circleGeometry args={[0.04, 12]} />
        <meshStandardMaterial
          color={isPowerOn ? '#ef4444' : '#22c55e'}
          emissive={isPowerOn ? '#ef4444' : '#22c55e'}
          emissiveIntensity={1}
        />
      </mesh>

      {/* Switch lever */}
      <mesh ref={switchRef} position={[0, 0, 0.08]}>
        <boxGeometry args={[0.08, 0.22, 0.06]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Label */}
      <Html
        position={[0, -0.32, 0.08]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div style={{
          color: isPowerOn ? '#fca5a5' : '#86efac',
          fontSize: '9px',
          fontWeight: 'bold',
          fontFamily: 'monospace',
          whiteSpace: 'nowrap',
          textAlign: 'center',
          textShadow: isPowerOn ? '0 0 6px #ef4444' : '0 0 6px #22c55e',
        }}>
          {isPowerOn ? '⚡ POWER ON' : '✓ POWER OFF'}
        </div>
      </Html>

      {/* Hover prompt */}
      {hovered && isPowerOn && (
        <Html position={[0, 0.45, 0]} center>
          <div style={{
            background: 'rgba(220,38,38,0.9)',
            color: 'white',
            fontSize: '10px',
            padding: '3px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            fontWeight: 'bold',
          }}>
            Tap to disconnect power
          </div>
        </Html>
      )}
    </group>
  )
}
