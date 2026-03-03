import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Points, BufferGeometry, Float32BufferAttribute, PointsMaterial } from 'three'
import { useRepairStore } from '../store/repairStore'

interface WireProps {
  start: [number, number, number]
  end: [number, number, number]
  color?: string
}

export function WireMesh({ start, end, color = '#ef4444' }: WireProps) {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array([...start, ...end]), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  )
}

// Current flow particles along wire path
export function CurrentParticles({
  start,
  end,
}: {
  start: [number, number, number]
  end: [number, number, number]
}) {
  const pointsRef = useRef<Points>(null)
  const isDischarging = useRepairStore(s => s.isDischarging)
  const solverState = useRepairStore(s => s.solverState)
  const PARTICLE_COUNT = 20

  const positions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3)
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const t = i / PARTICLE_COUNT
      arr[i * 3] = start[0] + (end[0] - start[0]) * t
      arr[i * 3 + 1] = start[1] + (end[1] - start[1]) * t
      arr[i * 3 + 2] = start[2] + (end[2] - start[2]) * t
    }
    return arr
  }, [start, end])

  const offsets = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, (_, i) => i / PARTICLE_COUNT),
    []
  )

  useFrame(({ clock }) => {
    if (!pointsRef.current || !isDischarging) return
    const t = clock.getElapsedTime()
    const speed = (solverState?.current ?? 0) * 2 + 0.3
    const geo = pointsRef.current.geometry
    const pos = geo.attributes.position.array as Float32Array

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const phase = ((offsets[i] + t * speed) % 1 + 1) % 1
      pos[i * 3] = start[0] + (end[0] - start[0]) * phase
      pos[i * 3 + 1] = start[1] + (end[1] - start[1]) * phase
      pos[i * 3 + 2] = start[2] + (end[2] - start[2]) * phase
    }
    geo.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#facc15"
        size={0.04}
        transparent
        opacity={isDischarging ? 0.9 : 0}
        sizeAttenuation
      />
    </points>
  )
}
