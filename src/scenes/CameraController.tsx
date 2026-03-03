// CameraController — smooth camera transitions driven by machine state
// Each state has a target camera position + lookAt → lerped each frame
import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LabState } from '../state-machine/LabStateMachine'
import { useMachineStore } from '../store/machineStore'

interface CameraPreset {
  position: [number, number, number]
  lookAt: [number, number, number]
  fov: number
}

const PRESETS: Partial<Record<LabState, CameraPreset>> = {
  [LabState.IDLE]: {
    position: [0, 2, 5],
    lookAt:   [0, 0, 0],
    fov: 50,
  },
  [LabState.PPE_CHECK]: {
    position: [0, 2, 5],
    lookAt:   [0, 0, 0],
    fov: 50,
  },
  [LabState.POWER_ON]: {
    // Zoom to power switch
    position: [-2.5, 0.8, 2.2],
    lookAt:   [-2, 0, 0],
    fov: 45,
  },
  [LabState.POWER_OFF]: {
    position: [-0.5, 1.5, 3.5],
    lookAt:   [0, 0.2, 0],
    fov: 48,
  },
  [LabState.MEASURING]: {
    // Zoom into capacitor terminals
    position: [0.3, 1.4, 2],
    lookAt:   [0, 0.6, 0],
    fov: 40,
  },
  [LabState.TOOL_READY]: {
    // Pull back to show tool tray and capacitor
    position: [1.2, 1.2, 3.8],
    lookAt:   [0.5, 0, 0],
    fov: 52,
  },
  [LabState.TOOL_GRABBED]: {
    // Show full scene — user dragging
    position: [0.5, 1.8, 4.5],
    lookAt:   [0, 0.2, 0],
    fov: 55,
  },
  [LabState.TERMINAL_A]: {
    // Zoom to show + terminal connection
    position: [0.8, 1.5, 2.8],
    lookAt:   [0.1, 0.65, 0],
    fov: 42,
  },
  [LabState.BOTH_CONNECTED]: {
    // Pull back to see full circuit
    position: [0.5, 1.5, 3.5],
    lookAt:   [0.5, 0.2, 0],
    fov: 50,
  },
  [LabState.DISCHARGING]: {
    // Dramatic close-up of capacitor glow
    position: [0.2, 1.0, 2.2],
    lookAt:   [0, 0.3, 0],
    fov: 44,
  },
  [LabState.VERIFYING]: {
    // Back to terminal view for multimeter
    position: [0.3, 1.4, 2.2],
    lookAt:   [0, 0.6, 0],
    fov: 40,
  },
  [LabState.COMPLETE]: {
    // Wide celebration shot
    position: [0, 2.5, 5],
    lookAt:   [0, 0, 0],
    fov: 48,
  },
}

const DEFAULT_PRESET: CameraPreset = {
  position: [0, 2, 5],
  lookAt:   [0, 0, 0],
  fov: 50,
}

export function CameraController() {
  const { camera } = useThree()
  const machineState = useMachineStore(s => s.machineState)
  const targetPos = useRef(new THREE.Vector3(0, 2, 5))
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0))
  const targetFov = useRef(50)
  const isTransitioning = useRef(false)
  const transitionSpeed = useRef(0.04)

  useEffect(() => {
    const preset = PRESETS[machineState] ?? DEFAULT_PRESET
    targetPos.current.set(...preset.position)
    targetLookAt.current.set(...preset.lookAt)
    targetFov.current = preset.fov
    isTransitioning.current = true
    transitionSpeed.current = 0.04  // fresh transition = smooth but not instant
  }, [machineState])

  useFrame(() => {
    if (!isTransitioning.current) return

    // Lerp camera position
    camera.position.lerp(targetPos.current, transitionSpeed.current)

    // Lerp lookAt via a temporary target
    const currentLookAt = new THREE.Vector3()
    camera.getWorldDirection(currentLookAt)
    const currentTarget = camera.position.clone().add(currentLookAt)
    currentTarget.lerp(targetLookAt.current, transitionSpeed.current)
    camera.lookAt(currentTarget)

    // Lerp fov
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (targetFov.current - camera.fov) * transitionSpeed.current
      camera.updateProjectionMatrix()
    }

    // Stop when close enough
    const dist = camera.position.distanceTo(targetPos.current)
    if (dist < 0.005) isTransitioning.current = false
  })

  return null
}
