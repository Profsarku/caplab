// DischargeToolMesh — HV-rated discharge probe with visible internal resistor
// Matches Gemini Step 2: "specialized probe with built-in high-power resistor
// (visibly bulky and insulated, unlike a simple wire)"
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh } from 'three'
import * as THREE from 'three'
import { GrabInteraction } from '../interaction/GrabInteraction'
import { TERMINAL_SNAP_ZONES } from '../interaction/SnapZone'
import { useMachineStore } from '../store/machineStore'
import { LabState } from '../state-machine/LabStateMachine'

export function DischargeToolMesh() {
  const ledRef    = useRef<Mesh>(null)
  const resistorRef = useRef<Mesh>(null)
  const dispatch  = useMachineStore(s => s.dispatch)
  const machineState = useMachineStore(s => s.machineState)

  useFrame(({ clock }) => {
    // Status LED animation
    if (ledRef.current) {
      const mat = ledRef.current.material as THREE.MeshStandardMaterial
      if (machineState === LabState.COMPLETE) {
        mat.color.set('#22c55e'); mat.emissive.set('#22c55e'); mat.emissiveIntensity = 1.2
      } else if (machineState === LabState.BOTH_CONNECTED || machineState === LabState.DISCHARGING) {
        const pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 5)
        mat.color.set('#facc15'); mat.emissive.set('#facc15'); mat.emissiveIntensity = pulse * 1.5
      } else {
        mat.color.set('#ef4444'); mat.emissive.set('#ef4444'); mat.emissiveIntensity = 0.4
      }
    }
    // Resistor housing warms to orange during discharge
    if (resistorRef.current) {
      const mat = resistorRef.current.material as THREE.MeshStandardMaterial
      const isDischarging = machineState === LabState.BOTH_CONNECTED || machineState === LabState.DISCHARGING
      const heat = isDischarging ? 0.3 + 0.2 * Math.sin(clock.getElapsedTime() * 3) : 0
      mat.emissive.setRGB(heat, heat * 0.3, 0)
      mat.emissiveIntensity = isDischarging ? 1 : 0
    }
  })

  const handleSnap = (zoneId: string) => {
    if (zoneId === 'terminal_pos') dispatch('SNAP_TERMINAL_A')
    else dispatch('SNAP_TERMINAL_B')
  }

  return (
    <GrabInteraction
      homePosition={[2.2, 0.3, 0.5]}
      snapZones={TERMINAL_SNAP_ZONES}
      onGrab={() => dispatch('GRAB_TOOL')}
      onSnap={handleSnap}
      hitboxSize={[1.0, 0.5, 0.5]}
    >
      <group>
        {/* ── PROBE HANDLE (main grip) ── */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.60, 0.20, 0.18]} />
          <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.7} />
        </mesh>

        {/* Grip texture ridges */}
        {[-0.18, -0.06, 0.06, 0.18].map((x, i) => (
          <mesh key={i} position={[x, 0, 0.09]} castShadow>
            <boxGeometry args={[0.04, 0.18, 0.01]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        ))}

        {/* HV rating label panel */}
        <mesh position={[0, 0.07, 0.092]}>
          <boxGeometry args={[0.45, 0.06, 0.001]} />
          <meshStandardMaterial color="#dc2626" />
        </mesh>

        {/* Status LED */}
        <mesh ref={ledRef} position={[0.25, 0.04, 0.092]}>
          <circleGeometry args={[0.022, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.4} />
        </mesh>

        {/* Discharge trigger button */}
        <mesh position={[0, -0.09, 0.092]} castShadow>
          <boxGeometry args={[0.14, 0.04, 0.025]} />
          <meshStandardMaterial color="#2563eb" metalness={0.2} roughness={0.5} />
        </mesh>

        {/* ── BUILT-IN RESISTOR HOUSING (visibly bulky, insulated) ── */}
        {/* This is the key visual from Gemini Step 2 */}
        <mesh ref={resistorRef} position={[0, 0, 0]} castShadow>
          <boxGeometry args={[0.34, 0.30, 0.28]} />
          <meshStandardMaterial color="#92400e" metalness={0.1} roughness={0.8} />
        </mesh>
        {/* Resistor fins (heat dissipation) */}
        {[-0.08, 0, 0.08].map((z, i) => (
          <mesh key={i} position={[0, 0.16, z]} castShadow>
            <boxGeometry args={[0.30, 0.04, 0.025]} />
            <meshStandardMaterial color="#78350f" roughness={0.7} />
          </mesh>
        ))}
        {/* Resistor value label */}
        <mesh position={[0, 0, 0.15]}>
          <boxGeometry args={[0.28, 0.10, 0.001]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>

        {/* ── PROBE CABLES ── */}
        {/* Red probe (positive) */}
        <mesh position={[-0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.22, 8]} />
          <meshStandardMaterial color="#dc2626" roughness={0.6} />
        </mesh>
        {/* Probe tip — positive */}
        <mesh position={[-0.61, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <coneGeometry args={[0.018, 0.06, 8]} />
          <meshStandardMaterial color="#f4c430" metalness={0.95} roughness={0.05} />
        </mesh>

        {/* Black ground clip cable */}
        <mesh position={[0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.014, 0.014, 0.22, 8]} />
          <meshStandardMaterial color="#111827" roughness={0.6} />
        </mesh>
        {/* Ground clip (alligator style) */}
        <mesh position={[0.61, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <boxGeometry args={[0.06, 0.022, 0.012]} />
          <meshStandardMaterial color="#374151" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
    </GrabInteraction>
  )
}
