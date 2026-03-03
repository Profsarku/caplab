import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, PointLight } from 'three'
import * as THREE from 'three'
import { GrabInteraction } from '../interaction/GrabInteraction'
import { TERMINAL_SNAP_ZONES } from '../interaction/SnapZone'
import { useMachineStore } from '../store/machineStore'
import { useRepairStore } from '../store/repairStore'

export function BulbMesh() {
  const glassRef = useRef<Mesh>(null)
  const lightRef = useRef<PointLight>(null)
  const dispatch = useMachineStore(s => s.dispatch)
  const solverState = useRepairStore(s => s.solverState)

  useFrame(() => {
    if (!glassRef.current || !lightRef.current) return
    const chargeRatio = solverState
      ? Math.min(solverState.voltage / 24, 1)
      : 0

    const mat = glassRef.current.material as THREE.MeshStandardMaterial
    mat.emissiveIntensity = chargeRatio * 2.5
    // Dims from warm white → orange → off
    const r = chargeRatio
    mat.emissive.setRGB(r, r * 0.85, r * 0.3)

    lightRef.current.intensity = chargeRatio * 3
    lightRef.current.color.setRGB(1, 0.9, 0.5)
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
      hitboxSize={[0.6, 0.8, 0.6]}
    >
      <group>
        {/* Glass envelope */}
        <mesh ref={glassRef} position={[0, 0.18, 0]} castShadow>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial
            color="#fff8dc"
            emissive="#ffdd66"
            emissiveIntensity={0}
            transparent
            opacity={0.75}
            roughness={0.0}
            metalness={0.0}
          />
        </mesh>
        {/* Metal base */}
        <mesh position={[0, -0.05, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.06, 0.2, 16]} />
          <meshStandardMaterial color="#888" metalness={0.9} roughness={0.2} />
        </mesh>
        {/* Screw thread rings */}
        {[-0.1, -0.05, 0.0].map((y, i) => (
          <mesh key={i} position={[0, y, 0]}>
            <torusGeometry args={[0.068, 0.008, 6, 20]} />
            <meshStandardMaterial color="#666" metalness={0.8} />
          </mesh>
        ))}
        {/* Lead wire */}
        <mesh position={[0, -0.17, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.1, 6]} />
          <meshStandardMaterial color="#ccc" metalness={0.9} />
        </mesh>
        {/* Point light — illuminates scene */}
        <pointLight
          ref={lightRef}
          position={[0, 0.18, 0]}
          intensity={0}
          distance={3}
          color="#ffdd66"
        />
      </group>
    </GrabInteraction>
  )
}
