// coachStore — coaching state, scoring, timer, violation log
import { create } from 'zustand'
import type { CoachSeverity } from '../coaching/CoachingRules'

export interface CoachMessage {
  id: string
  text: string
  hint?: string
  severity: CoachSeverity
  pointsDelta?: number        // shown alongside message
  duration: number            // ms before auto-dismiss
  timestamp: number
}

export interface ViolationEntry {
  code: string
  message: string
  severity: CoachSeverity
  timestamp: number
  stateAtTime: string
  timeElapsed: number
}

export interface CoachStore {
  // Messages
  activeMessage: CoachMessage | null
  messageQueue: CoachMessage[]

  // Scoring
  score: number
  maxScore: number

  // Timer
  startTime: number | null
  elapsedSeconds: number

  // Tracking
  currentStreak: number
  bestStreak: number
  mistakeCount: number
  mistakesPerCode: Record<string, number>
  guidedMode: boolean

  // History
  violations: ViolationEntry[]
  cleanSteps: number            // steps completed without error

  // Actions
  addMessage: (msg: Omit<CoachMessage, 'id' | 'timestamp'>) => void
  dismissMessage: () => void
  startTimer: () => void
  stopTimer: () => void
  tick: (delta: number) => void
  deductScore: (pts: number, code: string) => void
  addScore: (pts: number) => void
  markStepClean: () => void
  logViolation: (entry: Omit<ViolationEntry, 'timestamp' | 'timeElapsed'>) => void
  resetCoach: () => void
}

const INITIAL_SCORE = 1000

export const useCoachStore = create<CoachStore>((set, get) => ({
  activeMessage: null,
  messageQueue: [],
  score: INITIAL_SCORE,
  maxScore: INITIAL_SCORE,
  startTime: null,
  elapsedSeconds: 0,
  currentStreak: 0,
  bestStreak: 0,
  mistakeCount: 0,
  mistakesPerCode: {},
  guidedMode: false,
  violations: [],
  cleanSteps: 0,

  addMessage: (msg) => {
    const full: CoachMessage = {
      ...msg,
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
    }
    set(s => {
      // Replace active if same severity or higher; queue otherwise
      if (!s.activeMessage || msg.severity === 'critical') {
        return { activeMessage: full }
      }
      return { messageQueue: [...s.messageQueue.slice(-2), full] }
    })
  },

  dismissMessage: () => {
    set(s => {
      const [next, ...rest] = s.messageQueue
      return { activeMessage: next ?? null, messageQueue: rest }
    })
  },

  startTimer: () => {
    if (!get().startTime) set({ startTime: Date.now(), elapsedSeconds: 0 })
  },

  stopTimer: () => {
    const { startTime } = get()
    if (startTime) {
      set({ elapsedSeconds: (Date.now() - startTime) / 1000 })
    }
  },

  tick: (delta) => {
    const { startTime } = get()
    if (startTime) {
      set(s => ({ elapsedSeconds: s.elapsedSeconds + delta }))
    }
  },

  deductScore: (pts, code) => {
    set(s => {
      const newCount = (s.mistakesPerCode[code] ?? 0) + 1
      const totalMistakes = s.mistakeCount + 1
      return {
        score: Math.max(0, s.score - pts),
        mistakeCount: totalMistakes,
        currentStreak: 0,
        mistakesPerCode: { ...s.mistakesPerCode, [code]: newCount },
        guidedMode: totalMistakes >= 3,
      }
    })
  },

  addScore: (pts) => {
    set(s => ({ score: Math.min(9999, s.score + pts) }))
  },

  markStepClean: () => {
    set(s => {
      const streak = s.currentStreak + 1
      return {
        currentStreak: streak,
        bestStreak: Math.max(streak, s.bestStreak),
        cleanSteps: s.cleanSteps + 1,
      }
    })
  },

  logViolation: (entry) => {
    const { elapsedSeconds } = get()
    const full: ViolationEntry = {
      ...entry,
      timestamp: Date.now(),
      timeElapsed: elapsedSeconds,
    }
    set(s => ({ violations: [...s.violations, full] }))
  },

  resetCoach: () => {
    set({
      activeMessage: null,
      messageQueue: [],
      score: INITIAL_SCORE,
      startTime: null,
      elapsedSeconds: 0,
      currentStreak: 0,
      bestStreak: 0,
      mistakeCount: 0,
      mistakesPerCode: {},
      guidedMode: false,
      violations: [],
      cleanSteps: 0,
    })
  },
}))
