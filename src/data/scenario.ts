// CapLab Scenario Data — based on Gemini 4-step industrial discharge narrative
// Sarah: lead technician, industrial PSU, 450V electrolytic capacitor

export const SCENARIO = {
  title: 'Industrial PSU Capacitor Discharge',
  technician: 'Sarah',
  component: '450V 1000µF Electrolytic Capacitor',
  context: 'Industrial power supply unit, 450VDC 5A output',
  voltage: 450,
  safeThreshold: 1.0,   // V — must read below this to be considered safe
  ppe: ['Insulated HV gloves (Class 0, 1000V rated)', 'Safety glasses / face shield', 'ESD wrist strap grounded to chassis'],
}

// Maps 12 machine states to the 4 Gemini learning steps for progress display
export const GEMINI_STEP: Record<string, number> = {
  IDLE:            1,
  PPE_CHECK:       1,
  POWER_ON:        1,
  POWER_OFF:       2,
  MEASURING:       2,
  TOOL_READY:      2,
  TOOL_GRABBED:    2,
  TERMINAL_A:      2,
  BOTH_CONNECTED:  2,
  DISCHARGING:     2,
  VERIFYING:       3,
  COMPLETE:        4,
}

export const GEMINI_STEP_LABELS: Record<number, string> = {
  1: 'Step 1 — Preparation & Target Identification',
  2: 'Step 2 — Discharge Tool & Connection',
  3: 'Step 3 — Measurement & Verification',
  4: 'Step 4 — Safe Handling & Maintenance',
}

export const GEMINI_STEP_CONTEXT: Record<number, string> = {
  1: 'Sarah identifies the large red 450V capacitor inside the opened PSU. Digital multimeter is positioned nearby on the ESD mat.',
  2: 'A specialized discharge probe (with built-in high-power resistor) safely bleeds energy as heat. Never use a screwdriver at this voltage.',
  3: 'Multimeter leads clip directly across capacitor terminals. Display must read 0.00V before handling any circuitry.',
  4: 'Capacitor is verified safe. Sarah can now desolder it using a soldering iron and desoldering pump without shock risk.',
}
