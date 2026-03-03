// CoachingRules — rule database for the AI coaching engine
// Narrative: Sarah, industrial PSU, 450V 1000µF electrolytic capacitor
import type { ErrorCode } from '../state-machine/LabStateMachine'

export type CoachSeverity = 'info' | 'tip' | 'warning' | 'critical'

export interface CoachingRule {
  trigger: ErrorCode | string
  messages: string[]
  hints: string[]
  penalty: number
  severity: CoachSeverity
}

export interface SuccessRule {
  state: string
  message: string
  points: number
}

// ── Violation rules ─────────────────────────────────────
export const COACHING_RULES: Record<string, CoachingRule> = {
  ERR_POWER_ON: {
    trigger: 'ERR_POWER_ON',
    messages: [
      'Stop! Mains power is still LIVE. At 450V you cannot touch anything inside that PSU.',
      '2nd violation: Live 450V DC is lethal at this current capacity. Disconnect NOW.',
      '3rd time: This is an automatic failure in a real workplace. Power off first, always.',
    ],
    hints: [
      'Tap the red MAINS rocker switch on the PSU panel to disconnect power.',
      'Switch must show green LED and read "OFF" before any work begins.',
      'Rule: Power off → wait 30s → measure → then proceed. No exceptions.',
    ],
    penalty: 150,
    severity: 'critical',
  },

  ERR_VOLTAGE_HIGH: {
    trigger: 'ERR_VOLTAGE_HIGH',
    messages: [
      'A screwdriver on 450V creates a 45,000A arc flash — equivalent to a small explosion. This would blind and severely burn you.',
      '2nd time: Sarah would never use a screwdriver here. The internal resistance of a screwdriver is under 10mΩ — that\'s a near-short at 450V.',
      'The correct tool is a rated discharge probe with a built-in high-power resistor to limit current safely.',
    ],
    hints: [
      'Switch method to "Discharge Probe" — it has an internal 1kΩ HV-rated resistor.',
      'A 1kΩ resistor limits peak current to 450mA and dissipates energy as heat — no flash.',
      'Rule of thumb: any capacitor above 50V requires a proper bleeder tool, never a short circuit.',
    ],
    penalty: 250,
    severity: 'critical',
  },

  ERR_NO_PPE: {
    trigger: 'ERR_NO_PPE',
    messages: [
      'No PPE confirmed. At 450V, even a brief accidental contact causes cardiac arrest. Gloves and face shield are non-negotiable.',
      '2nd time: Sarah\'s Class 0 insulated gloves are rated to 1000V AC / 1500V DC. Standard gloves provide zero protection at this voltage.',
    ],
    hints: [
      'Confirm insulated HV gloves (Class 0+), safety glasses, and ESD wrist strap before proceeding.',
      'Face shield is recommended — a capacitor bank can rupture under certain fault conditions.',
    ],
    penalty: 100,
    severity: 'critical',
  },

  ERR_WRONG_ORDER: {
    trigger: 'ERR_WRONG_ORDER',
    messages: [
      'Safety procedures are sequential for a reason. Sarah follows the exact same order every time — no shortcuts.',
      '2nd skip: Each step verifies the previous one succeeded. Skipping creates undetected hazards.',
      'If you\'re unsure of the next step, the progress bar shows exactly where you are.',
    ],
    hints: [
      'Check the step indicator at the top of the instruction panel.',
      'The correct sequence: Power Off → Measure → Discharge → Verify 0V → Handle.',
      'In guided mode, each action button appears only when the step is ready.',
    ],
    penalty: 25,
    severity: 'warning',
  },

  ERR_BAD_SNAP: {
    trigger: 'ERR_BAD_SNAP',
    messages: [
      'Connect positive (+) terminal first, then negative (−). Orange ring first, then blue.',
      '2nd time: Connecting negative first can cause current to flow through the ground path unexpectedly.',
    ],
    hints: [
      'Orange ring = positive (+). Blue ring = negative (−).',
      'Sarah always starts at the positive terminal — same direction as conventional current flow.',
    ],
    penalty: 30,
    severity: 'warning',
  },
}

// ── Success reinforcement — Sarah's voice ────────────────
export const SUCCESS_MESSAGES: Record<string, SuccessRule> = {
  POWER_OFF: {
    state: 'POWER_OFF',
    message: 'Mains disconnected. Sarah waits 30 seconds — residual charge in filter caps can persist after power-off.',
    points: 20,
  },
  MEASURING: {
    state: 'MEASURING',
    message: 'Good. Multimeter reads 450V — confirms the capacitor is fully charged. Always verify before tool selection.',
    points: 10,
  },
  TOOL_READY: {
    state: 'TOOL_READY',
    message: 'Discharge probe selected. Sarah connects the black ground clip to the PSU chassis first — before touching the capacitor.',
    points: 15,
  },
  TERMINAL_A: {
    state: 'TERMINAL_A',
    message: 'First terminal connected. Energy is flowing through the 1kΩ resistor as heat. Connect negative to complete the circuit.',
    points: 20,
  },
  BOTH_CONNECTED: {
    state: 'BOTH_CONNECTED',
    message: 'Circuit closed. Capacitor discharging safely — the built-in resistor limits current to 450mA. Watch the voltage drop.',
    points: 25,
  },
  COMPLETE: {
    state: 'COMPLETE',
    message: 'Multimeter confirms 0.00V. Sarah can now safely desolder the capacitor — no shock risk. Procedure complete.',
    points: 150,
  },
}

// ── Guided mode tips ─────────────────────────────────────
export const GUIDED_TIPS: Record<string, string> = {
  IDLE:           'Tap "Begin Training" to start the 4-step industrial discharge procedure.',
  PPE_CHECK:      'Confirm Sarah\'s PPE: HV gloves, safety glasses, and ESD strap.',
  POWER_ON:       'Tap the red MAINS rocker switch on the left side of the PSU panel.',
  POWER_OFF:      'Tap "Measure: 450V" to read initial capacitor voltage with the multimeter.',
  MEASURING:      'Reading voltage... multimeter probes are touching both capacitor terminals.',
  TOOL_READY:     'Select the Discharge Probe from the tool tray, then drag it to the orange (+) ring.',
  TOOL_GRABBED:   'Drag the probe to the orange (+ positive) terminal ring on the capacitor.',
  TERMINAL_A:     'Now drag to the blue (− negative) ring to complete the discharge circuit.',
  BOTH_CONNECTED: 'Discharging automatically. Watch the voltage reading drop toward zero.',
  VERIFYING:      'Tap "Verify: 0.00V" to confirm the multimeter reads safe.',
}
