// AudioEngine — Web Audio API for lab ambience, snap SFX, discharge hum
// Respects browser autoplay policy — creates context on first user gesture

class AudioEngine {
  private ctx: AudioContext | null = null
  private humOsc: OscillatorNode | null = null
  private humGain: GainNode | null = null
  private masterGain: GainNode | null = null
  private ready = false

  // Called on first user interaction
  private ensureContext() {
    if (this.ctx) return
    try {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.25
      this.masterGain.connect(this.ctx.destination)
      this.ready = true
    } catch {
      // Audio not available (e.g., some mobile browsers)
    }
  }

  unlock() {
    this.ensureContext()
    // Resume if suspended (Chrome requires user gesture)
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume()
    }
  }

  // ── Discharge hum — 80Hz electrical hum that fades as voltage drops ──
  startHum() {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return
    if (this.humOsc) this.stopHum()

    this.humGain = this.ctx.createGain()
    this.humGain.gain.value = 0.08

    // Base hum at 80Hz
    this.humOsc = this.ctx.createOscillator()
    this.humOsc.type = 'sawtooth'
    this.humOsc.frequency.value = 80

    // Add harmonic overtone for richer sound
    const harmOsc = this.ctx.createOscillator()
    harmOsc.type = 'sine'
    harmOsc.frequency.value = 160

    const harmGain = this.ctx.createGain()
    harmGain.gain.value = 0.03

    harmOsc.connect(harmGain)
    harmGain.connect(this.humGain)
    this.humOsc.connect(this.humGain)
    this.humGain.connect(this.masterGain)

    this.humOsc.start()
    harmOsc.start()
  }

  updateHum(voltage: number) {
    if (!this.humGain || !this.humOsc || !this.ctx) return
    const ratio = Math.max(0, Math.min(voltage / 24, 1))

    // Volume ∝ remaining charge
    this.humGain.gain.setTargetAtTime(ratio * 0.08, this.ctx.currentTime, 0.3)

    // Frequency drops slightly as voltage drops (electrical reality)
    this.humOsc.frequency.setTargetAtTime(80 + ratio * 30, this.ctx.currentTime, 0.5)
  }

  stopHum() {
    if (!this.humGain || !this.ctx) return
    this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5)
    setTimeout(() => {
      try { this.humOsc?.stop() } catch { /* already stopped */ }
      this.humOsc = null
      this.humGain = null
    }, 1000)
  }

  // ── Short click/snap SFX ─────────────────────────────────
  playSnap() {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.3))
    }

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const g = this.ctx.createGain()
    g.gain.value = 0.4
    src.connect(g)
    g.connect(this.masterGain)
    src.start()
  }

  // ── Error beep ───────────────────────────────────────────
  playError() {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 220
    g.gain.setValueAtTime(0.15, this.ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.4)
    osc.connect(g)
    g.connect(this.masterGain)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.4)
  }

  // ── Success chime (three ascending tones) ────────────────
  playComplete() {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const freqs = [523, 659, 784]  // C5, E5, G5
    freqs.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator()
      const g = this.ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const t = this.ctx!.currentTime + i * 0.18
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.2, t + 0.05)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(g)
      g.connect(this.masterGain!)
      osc.start(t)
      osc.stop(t + 0.5)
    })
  }

  // ── Warning tone ─────────────────────────────────────────
  playWarning() {
    this.ensureContext()
    if (!this.ctx || !this.masterGain) return

    const osc = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 440
    g.gain.setValueAtTime(0.12, this.ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25)
    osc.connect(g)
    g.connect(this.masterGain)
    osc.start()
    osc.stop(this.ctx.currentTime + 0.25)
  }
}

export const audioEngine = new AudioEngine()
