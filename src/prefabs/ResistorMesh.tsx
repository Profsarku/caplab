import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, Group } from 'three'
import * as THREE from 'three'
import { useRepairStore } from '../store/repairStore'
import { useMachineStore } from '../store/machineStore'
import { LabState, isAtLeast } from '../state-machine/LabStateMachine'

interface SnapAnim { active: boolean; time: number }

export function ResistorMesh({ position = [1.5, 0.1, 0] as [number, number, number] }) {
  const bodyRef    = useRef<Mesh>(null)
  const leadPosRef = useRef<Group>(null)
  const leadNegRef = useRef<Group>(null)
  const snapAnim   = useRef<SnapAnim>({ active: false, time: 0 })
  const solverState = useRepairStore(s => s.solverState)
  const machineState = useMachineStore(s => s.machineState)

  useFrame((_, delta) => {
    // ── Heat glow on body ──────────────────────────────────
    if (bodyRef.current) {
      const mat = bodyRef.current.material as THREE.MeshStandardMaterial
      const power = solverState?.power ?? 0
      const heat = Math.min(power / 0.05, 1)
      mat.emissiveIntensity += (heat * 0.8 - mat.emissiveIntensity) * 0.05
    }

    // ── Lead-bend animation when snapping to terminals ─────
    if (snapAnim.current.active) {
      snapAnim.current.time += delta
      const t = snapAnim.current.time
      const ease = 1 - Math.exp(-t * 4)  // ease-out

      // Leads bend upward (Y) then forward (Z) toward terminals
      if (leadPosRef.current) {
        leadPosRef.current.rotation.z = -ease * 0.6   // bend toward + terminal
        leadPosRef.current.position.y = ease * 0.15
      }
      if (leadNegRef.current) {
        leadNegRef.current.rotation.z = ease * 0.6    // bend toward − terminal
        leadNegRef.current.position.y = ease * 0.15
      }

      if (t > 1.5) snapAnim.current.active = false
    }

    // ── Show leads straightened after connection ───────────
    if (isAtLeast(machineState, LabState.BOTH_CONNECTED)) {
      if (leadPosRef.current) leadPosRef.current.rotation.z = -0.6
      if (leadNegRef.current) leadNegRef.current.rotation.z = 0.6
    }
  })

  return (
    <group position={position}>
      {/* Body */}
      <mesh ref={bodyRef} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 16]} />
        <meshStandardMaterial
          color="#d4a017" emissive="#ff2200"
          emissiveIntensity={0} metalness={0.1} roughness={0.8}
        />
      </mesh>

      {/* Color bands */}
      {[-0.12, 0, 0.12].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.085, 0.085, 0.04, 16]} />
          <meshStandardMaterial color={['#8B4513', '#000', '#f4c430'][i]} />
        </mesh>
      ))}

      {/* Lead — positive (bends left toward + terminal) */}
      <group ref={leadPosRef} position={[-0.35, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
          <meshStandardMaterial color="#f4c430" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>

      {/* Lead — negative (bends right toward − terminal) */}
      <group ref={leadNegRef} position={[0.35, 0, 0]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  )
}
