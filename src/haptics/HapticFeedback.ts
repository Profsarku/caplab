// HapticFeedback — Vibration API wrapper for mobile tactile feedback
// Falls back silently on desktop/unsupported browsers

const canVibrate = () =>
  typeof navigator !== 'undefined' && 'vibrate' in navigator

class HapticFeedback {
  // Double-tap feel — tool snapping to terminal
  snap() {
    if (!canVibrate()) return
    navigator.vibrate([25, 10, 25])
  }

  // Single firm buzz — error / safety violation
  error() {
    if (!canVibrate()) return
    navigator.vibrate([80, 40, 80])
  }

  // Short single pulse — warning
  warning() {
    if (!canVibrate()) return
    navigator.vibrate([40])
  }

  // Celebration pattern — discharge complete
  success() {
    if (!canVibrate()) return
    navigator.vibrate([30, 20, 30, 20, 60])
  }

  // Gentle continuous buzz while discharging (call on timer, stop after)
  dischargePulse() {
    if (!canVibrate()) return
    navigator.vibrate(15)
  }

  // Stop any ongoing vibration
  stop() {
    if (!canVibrate()) return
    navigator.vibrate(0)
  }
}

export const haptics = new HapticFeedback()
