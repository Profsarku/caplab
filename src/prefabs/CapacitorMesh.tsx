// CapacitorMesh — large industrial 450V electrolytic capacitor (red body)
// Visual matches Gemini Step 1: "the large, dangerous, red electrolytic capacitor (450V, 1000µF)"
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, Color } from 'three'
import * as THREE from 'three'
import { useRepairStore } from '../store/repairStore'

const V0 = 450  // Industrial PSU voltage

export function CapacitorMesh() {
  const bodyRef    = useRef<Mesh>(null)
  const glowRef    = useRef<Mesh>(null)
  const solverState  = useRepairStore(s => s.solverState)
  const isDischarging = useRepairStore(s => s.isDischarging)
  const isComplete   = useRepairStore(s => s.isComplete)

  useFrame(() => {
    if (!bodyRef.current || !glowRef.current) return

    // chargeRatio: 1.0 at full 450V, 0.0 when safe
    const chargeRatio = solverState
      ? Math.min(Math.max(solverState.voltage / V0, 0), 1)
      : 1

    // Emissive: glowing red-orange when charged, dark when discharged
    const emissiveColor = isComplete
      ? new Color(0x001100)
      : new Color().setHSL(
          0.03 - chargeRatio * 0.03,   // hue: red (0) to red-orange
          1.0,
          chargeRatio * 0.35,
        )

    const mat = bodyRef.current.material as THREE.MeshStandardMaterial
    mat.emissive = emissiveColor
    mat.emissiveIntensity = isDischarging
      ? chargeRatio * 2.0 + 0.5 * Math.sin(Date.now() / 150)  // flicker
      : chargeRatio * 1.2

    // Glow halo pulses with charge level
    const glowMat = glowRef.current.material as THREE.MeshStandardMaterial
    const pulse = isDischarging ? 0.5 + 0.5 * Math.sin(Date.now() / 180) : 0
    glowMat.opacity = chargeRatio * 0.35 + pulse * 0.15
    glowRef.current.scale.setScalar(1 + pulse * 0.06)
  })

  return (
    <group position={[0, 0, 0]}>
      {/* Capacitor body — large industrial red electrolytic */}
      <mesh ref={bodyRef} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1.0, 32]} />
        <meshStandardMaterial
          color="#b91c1c"       // Vibrant industrial red
          emissive="#ff2200"
          emissiveIntensity={1.2}
          metalness={0.5}
          roughness={0.25}
        />
      </mesh>

      {/* Negative polarity stripe (dark band) */}
      <mesh position={[-0.15, 0, 0]} castShadow>
        <cylinderGeometry args={[0.322, 0.322, 1.01, 8, 1, false, 0, 0.6]} />
        <meshStandardMaterial color="#1a0000" metalness={0.3} roughness={0.6} transparent opacity={0.85} />
      </mesh>

      {/* Top aluminum end-cap */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <cylinderGeometry args={[0.30, 0.30, 0.06, 32]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.92} roughness={0.08} />
      </mesh>

      {/* Vent score lines on top (safety feature) */}
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[0.52, 0.004, 0.025]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.56, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.52, 0.004, 0.025]} />
        <meshStandardMaterial color="#6b7280" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Bottom rubber base */}
      <mesh position={[0, -0.52, 0]} castShadow>
        <cylinderGeometry args={[0.31, 0.31, 0.04, 32]} />
        <meshStandardMaterial color="#111827" roughness={0.9} metalness={0.0} />
      </mesh>

      {/* Positive lead pin (+) — gold */}
      <mesh position={[0.10, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.22, 8]} />
        <meshStandardMaterial color="#f4c430" metalness={0.97} roughness={0.03} />
      </mesh>

      {/* Negative lead pin (−) — silver */}
      <mesh position={[-0.10, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.022, 0.022, 0.22, 8]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.05} />
      </mesh>

      {/* Danger glow halo (larger, more ominous than 24V version) */}
      <mesh ref={glowRef}>
        <cylinderGeometry args={[0.44, 0.44, 1.06, 32]} />
        <meshStandardMaterial
          color="#ef4444"
          transparent
          opacity={0.28}
          emissive="#dc2626"
          emissiveIntensity={1.5}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
