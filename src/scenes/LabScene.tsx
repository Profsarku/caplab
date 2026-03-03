import { useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Grid, Html } from '@react-three/drei'
import { useRef } from 'react'
import type React from 'react'
import * as THREE from 'three'
import { useRepairStore } from '../store/repairStore'
import { useMachineStore } from '../store/machineStore'
import { LabState, isAtLeast } from '../state-machine/LabStateMachine'
import { CapacitorMesh } from '../prefabs/CapacitorMesh'
import { ResistorMesh } from '../prefabs/ResistorMesh'
import { ScrewdriverMesh } from '../prefabs/ScrewdriverMesh'
import { BulbMesh } from '../prefabs/BulbMesh'
import { DischargeToolMesh } from '../prefabs/DischargeToolMesh'
import { PowerSwitchMesh } from '../prefabs/PowerSwitchMesh'
import { WireMesh, CurrentParticles } from '../prefabs/WireMesh'
import { TerminalColliders } from '../interaction/TerminalCollider'
import { CameraController } from './CameraController'
import { useEffect } from 'react'

// ── Arc flash visual — driven by SPICE vizState.arcIntensity ─────
// Always rendered; opacity/intensity controlled reactively in useFrame
function ArcFlash() {
  const lightRef = useRef<THREE.PointLight>(null)
  const meshRef  = useRef<THREE.Mesh>(null)

  useFrame(() => {
    // Read latest store value directly — avoids stale closure in useFrame
    const solverState = useRepairStore.getState().solverState
    const raw = solverState?.vizState?.arcIntensity ?? 0

    // Flicker: fast sine modulates the intensity when arc is active
    const flicker = raw > 0
      ? raw * (0.75 + 0.25 * Math.sin(Date.now() * 0.033))
      : 0

    if (lightRef.current) lightRef.current.intensity = flicker * 25

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = flicker * 6
      mat.opacity           = flicker * 0.85
    }
  })

  return (
    // Positioned at the terminal connection midpoint
    <group position={[0, 0.64, 0]}>
      <pointLight ref={lightRef} color="#ff6600" intensity={0} distance={1.5} decay={2} />
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ff3300"
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

// ── Interaction arrows — context-sensitive labels that guide the user ─────
function InteractionArrows() {
  const machineState = useMachineStore(s => s.machineState)

  const labelStyle: React.CSSProperties = {
    background: 'rgba(15,23,42,0.92)',
    border: '1px solid #475569',
    borderRadius: '8px',
    padding: '4px 10px',
    color: '#f1f5f9',
    fontSize: '11px',
    fontWeight: 700,
    fontFamily: 'monospace',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  }
  const arrowDown: React.CSSProperties = {
    position: 'absolute',
    bottom: '-8px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: '8px solid #475569',
  }
  const pulse: React.CSSProperties = {
    display: 'inline-block',
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#facc15',
    animation: 'labPulse 1s ease-in-out infinite',
    flexShrink: 0,
  }

  // Power switch label — show when power is ON and we're past IDLE
  const showPower = isAtLeast(machineState, LabState.POWER_ON) && machineState === LabState.POWER_ON

  // Capacitor label — always useful early on
  const showCap = isAtLeast(machineState, LabState.POWER_OFF) && !isAtLeast(machineState, LabState.BOTH_CONNECTED)

  // Tool label — show when at TOOL_READY
  const showTool = machineState === LabState.TOOL_READY || machineState === LabState.TOOL_GRABBED

  // Terminal labels — show when tool is grabbed
  const showTerminals = machineState === LabState.TOOL_GRABBED || machineState === LabState.TERMINAL_A

  return (
    <>
      {showPower && (
        <Html position={[-2, 1.1, 0]} center distanceFactor={4}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ ...labelStyle, borderColor: '#ef4444' }}>
              <span style={{ ...pulse, background: '#ef4444' }} />
              Tap to cut power
            </div>
            <div style={{ ...arrowDown, borderTopColor: '#ef4444' }} />
          </div>
          <style>{`@keyframes labPulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        </Html>
      )}

      {showCap && (
        <Html position={[0, 1.6, 0]} center distanceFactor={4}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ ...labelStyle, borderColor: '#dc2626' }}>
              <span style={{ ...pulse, background: '#dc2626' }} />
              450V Capacitor — danger
            </div>
            <div style={{ ...arrowDown, borderTopColor: '#dc2626' }} />
          </div>
        </Html>
      )}

      {showTool && (
        <Html position={[2.2, 1.0, 0.5]} center distanceFactor={4}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div style={{ ...labelStyle, borderColor: '#3b82f6' }}>
              <span style={{ ...pulse, background: '#3b82f6' }} />
              {machineState === LabState.TOOL_READY ? 'Grab & drag to terminals' : 'Drag to + terminal'}
            </div>
            <div style={{ ...arrowDown, borderTopColor: '#3b82f6' }} />
          </div>
        </Html>
      )}

      {showTerminals && (
        <>
          {machineState === LabState.TOOL_GRABBED && (
            <Html position={[0.1, 1.2, 0]} center distanceFactor={4}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ ...labelStyle, borderColor: '#f97316' }}>
                  <span style={{ ...pulse, background: '#f97316' }} />
                  (+) Drop here first
                </div>
                <div style={{ ...arrowDown, borderTopColor: '#f97316' }} />
              </div>
            </Html>
          )}
          {machineState === LabState.TERMINAL_A && (
            <Html position={[-0.1, 1.2, 0]} center distanceFactor={4}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <div style={{ ...labelStyle, borderColor: '#60a5fa' }}>
                  <span style={{ ...pulse, background: '#60a5fa' }} />
                  (−) Connect here
                </div>
                <div style={{ ...arrowDown, borderTopColor: '#60a5fa' }} />
              </div>
            </Html>
          )}
        </>
      )}
    </>
  )
}

export function LabScene() {
  const tickSolver     = useRepairStore(s => s.tickSolver)
  const connectTool    = useRepairStore(s => s.connectTool)
  const startDischarge = useRepairStore(s => s.startDischarge)
  const method         = useRepairStore(s => s.method)
  const machineState   = useMachineStore(s => s.machineState)
  const dispatch       = useMachineStore(s => s.dispatch)

  const dischargeStarted    = useRef(false)
  const dispatchedComplete  = useRef(false)

  const terminalAConn = isAtLeast(machineState, LabState.TERMINAL_A)
  const terminalBConn = isAtLeast(machineState, LabState.BOTH_CONNECTED)
  const bothConnected = isAtLeast(machineState, LabState.BOTH_CONNECTED)
  const isDischarging = machineState === LabState.BOTH_CONNECTED

  // When both terminals connected → start the SPICE transient engine
  useEffect(() => {
    if (machineState === LabState.BOTH_CONNECTED && !dischargeStarted.current) {
      dischargeStarted.current   = true
      dispatchedComplete.current = false
      connectTool('pos', 'neg')
      startDischarge()
    }
    if (!isAtLeast(machineState, LabState.BOTH_CONNECTED)) {
      dischargeStarted.current   = false
      dispatchedComplete.current = false
    }
  }, [machineState])

  // Drive solver every frame; dispatch DISCHARGE_COMPLETE exactly once
  useFrame((_, delta) => {
    if (!isDischarging) return
    tickSolver(delta)

    if (!dispatchedComplete.current) {
      // Read from store directly — avoids stale closure capture
      const state = useRepairStore.getState().solverState
      if (state?.isComplete) {
        dispatchedComplete.current = true
        dispatch('DISCHARGE_COMPLETE')
      }
    }
  })

  return (
    <>
      {/* Context-sensitive interaction arrows */}
      <InteractionArrows />

      {/* Camera transitions per state */}
      <CameraController />

      {/* Lighting — workbench overhead lamp setup */}
      <ambientLight intensity={0.35} color="#e0eaff" />
      <directionalLight position={[3, 8, 4]} intensity={1.2} castShadow color="#fff8f0" />
      <pointLight position={[-4, 3, 1]} intensity={0.4} color="#4488ff" />
      {/* Red danger glow from capacitor */}
      <pointLight position={[0, 1.2, 0]} intensity={0.6} color="#ff2200" distance={4} />
      <Environment preset="warehouse" />

      {/* ESD mat — blue, on workbench surface */}
      <mesh position={[0, -0.81, 0]} receiveShadow>
        <boxGeometry args={[8, 0.02, 5]} />
        <meshStandardMaterial color="#0e2a4a" roughness={0.85} metalness={0.05} />
      </mesh>

      {/* Workbench surface (light gray under the mat) */}
      <mesh position={[0, -0.84, 0]} receiveShadow>
        <boxGeometry args={[10, 0.06, 6]} />
        <meshStandardMaterial color="#475569" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* PSU chassis (opened industrial power supply) */}
      {/* Back panel */}
      <mesh position={[0, 0.4, -2.2]} castShadow receiveShadow>
        <boxGeometry args={[5, 2.5, 0.08]} />
        <meshStandardMaterial color="#374151" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Bottom panel */}
      <mesh position={[0, -0.75, -0.8]} castShadow receiveShadow>
        <boxGeometry args={[5, 0.06, 3]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.5} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-2.5, 0.4, -0.8]} castShadow>
        <boxGeometry args={[0.06, 2.5, 3]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Right wall */}
      <mesh position={[2.5, 0.4, -0.8]} castShadow>
        <boxGeometry args={[0.06, 2.5, 3]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* PCB board (green, capacitor mounted on it) */}
      <mesh position={[0, -0.72, -0.5]} receiveShadow>
        <boxGeometry args={[3.5, 0.04, 2.2]} />
        <meshStandardMaterial color="#064e3b" roughness={0.7} metalness={0.1} />
      </mesh>
      {/* PCB trace lines (decorative) */}
      <mesh position={[0.8, -0.70, -0.5]}>
        <boxGeometry args={[1.0, 0.005, 0.02]} />
        <meshStandardMaterial color="#065f46" emissive="#065f46" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.6, -0.70, -0.8]}>
        <boxGeometry args={[0.02, 0.005, 0.8]} />
        <meshStandardMaterial color="#065f46" emissive="#065f46" emissiveIntensity={0.3} />
      </mesh>

      {/* Transformer coil (right side of PSU) */}
      <mesh position={[1.8, -0.2, -1.5]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.7, 24]} />
        <meshStandardMaterial color="#1e1b4b" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[1.8, -0.2, -1.5]}>
        <cylinderGeometry args={[0.28, 0.28, 0.72, 24]} />
        <meshStandardMaterial color="#0f0e2a" metalness={0.2} roughness={0.8} />
      </mesh>

      {/* Heat sink fins (left side of PSU) */}
      {[-1.5, -1.7, -1.9, -2.1].map((x, i) => (
        <mesh key={i} position={[x, -0.1, -1.5]} castShadow>
          <boxGeometry args={[0.04, 1.4, 1.8]} />
          <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
        </mesh>
      ))}

      {/* Ground grid */}
      <Grid
        position={[0, -0.82, 0]}
        args={[10, 10]}
        cellColor="#0d2040"
        sectionColor="#1e3a5f"
        cellSize={0.5}
        fadeDistance={7}
      />

      {/* Power switch — must be tapped first */}
      <PowerSwitchMesh position={[-2, 0, 0]} />

      {/* Capacitor — center stage; glow driven by solverState.voltage */}
      <CapacitorMesh />

      {/* Arc flash visual — driven by SPICE vizState.arcIntensity */}
      <ArcFlash />

      {/* Terminal snap zone indicators */}
      <TerminalColliders
        terminalAConnected={terminalAConn}
        terminalBConnected={terminalBConn}
      />

      {/* Discharge component by method; heat shader driven by solverState.power */}
      {method === 'resistor'    && <ResistorMesh position={[1.5, 0.1, 0]} />}
      {method === 'screwdriver' && <ScrewdriverMesh />}
      {method === 'bulb'        && <BulbMesh />}
      {method === 'tool'        && <DischargeToolMesh />}

      {/* Wires + current particles — speed driven by solverState.current */}
      {bothConnected && (
        <>
          <WireMesh start={[0.1, 0.64, 0]} end={[0.8, 0.64, 0]} color="#ef4444" />
          <WireMesh start={[0.8, 0.64, 0]} end={[0.8, 0.1, 0]} color="#ef4444" />
          <WireMesh start={[-0.1, 0.64, 0]} end={[-0.8, 0.64, 0]} color="#64748b" />
          <WireMesh start={[-0.8, 0.64, 0]} end={[-0.8, 0.1, 0]} color="#64748b" />
          <CurrentParticles start={[0.1, 0.64, 0]} end={[0.8, 0.64, 0]} />
          <CurrentParticles start={[0.8, 0.64, 0]} end={[0.8, 0.1, 0]} />
        </>
      )}

      {/* Camera controls — disabled while user is dragging a tool */}
      <OrbitControls
        enabled={machineState !== LabState.TOOL_GRABBED}
        enablePan={false}
        enableZoom={true}
        minDistance={1.5}
        maxDistance={7}
        minPolarAngle={Math.PI / 8}
        maxPolarAngle={Math.PI / 2}
        target={[0, 0, 0]}
      />
    </>
  )
}
