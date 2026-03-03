// CoachingEngine — singleton AI rule engine
// Subscribes to repairEvents + machineStore
// Generates contextual, escalating feedback → pushes to coachStore
import { repairEvents } from '../events/RepairEvents'
import { useMachineStore } from '../store/machineStore'
import { useCoachStore } from '../store/coachStore'
import { LabState } from '../state-machine/LabStateMachine'
import { COACHING_RULES, SUCCESS_MESSAGES, GUIDED_TIPS } from './CoachingRules'
import type { CoachSeverity } from './CoachingRules'
import { audioEngine } from '../audio/AudioEngine'
import { haptics } from '../haptics/HapticFeedback'

class CoachingEngine {
  private unsubMachine: (() => void) | null = null
  private initialized = false

  init() {
    if (this.initialized) return
    this.initialized = true

    // ── Subscribe to safety violations ─────────────────────
    repairEvents.on('onSafetyViolation', (event) => {
      const { code, message, severity } = (event.payload ?? {}) as {
        code: string
        message: string
        severity: CoachSeverity
      }
      this.handleViolation(code, severity)
      haptics.error()
      audioEngine.playError()
    })

    // ── Subscribe to discharge events ───────────────────────
    repairEvents.on('onToolConnected', () => {
      haptics.snap()
      audioEngine.startHum()
    })

    repairEvents.on('onVoltageChanged', (event) => {
      const voltage = ((event.payload?.voltage) as number) ?? 24
      audioEngine.updateHum(voltage)
    })

    repairEvents.on('onDischargeComplete', () => {
      audioEngine.stopHum()
      audioEngine.playComplete()
      haptics.success()
      this.handleSuccess('COMPLETE')
    })

    repairEvents.on('onStepComplete', () => {
      useCoachStore.getState().markStepClean()
      useCoachStore.getState().addScore(10)
    })

    // ── Subscribe to machine state changes ──────────────────
    this.unsubMachine = useMachineStore.subscribe(
      s => s.machineState,
      (state, prevState) => {
        this.onStateTransition(state, prevState)
      }
    )
  }

  private handleViolation(code: string, severity: CoachSeverity) {
    const coach = useCoachStore.getState()
    const rule = COACHING_RULES[code]
    if (!rule) return

    const count = coach.mistakesPerCode[code] ?? 0
    const msgIndex = Math.min(count, rule.messages.length - 1)
    const hintIndex = Math.min(count, rule.hints.length - 1)

    const text = rule.messages[msgIndex]
    const hint = rule.hints[hintIndex]

    // Log violation
    coach.logViolation({
      code,
      message: text,
      severity: rule.severity,
      stateAtTime: useMachineStore.getState().machineState,
    })

    // Deduct score
    coach.deductScore(rule.penalty, code)

    // Show message
    coach.addMessage({
      text,
      hint,
      severity: rule.severity,
      pointsDelta: -rule.penalty,
      duration: severity === 'critical' ? 5000 : 3500,
    })
  }

  private handleSuccess(stateKey: string) {
    const rule = SUCCESS_MESSAGES[stateKey]
    if (!rule) return

    const coach = useCoachStore.getState()
    coach.markStepClean()
    coach.addScore(rule.points)
    coach.addMessage({
      text: rule.message,
      severity: 'info',
      pointsDelta: rule.points,
      duration: 2500,
    })
  }

  private onStateTransition(state: LabState, prev: LabState) {
    const coach = useCoachStore.getState()

    // Start timer on first real action
    if (prev === LabState.IDLE && state !== LabState.IDLE) {
      coach.startTimer()
    }

    // Stop timer on complete
    if (state === LabState.COMPLETE) {
      coach.stopTimer()
      this.calculateFinalBonus()
    }

    // Show guided tip when in guided mode
    if (coach.guidedMode && state !== LabState.WARNING && state !== LabState.ERROR) {
      const tip = GUIDED_TIPS[state]
      if (tip) {
        setTimeout(() => {
          useCoachStore.getState().addMessage({
            text: tip,
            severity: 'tip',
            duration: 4000,
          })
        }, 800)
      }
    }

    // Success messages on clean transitions
    const successRule = SUCCESS_MESSAGES[state]
    if (successRule && prev !== LabState.WARNING && prev !== LabState.ERROR) {
      setTimeout(() => {
        this.handleSuccess(state)
      }, 400)
    }
  }

  private calculateFinalBonus() {
    const { elapsedSeconds, mistakeCount, score } = useCoachStore.getState()
    const coach = useCoachStore.getState()

    let bonusText = ''
    let bonusPts = 0

    // Time bonus
    if (elapsedSeconds < 90) {
      bonusPts += 300
      bonusText = 'Speed bonus: under 90s!'
    } else if (elapsedSeconds < 180) {
      bonusPts += 150
      bonusText = 'Speed bonus: under 3 min!'
    } else if (elapsedSeconds < 300) {
      bonusPts += 50
      bonusText = 'Completion bonus!'
    }

    // Perfect run bonus
    if (mistakeCount === 0) {
      bonusPts += 500
      bonusText = 'PERFECT RUN! No violations!'
    }

    if (bonusPts > 0) {
      coach.addScore(bonusPts)
      setTimeout(() => {
        coach.addMessage({
          text: bonusText,
          severity: 'info',
          pointsDelta: bonusPts,
          duration: 4000,
        })
      }, 1200)
    }
  }

  destroy() {
    this.unsubMachine?.()
    repairEvents.off('onSafetyViolation', () => {})
    repairEvents.off('onToolConnected', () => {})
    repairEvents.off('onVoltageChanged', () => {})
    repairEvents.off('onDischargeComplete', () => {})
    this.initialized = false
  }
}

// Singleton
export const coachingEngine = new CoachingEngine()
