import * as THREE from 'three'

export interface SnapZoneConfig {
  id: string
  position: [number, number, number]
  radius: number
  polarity: '+' | '-' | 'any'
  label: string
}

// Terminal snap zones on the capacitor
export const TERMINAL_SNAP_ZONES: SnapZoneConfig[] = [
  {
    id: 'terminal_pos',
    position: [0.1, 0.64, 0],
    radius: 0.35,
    polarity: '+',
    label: 'Positive Terminal (+)',
  },
  {
    id: 'terminal_neg',
    position: [-0.1, 0.64, 0],
    radius: 0.35,
    polarity: '-',
    label: 'Negative Terminal (−)',
  },
]

// Find the nearest snap zone within radius
export function findNearestZone(
  position: THREE.Vector3,
  zones: SnapZoneConfig[]
): SnapZoneConfig | null {
  let nearest: SnapZoneConfig | null = null
  let nearestDist = Infinity

  for (const zone of zones) {
    const zonePos = new THREE.Vector3(...zone.position)
    const dist = position.distanceTo(zonePos)
    if (dist < zone.radius && dist < nearestDist) {
      nearest = zone
      nearestDist = dist
    }
  }

  return nearest
}
