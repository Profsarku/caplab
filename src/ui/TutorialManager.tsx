// TutorialManager — 4-step Gemini narrative driven by machineStore state
// Step 1: Preparation & Target | Step 2: Discharge Tool | Step 3: Verify | Step 4: Safe Handling
import { useMachineStore } from '../store/machineStore'
import { useRepairStore } from '../store/repairStore'
import { LabState } from '../state-machine/LabStateMachine'
import { GEMINI_STEP, GEMINI_STEP_LABELS, GEMINI_STEP_CONTEXT, SCENARIO } from '../data/scenario'

interface StepGuide {
  geminiStep: number
  title: string
  instruction: string
  sarahNote?: string     // Sarah's expertise tip
  safety?: string
  action?: string
  actionFn?: () => void
  progress: number
}

function useStepGuide(): StepGuide {
  const machineState   = useMachineStore(s => s.machineState)
  const method         = useRepairStore(s => s.method)
  const dispatch       = useMachineStore(s => s.dispatch)
  const setPpeConfirmed = useMachineStore(s => s.setPpeConfirmed)
  const solverState    = useRepairStore(s => s.solverState)

  const TOTAL = 8
  const pct = (n: number) => Math.round((n / TOTAL) * 100)
  const geminiStep = GEMINI_STEP[machineState] ?? 1

  const toolName = {
    resistor:    '33kΩ Bleeder Resistor',
    screwdriver: 'Screwdriver (UNSAFE)',
    bulb:        'High-Wattage Lamp',
    tool:        'Discharge Probe',
  }[method]

  switch (machineState) {
    // ── GEMINI STEP 1: Preparation ────────────────────────
    case LabState.IDLE:
      return {
        geminiStep: 1,
        title: 'Step 1 — Preparation & Target Identification',
        instruction:
          'Sarah has opened an industrial power supply unit. She identifies the large red 450V 1000µF electrolytic capacitor mounted on the PCB. The digital multimeter is already positioned nearby on the blue ESD mat.',
        sarahNote: 'Even with power off, this capacitor can hold lethal charge indefinitely. Always treat it as live.',
        action: 'Begin Training',
        actionFn: () => dispatch('CONFIRM_PPE'),
        progress: pct(0),
      }

    case LabState.PPE_CHECK:
    case LabState.POWER_ON:
      if (!useMachineStore.getState().context.ppeConfirmed) {
        return {
          geminiStep: 1,
          title: 'Step 1 — Confirm PPE & Grounding',
          instruction:
            'Before approaching the capacitor, Sarah confirms: Class 0 insulated HV gloves (1000V rated), safety glasses, and ESD wrist strap clipped to the PSU chassis ground.',
          safety: 'A 450V capacitor can deliver cardiac arrest-level current through bare skin in milliseconds.',
          action: 'PPE Confirmed ✓',
          actionFn: () => { setPpeConfirmed(true); dispatch('CONFIRM_PPE') },
          progress: pct(1),
        }
      }
      return {
        geminiStep: 1,
        title: 'Step 1 — Disconnect Mains Power',
        instruction:
          'Tap the red MAINS rocker switch on the PSU panel to disconnect line power. Sarah waits a full 30 seconds — filter capacitors can hold charge briefly after switch-off.',
        safety: 'NEVER open a PSU or touch internal components with mains still connected.',
        sarahNote: 'The capacitor in the crosshairs is now the only remaining hazard.',
        progress: pct(2),
      }

    // ── GEMINI STEP 2/3: Discharge Tool & Measurement ────
    case LabState.POWER_OFF:
      return {
        geminiStep: 2,
        title: 'Step 2 — Measure Initial Voltage',
        instruction:
          'Sarah clips the multimeter probes across the capacitor terminals. The display confirms 450V — the capacitor is fully charged and must be safely discharged before any other work.',
        safety: 'At 450V, direct contact with probe tips or component leads is dangerous.',
        sarahNote: 'Recording initial voltage is critical — it determines which discharge tool is appropriate.',
        action: 'Measure: 450V →',
        actionFn: () => { dispatch('START_MEASURE'); setTimeout(() => dispatch('MEASURE_DONE'), 900) },
        progress: pct(3),
      }

    case LabState.MEASURING:
      return {
        geminiStep: 2,
        title: 'Step 2 — Reading Voltage…',
        instruction: 'Multimeter probes are clipped to both terminals. Reading 450VDC — capacitor is at full industrial charge.',
        progress: pct(3),
      }

    case LabState.TOOL_READY:
      return {
        geminiStep: 2,
        title: `Step 2 — Connect the ${toolName}`,
        instruction:
          method === 'screwdriver'
            ? 'WRONG TOOL: A screwdriver creates a near-short circuit at 450V, generating a 45,000A arc flash equivalent to a small explosion. Use the rated discharge probe instead.'
            : `Sarah connects the BLACK ground clip to the PSU metal chassis first. Then she brings the probe tip (with its internal high-power resistor) to the first capacitor terminal. The resistor limits current, preventing any arc flash.`,
        safety:
          method === 'screwdriver'
            ? 'A screwdriver on a 450V capacitor causes explosive arc flash, severe burns, and blindness.'
            : 'Always connect ground clip before touching any capacitor terminal.',
        sarahNote: method !== 'screwdriver' ? 'The bulky resistor housing is intentional — it dissipates up to 200W of capacitor energy as safe heat.' : undefined,
        progress: pct(4),
      }

    case LabState.TOOL_GRABBED:
      return {
        geminiStep: 2,
        title: 'Step 2 — First Terminal Contact',
        instruction:
          'Ground clip secured to chassis. Sarah brings the probe tip to the positive (+) terminal — the orange ring. The internal 1kΩ resistor immediately limits current to 450mA.',
        sarahNote: 'Always connect positive first. This matches conventional current flow and reduces risk of unexpected ground fault.',
        progress: pct(5),
      }

    case LabState.TERMINAL_A:
      return {
        geminiStep: 2,
        title: 'Step 2 — Complete the Discharge Circuit',
        instruction:
          'Positive terminal connected. Sarah now brings the probe to the negative (−) terminal — the blue ring. This closes the resistive circuit. Energy begins dissipating as heat through the probe\'s internal resistor.',
        sarahNote: 'You will hear nothing — the resistor absorbs the energy silently. No spark. No flash. That\'s how it\'s supposed to work.',
        progress: pct(6),
      }

    case LabState.BOTH_CONNECTED:
    case LabState.DISCHARGING:
      return {
        geminiStep: 2,
        title: 'Step 2 — Discharge In Progress',
        instruction:
          method === 'tool'
            ? 'Capacitor energy is being safely converted to heat through the probe\'s 1kΩ internal resistor. Watch the multimeter reading drop from 450V toward zero.'
            : method === 'resistor'
              ? 'Slow bleed via 33kΩ bleeder resistor — minimal heat, maximum safety. Takes ~3 minutes to reach 1V.'
              : 'Discharge in progress. Monitor voltage reading on the multimeter display.',
        progress: pct(7),
      }

    // ── GEMINI STEP 3: Verification ───────────────────────
    case LabState.VERIFYING:
      return {
        geminiStep: 3,
        title: 'Step 3 — Confirm 0.00V with Multimeter',
        instruction:
          'Sarah removes the discharge probe. She clips the multimeter leads DIRECTLY across the capacitor terminals. The display must read 0.00V — below the 1V safe threshold — before any component leads can be touched.',
        safety: 'Even 10V residual in a 1000µF cap stores enough energy to cause a serious shock.',
        sarahNote: '"Verify 0V every time, no exceptions. Trust the meter, not your assumptions."',
        action: 'Verify: 0.00V ✓',
        actionFn: () => dispatch('VERIFY_SAFE'),
        progress: 95,
      }

    // ── GEMINI STEP 4: Safe Handling ──────────────────────
    case LabState.COMPLETE:
      return {
        geminiStep: 4,
        title: 'Step 4 — Safe to Desolder',
        instruction:
          'Capacitor verified at 0.00V. Sarah can now safely desolder it using a soldering iron and desoldering pump. Component leads can be handled directly — the discharge procedure was followed correctly.',
        sarahNote: 'The multimeter (still showing 0V) remains connected in the background — a habit that confirms safety throughout the maintenance task.',
        progress: 100,
      }

    default:
      return { geminiStep: 1, title: 'Follow the steps', instruction: 'Complete each step in sequence.', progress: 0 }
  }
}

// ── Step badge component ──────────────────────────────────
function GeminiStepBadge({ step }: { step: number }) {
  const colors: Record<number, string> = {
    1: 'bg-violet-900/60 border-violet-600 text-violet-300',
    2: 'bg-blue-900/60 border-blue-600 text-blue-300',
    3: 'bg-amber-900/60 border-amber-600 text-amber-300',
    4: 'bg-green-900/60 border-green-600 text-green-300',
  }
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${colors[step] ?? ''}`}>
      <span className="w-4 h-4 rounded-full bg-current flex items-center justify-center text-[8px] text-slate-900">{step}</span>
      OF 4
    </div>
  )
}

export function TutorialManager() {
  const machineState  = useMachineStore(s => s.machineState)
  const solverState   = useRepairStore(s => s.solverState)
  const guide         = useStepGuide()
  const isComplete    = machineState === LabState.COMPLETE
  const isDischarging = machineState === LabState.DISCHARGING || machineState === LabState.BOTH_CONNECTED

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 bg-slate-900/97 backdrop-blur-md border-t border-slate-700 rounded-t-2xl shadow-2xl">
      {/* Progress bar */}
      <div className="h-1 bg-slate-700 rounded-t-2xl overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-500 via-amber-500 to-green-400 transition-all duration-700 ease-out"
          style={{ width: `${guide.progress}%` }}
        />
      </div>

      <div className="px-4 pt-3 pb-6">
        {/* Step badge + context */}
        <div className="flex items-center gap-2 mb-2">
          <GeminiStepBadge step={guide.geminiStep} />
          <span className="text-[10px] text-slate-500 font-mono truncate">
            {GEMINI_STEP_LABELS[guide.geminiStep]}
          </span>
        </div>

        {/* Live readings during discharge (Gemini Step 2 instrument panel) */}
        {solverState && isDischarging && (
          <div className="flex items-center gap-0 mb-2 rounded-xl overflow-hidden border border-slate-700">
            <div className="flex-1 bg-slate-800 text-center px-2 py-2">
              <p className="text-[9px] text-slate-500 font-mono">VOLTAGE</p>
              <p className="text-amber-400 font-mono font-bold text-base">
                {solverState.voltage.toFixed(1)}V
              </p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="flex-1 bg-slate-800 text-center px-2 py-2">
              <p className="text-[9px] text-slate-500 font-mono">CURRENT</p>
              <p className="text-blue-400 font-mono font-bold text-base">
                {(solverState.current * 1000).toFixed(0)}mA
              </p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="flex-1 bg-slate-800 text-center px-2 py-2">
              <p className="text-[9px] text-slate-500 font-mono">POWER</p>
              <p className="text-orange-400 font-mono font-bold text-base">
                {solverState.power < 10
                  ? solverState.power.toFixed(2) + 'W'
                  : solverState.power.toFixed(0) + 'W'}
              </p>
            </div>
            <div className="w-px h-10 bg-slate-700" />
            <div className="flex-1 bg-slate-800 text-center px-2 py-2">
              <p className="text-[9px] text-slate-500 font-mono">SAFE?</p>
              <p className={`font-mono font-bold text-base ${solverState.voltage < 1 ? 'text-green-400' : 'text-red-400'}`}>
                {solverState.voltage < 1 ? '✓ YES' : '✗ NO'}
              </p>
            </div>
          </div>
        )}

        {/* Completion */}
        {isComplete ? (
          <div className="text-center py-2">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-400 font-bold text-lg">Capacitor Discharged!</p>
            <p className="text-slate-400 text-sm mt-1">0.00V confirmed — safe to desolder</p>
            <div className="mt-3 px-3 py-2 bg-green-950/60 border border-green-800 rounded-xl">
              <p className="text-green-300 text-xs leading-relaxed">
                {GEMINI_STEP_CONTEXT[4]}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-white font-semibold text-base mb-1">{guide.title}</h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-2">{guide.instruction}</p>

            {/* Sarah's expertise note */}
            {guide.sarahNote && (
              <div className="flex items-start gap-2 mb-2 px-2 py-1.5 bg-blue-950/40 border border-blue-700/40 rounded-lg">
                <span className="text-blue-400 text-xs mt-0.5 flex-shrink-0">👩‍🔧</span>
                <p className="text-blue-200 text-xs leading-relaxed italic">{guide.sarahNote}</p>
              </div>
            )}

            {/* Safety warning */}
            {guide.safety && (
              <div className="flex items-start gap-2 mb-3 px-2 py-1.5 bg-red-950/40 border border-red-700/50 rounded-lg">
                <span className="text-red-400 text-xs mt-0.5 flex-shrink-0">⚡</span>
                <p className="text-red-300 text-xs leading-relaxed">{guide.safety}</p>
              </div>
            )}

            {/* Action button */}
            {guide.action && guide.actionFn && (
              <button
                onClick={guide.actionFn}
                className="w-full py-3 mb-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700
                  text-white font-bold rounded-xl text-sm transition-colors shadow-lg shadow-blue-500/20"
              >
                {guide.action}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
