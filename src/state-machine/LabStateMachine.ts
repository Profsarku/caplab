// ========================================================
// Lab State Machine — pure transition function + types
// Every interaction passes through here before mutating state
// ========================================================

export enum LabState {
  IDLE             = 'IDLE',
  PPE_CHECK        = 'PPE_CHECK',       // Must confirm PPE before anything
  POWER_ON         = 'POWER_ON',        // Power still connected — danger zone
  POWER_OFF        = 'POWER_OFF',       // Power disconnected — safe to proceed
  MEASURING        = 'MEASURING',       // Multimeter in use
  TOOL_READY       = 'TOOL_READY',      // Tool selected from tray
  TOOL_GRABBED     = 'TOOL_GRABBED',    // Tool being dragged toward terminals
  TERMINAL_A       = 'TERMINAL_A',      // + terminal connected
  BOTH_CONNECTED   = 'BOTH_CONNECTED',  // Both terminals snapped → discharge starts
  DISCHARGING      = 'DISCHARGING',     // RC solver running
  VERIFYING        = 'VERIFYING',       // Re-measuring after discharge
  COMPLETE         = 'COMPLETE',        // Voltage < 0.5V — safe
  WARNING          = 'WARNING',         // Recoverable mistake
  ERROR            = 'ERROR',           // Severe safety violation
}

export type LabAction =
  | 'CONFIRM_PPE'         // User acknowledges PPE worn
  | 'DISCONNECT_POWER'    // User taps power switch
  | 'START_MEASURE'       // User picks up multimeter
  | 'MEASURE_DONE'        // User confirms voltage reading
  | 'SELECT_TOOL'         // User picks tool from tray
  | 'GRAB_TOOL'           // User grabs tool in 3D
  | 'SNAP_TERMINAL_A'     // Tool snaps to + terminal
  | 'SNAP_TERMINAL_B'     // Tool snaps to − terminal
  | 'DISCHARGE_COMPLETE'  // Solver reports voltage < threshold
  | 'VERIFY_SAFE'         // Re-measure confirms 0V
  | 'ACKNOWLEDGE'         // Dismiss warning/error
  | 'RESET'

export type ErrorCode =
  | 'ERR_POWER_ON'        // Attempted action with power connected
  | 'ERR_VOLTAGE_HIGH'    // Screwdriver on voltage > 50V
  | 'ERR_WRONG_ORDER'     // Skipped a required step
  | 'ERR_BAD_SNAP'        // Wrong terminal connection order
  | 'ERR_NO_PPE'          // Tried to skip PPE confirmation

export interface ErrorInfo {
  code: ErrorCode
  message: string
  hint: string
  severity: 'warning' | 'error'   // warning = recoverable, error = must reset
}

export interface MachineContext {
  selectedTool: string | null
  measuredVoltage: number
  isPowerConnected: boolean
  ppeConfirmed: boolean
}

export interface MachineTransition {
  nextState: LabState
  error?: ErrorInfo
}

// ── Guards ──────────────────────────────────────────────
function warn(code: ErrorCode, message: string, hint: string): MachineTransition {
  return { nextState: LabState.WARNING, error: { code, message, hint, severity: 'warning' } }
}

function error(code: ErrorCode, message: string, hint: string): MachineTransition {
  return { nextState: LabState.ERROR, error: { code, message, hint, severity: 'error' } }
}

// ── Pure transition function ─────────────────────────────
export function transition(
  state: LabState,
  action: LabAction,
  ctx: MachineContext
): MachineTransition {

  // RESET is always allowed
  if (action === 'RESET') return { nextState: LabState.IDLE }

  // ACKNOWLEDGE clears warning/error back to safe state
  if (action === 'ACKNOWLEDGE') {
    if (state === LabState.WARNING || state === LabState.ERROR) {
      return { nextState: ctx.isPowerConnected ? LabState.POWER_ON : LabState.POWER_OFF }
    }
    return { nextState: state }
  }

  switch (action) {

    case 'CONFIRM_PPE':
      if (state === LabState.IDLE || state === LabState.PPE_CHECK)
        return { nextState: LabState.POWER_ON }
      return warn('ERR_WRONG_ORDER', 'PPE already confirmed.', 'Continue to the next step.')

    case 'DISCONNECT_POWER':
      if (!ctx.ppeConfirmed)
        return warn('ERR_NO_PPE', 'Confirm PPE before disconnecting power!', 'Check the safety checklist first.')
      if (state === LabState.POWER_ON || state === LabState.PPE_CHECK)
        return { nextState: LabState.POWER_OFF }
      return warn('ERR_WRONG_ORDER', 'Power is already disconnected.', 'Proceed to measuring.')

    case 'START_MEASURE':
      if (ctx.isPowerConnected)
        return error('ERR_POWER_ON', 'DANGER: Power is still connected!', 'Disconnect mains power before touching any component.')
      if (!ctx.ppeConfirmed)
        return warn('ERR_NO_PPE', 'You must wear PPE before measuring.', 'Confirm gloves and glasses first.')
      if (state === LabState.POWER_OFF || state === LabState.MEASURING)
        return { nextState: LabState.MEASURING }
      return warn('ERR_WRONG_ORDER', 'Disconnect power before measuring.', 'Use the power switch first.')

    case 'MEASURE_DONE':
      if (state === LabState.MEASURING)
        return { nextState: LabState.TOOL_READY }
      return warn('ERR_WRONG_ORDER', 'Complete voltage measurement first.', 'Use the multimeter.')

    case 'SELECT_TOOL':
      if (ctx.isPowerConnected)
        return error('ERR_POWER_ON', 'DANGER: Power still ON!', 'Never select tools with live power.')
      if (ctx.selectedTool === 'screwdriver' && ctx.measuredVoltage > 50)
        return error('ERR_VOLTAGE_HIGH',
          `Screwdriver unsafe at ${ctx.measuredVoltage.toFixed(0)}V!`,
          'Use a bleeder resistor for voltages above 50V.')
      if (isAtLeast(state, LabState.POWER_OFF))
        return { nextState: LabState.TOOL_READY }
      return warn('ERR_WRONG_ORDER', 'Measure voltage before selecting a tool.', 'Use the multimeter first.')

    case 'GRAB_TOOL':
      if (ctx.isPowerConnected)
        return error('ERR_POWER_ON', 'DANGER: Power is ON — do not grab tools!', 'Disconnect power immediately.')
      if (state === LabState.TOOL_READY || state === LabState.TOOL_GRABBED)
        return { nextState: LabState.TOOL_GRABBED }
      return warn('ERR_WRONG_ORDER', 'Select a tool from the tray first.', 'Tap a tool in the tool tray.')

    case 'SNAP_TERMINAL_A':
      if (ctx.isPowerConnected)
        return error('ERR_POWER_ON', 'DANGER: Connecting to live terminals!', 'Disconnect power immediately.')
      if (state === LabState.TOOL_GRABBED || state === LabState.TOOL_READY)
        return { nextState: LabState.TERMINAL_A }
      if (state === LabState.TERMINAL_A)
        return warn('ERR_BAD_SNAP', '+ terminal already connected.', 'Now connect to the − terminal.')
      return warn('ERR_WRONG_ORDER', 'Grab the tool before connecting.', 'Drag the tool from the tray.')

    case 'SNAP_TERMINAL_B':
      if (ctx.isPowerConnected)
        return error('ERR_POWER_ON', 'DANGER: Connecting to live terminals!', 'Disconnect power immediately.')
      if (state === LabState.TERMINAL_A)
        return { nextState: LabState.BOTH_CONNECTED }
      if (state === LabState.TOOL_GRABBED || state === LabState.TOOL_READY)
        return warn('ERR_BAD_SNAP', 'Connect + terminal first.', 'Touch the positive (red) terminal first.')
      return warn('ERR_WRONG_ORDER', 'Connect + terminal before − terminal.', 'Follow the connection sequence.')

    case 'DISCHARGE_COMPLETE':
      if (state === LabState.DISCHARGING || state === LabState.BOTH_CONNECTED)
        return { nextState: LabState.VERIFYING }
      return { nextState: state }

    case 'VERIFY_SAFE':
      if (state === LabState.VERIFYING)
        return { nextState: LabState.COMPLETE }
      return { nextState: state }

    default:
      return { nextState: state }
  }
}

// ── State ordering — for comparisons (string enums can't use >=) ─────
export const STATE_ORDER: LabState[] = [
  LabState.IDLE,
  LabState.PPE_CHECK,
  LabState.POWER_ON,
  LabState.POWER_OFF,
  LabState.MEASURING,
  LabState.TOOL_READY,
  LabState.TOOL_GRABBED,
  LabState.TERMINAL_A,
  LabState.BOTH_CONNECTED,
  LabState.DISCHARGING,
  LabState.VERIFYING,
  LabState.COMPLETE,
  LabState.WARNING,
  LabState.ERROR,
]

export function stateIndex(s: LabState): number {
  const i = STATE_ORDER.indexOf(s)
  return i === -1 ? 0 : i
}

export function isAtLeast(state: LabState, target: LabState): boolean {
  return stateIndex(state) >= stateIndex(target)
}

// Human-readable state labels for UI
export const STATE_LABELS: Record<LabState, string> = {
  [LabState.IDLE]:           'Ready',
  [LabState.PPE_CHECK]:      'PPE Check',
  [LabState.POWER_ON]:       'Power ON — Danger',
  [LabState.POWER_OFF]:      'Power Off',
  [LabState.MEASURING]:      'Measuring',
  [LabState.TOOL_READY]:     'Tool Selected',
  [LabState.TOOL_GRABBED]:   'Tool Grabbed',
  [LabState.TERMINAL_A]:     '+ Terminal Connected',
  [LabState.BOTH_CONNECTED]: 'Both Connected',
  [LabState.DISCHARGING]:    'Discharging',
  [LabState.VERIFYING]:      'Verifying',
  [LabState.COMPLETE]:       'Complete',
  [LabState.WARNING]:        'Warning',
  [LabState.ERROR]:          'Safety Error',
}
