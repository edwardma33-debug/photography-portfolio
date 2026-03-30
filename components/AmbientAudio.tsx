'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'

// Satie — Gnossienne No.1 (public domain)
// Encoded as [frequency, duration in beats] pairs
// 0 frequency = rest

const TEMPO = 0.7 // seconds per beat — slow, contemplative

// Bass ostinato pattern (left hand) — repeating F minor arpeggio
const BASS_PATTERN: [number, number][] = [
  [87.31, 1],   // F2
  [130.81, 1],  // C3
  [174.61, 1],  // F3
  [207.65, 1],  // Ab3
  [174.61, 1],  // F3
  [130.81, 1],  // C3
]

// Melody phrases (right hand) — the haunting Gnossienne theme
const MELODY_PHRASE_1: [number, number][] = [
  [0, 6],          // Rest — let bass establish
  [0, 6],          // Another bar of bass alone
  [466.16, 3],     // Bb4 (the iconic opening note, held)
  [415.30, 1],     // Ab4
  [392.00, 1],     // G4
  [349.23, 1],     // F4
  [311.13, 2],     // Eb4
  [349.23, 2],     // F4
  [0, 2],          // Brief pause
  [466.16, 3],     // Bb4
  [415.30, 1],     // Ab4
  [392.00, 1],     // G4
  [349.23, 1],     // F4
  [349.23, 2],     // F4 (held)
  [311.13, 2],     // Eb4
  [277.18, 2],     // Db4
]

const MELODY_PHRASE_2: [number, number][] = [
  [311.13, 3],     // Eb4
  [349.23, 1],     // F4
  [415.30, 1],     // Ab4
  [392.00, 1],     // G4
  [349.23, 2],     // F4
  [311.13, 2],     // Eb4
  [277.18, 2],     // Db4
  [261.63, 3],     // C4
  [277.18, 1],     // Db4
  [311.13, 2],     // Eb4
  [349.23, 3],     // F4 (resolving)
  [0, 3],          // Rest
]

const MELODY_PHRASE_3: [number, number][] = [
  [523.25, 3],     // C5 (higher register, building)
  [466.16, 1],     // Bb4
  [415.30, 1],     // Ab4
  [392.00, 1],     // G4
  [415.30, 2],     // Ab4
  [466.16, 2],     // Bb4
  [415.30, 2],     // Ab4
  [392.00, 1],     // G4
  [349.23, 1],     // F4
  [311.13, 2],     // Eb4
  [277.18, 2],     // Db4
  [261.63, 3],     // C4
  [0, 4],          // Long rest before repeat
]

// Full melody is all phrases in sequence, then loops
const FULL_MELODY = [...MELODY_PHRASE_1, ...MELODY_PHRASE_2, ...MELODY_PHRASE_3]

export default function AmbientAudio() {
  const { theme } = useTimeTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const playingRef = useRef(false)
  const bassTimeoutRef = useRef<NodeJS.Timeout>()
  const melodyTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Create a piano-like tone
  const playNote = useCallback((
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    duration: number,
    volume: number,
    isBass: boolean,
  ) => {
    if (freq === 0) return // Rest

    const now = ctx.currentTime

    // Fundamental
    const osc1 = ctx.createOscillator()
    osc1.type = 'sine'
    osc1.frequency.value = freq

    // 2nd harmonic — adds body
    const osc2 = ctx.createOscillator()
    osc2.type = 'sine'
    osc2.frequency.value = freq * 2

    // 3rd harmonic — adds clarity to melody
    const osc3 = ctx.createOscillator()
    osc3.type = 'sine'
    osc3.frequency.value = freq * 3

    // Gain envelopes
    const gain1 = ctx.createGain()
    const gain2 = ctx.createGain()
    const gain3 = ctx.createGain()

    const attack = 0.02
    const decay = duration * TEMPO * 0.4
    const sustainLevel = isBass ? 0.15 : 0.25
    const release = duration * TEMPO * 0.6

    // Fundamental envelope
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(volume, now + attack)
    gain1.gain.exponentialRampToValueAtTime(volume * sustainLevel, now + attack + decay)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + attack + decay + release)

    // 2nd harmonic — quieter, decays faster
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(volume * 0.15, now + attack)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + attack + decay * 0.6)

    // 3rd harmonic — very quiet, decays fast (adds initial "pluck")
    gain3.gain.setValueAtTime(0, now)
    gain3.gain.linearRampToValueAtTime(volume * 0.06, now + attack)
    gain3.gain.exponentialRampToValueAtTime(0.001, now + attack + decay * 0.3)

    // Soft low-pass filter per note — removes harshness
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = isBass ? 300 : 2000
    filter.Q.value = 0.5

    // Filter decay — brightness fades like a real piano
    filter.frequency.setValueAtTime(isBass ? 400 : 3000, now)
    filter.frequency.exponentialRampToValueAtTime(isBass ? 150 : 800, now + attack + decay)

    osc1.connect(gain1)
    osc2.connect(gain2)
    osc3.connect(gain3)
    gain1.connect(filter)
    gain2.connect(filter)
    gain3.connect(filter)
    filter.connect(destination)

    osc1.start(now)
    osc2.start(now)
    osc3.start(now)

    const stopTime = now + attack + decay + release + 0.1
    osc1.stop(stopTime)
    osc2.stop(stopTime)
    osc3.stop(stopTime)
  }, [])

  // Schedule the bass loop
  const playBass = useCallback((ctx: AudioContext, destination: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return

      const [freq, dur] = BASS_PATTERN[noteIndex % BASS_PATTERN.length]
      playNote(ctx, destination, freq, dur, 0.08, true)
      noteIndex++

      bassTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }

    scheduleNext()
  }, [playNote])

  // Schedule the melody loop
  const playMelody = useCallback((ctx: AudioContext, destination: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return

      const [freq, dur] = FULL_MELODY[noteIndex % FULL_MELODY.length]
      playNote(ctx, destination, freq, dur, 0.12, false)
      noteIndex++

      melodyTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }

    scheduleNext()
  }, [playNote])

  const initAndPlay = useCallback(() => {
    if (!audioContextRef.current) {
      const ctx = new AudioContext()
      audioContextRef.current = ctx

      // Reverb via delay lines (convolution reverb is too heavy)
      const masterGain = ctx.createGain()
      masterGain.gain.value = 0
      masterGain.connect(ctx.destination)
      masterGainRef.current = masterGain

      // Delay for reverb-like effect
      const delay1 = ctx.createDelay(1)
      delay1.delayTime.value = 0.15
      const delay1Gain = ctx.createGain()
      delay1Gain.gain.value = 0.2

      const delay2 = ctx.createDelay(1)
      delay2.delayTime.value = 0.35
      const delay2Gain = ctx.createGain()
      delay2Gain.gain.value = 0.1

      // Delay filter — darker echoes
      const delayFilter = ctx.createBiquadFilter()
      delayFilter.type = 'lowpass'
      delayFilter.frequency.value = 1200
      delayFilter.Q.value = 0.3

      // Dry signal
      const dryGain = ctx.createGain()
      dryGain.gain.value = 0.7
      dryGain.connect(masterGain)

      // Wet signals
      delay1.connect(delay1Gain)
      delay1Gain.connect(delayFilter)
      delay2.connect(delay2Gain)
      delay2Gain.connect(delayFilter)
      delayFilter.connect(masterGain)

      // Mix node — notes go here, split to dry + delays
      const mixNode = ctx.createGain()
      mixNode.gain.value = 1
      mixNode.connect(dryGain)
      mixNode.connect(delay1)
      mixNode.connect(delay2)

      // Subtle room noise underneath
      const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = i === 0
          ? (Math.random() * 2 - 1) * 0.01
          : noiseData[i - 1] + (Math.random() * 2 - 1) * 0.015
        noiseData[i] = Math.max(-1, Math.min(1, noiseData[i]))
      }
      const noiseSource = ctx.createBufferSource()
      noiseSource.buffer = noiseBuffer
      noiseSource.loop = true
      const noiseFilter = ctx.createBiquadFilter()
      noiseFilter.type = 'lowpass'
      noiseFilter.frequency.value = 100
      const noiseGain = ctx.createGain()
      noiseGain.gain.value = 0.003
      noiseSource.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterGain)
      noiseSource.start()

      // Start playing
      playingRef.current = true
      masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      playBass(ctx, mixNode)
      playMelody(ctx, mixNode)
    } else {
      const ctx = audioContextRef.current
      ctx.resume()
      playingRef.current = true
      if (masterGainRef.current) {
        masterGainRef.current.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      }
      const mixNodes = ctx.destination
      // Restart sequences
      playBass(ctx, ctx.destination)
      playMelody(ctx, ctx.destination)
    }
  }, [playBass, playMelody])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // Fade out
      playingRef.current = false
      if (bassTimeoutRef.current) clearTimeout(bassTimeoutRef.current)
      if (melodyTimeoutRef.current) clearTimeout(melodyTimeoutRef.current)
      const ctx = audioContextRef.current
      if (ctx && masterGainRef.current) {
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)
        setTimeout(() => ctx.suspend(), 2200)
      }
      setIsPlaying(false)
    } else {
      initAndPlay()
      setIsPlaying(true)
    }
  }, [isPlaying, initAndPlay])

  // Cleanup
  useEffect(() => {
    return () => {
      playingRef.current = false
      if (bassTimeoutRef.current) clearTimeout(bassTimeoutRef.current)
      if (melodyTimeoutRef.current) clearTimeout(melodyTimeoutRef.current)
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [])

  return (
    <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3">
      <button
        onClick={togglePlay}
        className="relative w-10 h-10 rounded-full border flex items-center justify-center transition-all duration-500 hover:scale-110"
        style={{
          borderColor: isPlaying ? theme.accent : `${theme.accentMuted}60`,
          background: isPlaying ? `${theme.accent}15` : 'rgba(10,10,10,0.6)',
          backdropFilter: 'blur(8px)',
        }}
        data-cursor-type="clickable"
        aria-label={isPlaying ? 'Pause music' : 'Play music'}
      >
        {isPlaying ? (
          <div className="flex items-center gap-[2px]">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ height: [4, 12, 4] }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
                }}
                className="w-[1.5px] rounded-full"
                style={{ background: theme.accent }}
              />
            ))}
          </div>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.accentMuted} strokeWidth="1.5">
            <path d="M9 18V5l12 7-12 7z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Label */}
      <AnimatePresence>
        {showHint && !isPlaying && (
          <motion.span
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="font-mono text-[9px] tracking-wider"
            style={{ color: `${theme.accentMuted}80` }}
          >
            GNOSSIENNE NO.1
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
