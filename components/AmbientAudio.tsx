'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'

// Satie — Gnossienne No.1 (public domain)
// Encoded as [note, beats, velocity (0-1), rubato (timing stretch)]
// '' = rest. Velocity and rubato give each note human expression.

const TEMPO = 0.8 // seconds per beat — slightly slower, more contemplative

// Bass ostinato (left hand) — gentle, rolling F minor arpeggio
// Lower velocity, each note slightly different weight
const BASS_PATTERN: [string, number, number, number][] = [
  ['F2',  1, 0.22, 1.0],
  ['C3',  1, 0.18, 0.97],
  ['F3',  1, 0.20, 1.0],
  ['Ab3', 1, 0.17, 1.03],  // linger slightly
  ['F3',  1, 0.19, 0.98],
  ['C3',  1, 0.16, 1.02],  // softest, slight rubato
]

// Melody with dynamic shaping — velocity creates natural phrasing
// Rubato > 1 = linger, < 1 = push forward
const MELODY_PHRASE_1: [string, number, number, number][] = [
  ['', 6, 0, 1.0],           // Rest — bass alone
  ['', 6, 0, 1.0],           // Another bar
  ['Bb4', 3, 0.52, 1.08],    // Opening — tender, lingering
  ['Ab4', 1, 0.40, 0.95],    // descending, softer
  ['G4',  1, 0.38, 0.93],    // pushing forward
  ['F4',  1, 0.35, 1.0],
  ['Eb4', 2, 0.42, 1.05],    // slight emphasis, breathe
  ['F4',  2, 0.38, 1.0],
  ['', 2, 0, 1.15],          // Longer pause — breathing
  ['Bb4', 3, 0.55, 1.06],    // Return — slightly louder
  ['Ab4', 1, 0.42, 0.96],
  ['G4',  1, 0.40, 0.94],
  ['F4',  1, 0.36, 1.0],
  ['F4',  2, 0.38, 1.04],    // held, gentle
  ['Eb4', 2, 0.34, 1.0],     // fading
  ['Db4', 2, 0.30, 1.10],    // softest, ritardando
]

const MELODY_PHRASE_2: [string, number, number, number][] = [
  ['Eb4', 3, 0.44, 1.04],    // New phrase — slightly brighter
  ['F4',  1, 0.40, 0.96],
  ['Ab4', 1, 0.48, 0.94],    // climbing, more energy
  ['G4',  1, 0.44, 1.0],
  ['F4',  2, 0.40, 1.02],
  ['Eb4', 2, 0.36, 1.0],     // settling
  ['Db4', 2, 0.32, 1.06],    // gentle
  ['C4',  3, 0.45, 1.08],    // arrival point — warm
  ['Db4', 1, 0.35, 0.97],
  ['Eb4', 2, 0.38, 1.0],
  ['F4',  3, 0.42, 1.12],    // resolving — linger
  ['', 3, 0, 1.2],           // Long breath
]

const MELODY_PHRASE_3: [string, number, number, number][] = [
  ['C5',  3, 0.58, 1.06],    // Climax — highest, strongest
  ['Bb4', 1, 0.50, 0.95],    // cascading down
  ['Ab4', 1, 0.46, 0.93],
  ['G4',  1, 0.42, 1.0],
  ['Ab4', 2, 0.44, 1.04],    // slight swell
  ['Bb4', 2, 0.48, 1.02],
  ['Ab4', 2, 0.40, 1.0],
  ['G4',  1, 0.36, 0.98],    // diminuendo
  ['F4',  1, 0.33, 0.96],
  ['Eb4', 2, 0.30, 1.04],    // very soft
  ['Db4', 2, 0.26, 1.08],    // almost whispering
  ['C4',  3, 0.32, 1.15],    // final note — long ritardando
  ['', 4, 0, 1.3],           // Very long pause before repeat
]

const FULL_MELODY = [...MELODY_PHRASE_1, ...MELODY_PHRASE_2, ...MELODY_PHRASE_3]

// All unique notes
const ALL_NOTES = Array.from(new Set([
  ...BASS_PATTERN.map(([n]) => n),
  ...FULL_MELODY.map(([n]) => n),
].filter(Boolean)))

const NOTE_URL_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3'

interface AmbientAudioProps {
  autoPlay?: boolean
  sharedAudioContext?: AudioContext | null
}

export default function AmbientAudio({ autoPlay = false, sharedAudioContext = null }: AmbientAudioProps) {
  const { theme } = useTimeTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const hasAutoPlayed = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const mixNodeRef = useRef<GainNode | null>(null)
  const buffersRef = useRef<Record<string, AudioBuffer>>({})
  const playingRef = useRef(false)
  const initializingRef = useRef(false)
  const bassTimeoutRef = useRef<NodeJS.Timeout>()
  const melodyTimeoutRef = useRef<NodeJS.Timeout>()
  const sharedCtxRef = useRef(sharedAudioContext)
  sharedCtxRef.current = sharedAudioContext

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Load individual piano samples
  const loadSamples = useCallback(async (ctx: AudioContext) => {
    if (Object.keys(buffersRef.current).length === ALL_NOTES.length) return buffersRef.current

    const buffers: Record<string, AudioBuffer> = {}

    await Promise.all(ALL_NOTES.map(async (note) => {
      if (buffersRef.current[note]) {
        buffers[note] = buffersRef.current[note]
        return
      }
      try {
        const url = `${NOTE_URL_BASE}/${encodeURIComponent(note)}.mp3`
        const response = await fetch(url)
        if (!response.ok) return
        const arrayBuffer = await response.arrayBuffer()
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
        buffers[note] = audioBuffer
      } catch (err) {
        console.warn(`Failed to load note ${note}:`, err)
      }
    }))

    buffersRef.current = buffers
    return buffers
  }, [])

  // Play a note like a concert pianist — with sustain pedal, dynamic touch, humanized timing
  const playNote = useCallback((
    ctx: AudioContext,
    destination: AudioNode,
    note: string,
    duration: number,
    velocity: number,
    isBass: boolean,
  ) => {
    if (!note || velocity === 0) return
    const buffer = buffersRef.current[note]
    if (!buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gainNode = ctx.createGain()
    const now = ctx.currentTime
    const noteLen = duration * TEMPO

    // Humanize velocity slightly (±8%)
    const humanVel = velocity * (0.92 + Math.random() * 0.16)

    // Sustain pedal: notes ring 5-8 seconds, creating a wash of sound
    const sustainTime = isBass ? 6.0 : 5.0
    // Let the actual sample play for its full natural length
    const ringTime = Math.min(buffer.duration, noteLen + sustainTime)

    // Concert piano dynamics:
    // - Soft attack (real hammers don't click)
    // - Natural sustain at played velocity
    // - Very gradual fade following the piano's natural decay
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(humanVel, now + 0.015) // fast but soft attack
    // Let the sample's own decay handle most of the envelope
    // Just add a gentle overall fade so notes don't linger forever
    gainNode.gain.setValueAtTime(humanVel, now + noteLen * 0.5)
    gainNode.gain.exponentialRampToValueAtTime(humanVel * 0.6, now + noteLen * 1.2)
    gainNode.gain.exponentialRampToValueAtTime(humanVel * 0.15, now + ringTime * 0.7)
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + ringTime)

    source.connect(gainNode)
    gainNode.connect(destination)
    source.start(now)
    source.stop(now + ringTime + 0.1)
  }, [])

  // Schedule bass with humanized timing
  const startBass = useCallback((ctx: AudioContext, dest: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return
      const [note, dur, vel, rubato] = BASS_PATTERN[noteIndex % BASS_PATTERN.length]

      playNote(ctx, dest, note, dur, vel, true)
      noteIndex++

      // Humanize timing: rubato + slight random variation (±30ms)
      const humanDelay = dur * TEMPO * rubato * 1000 + (Math.random() - 0.5) * 60
      bassTimeoutRef.current = setTimeout(scheduleNext, Math.max(100, humanDelay))
    }
    scheduleNext()
  }, [playNote])

  // Schedule melody with expressive timing
  const startMelody = useCallback((ctx: AudioContext, dest: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return
      const [note, dur, vel, rubato] = FULL_MELODY[noteIndex % FULL_MELODY.length]

      playNote(ctx, dest, note, dur, vel, false)
      noteIndex++

      // More rubato in melody — real pianists stretch time expressively
      // Add ±50ms humanization
      const humanDelay = dur * TEMPO * rubato * 1000 + (Math.random() - 0.5) * 100
      melodyTimeoutRef.current = setTimeout(scheduleNext, Math.max(100, humanDelay))
    }
    scheduleNext()
  }, [playNote])

  const initAudioGraph = useCallback((ctxOverride?: AudioContext | null) => {
    const ctx = ctxOverride || new AudioContext()
    audioContextRef.current = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.setValueAtTime(0, ctx.currentTime)
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain

    // Concert hall reverb — 4 delay taps at different times
    const reverbFilter = ctx.createBiquadFilter()
    reverbFilter.type = 'lowpass'
    reverbFilter.frequency.value = 2000
    reverbFilter.Q.value = 0.3
    reverbFilter.connect(masterGain)

    // Dry signal
    const dryGain = ctx.createGain()
    dryGain.gain.value = 0.55
    dryGain.connect(masterGain)

    // Mix node — all notes go here, splits to dry + reverb taps
    const mixNode = ctx.createGain()
    mixNode.gain.value = 1
    mixNode.connect(dryGain)

    // Create reverb delay network from mix node
    const taps = [
      { time: 0.12, gain: 0.22 },  // early reflection
      { time: 0.28, gain: 0.16 },  // mid
      { time: 0.48, gain: 0.11 },  // late
      { time: 0.75, gain: 0.07 },  // very late — concert hall depth
    ]

    taps.forEach(({ time, gain: g }) => {
      const delay = ctx.createDelay(1)
      delay.delayTime.value = time
      const tapGain = ctx.createGain()
      tapGain.gain.value = g
      mixNode.connect(delay)
      delay.connect(tapGain)
      tapGain.connect(reverbFilter)
    })

    mixNodeRef.current = mixNode

    return { ctx, masterGain, mixNode }
  }, [])

  const initAndPlay = useCallback(async () => {
    if (initializingRef.current) return
    initializingRef.current = true

    try {
      let ctx = audioContextRef.current

      if (!ctx) {
        const graph = initAudioGraph(sharedCtxRef.current)
        ctx = graph.ctx

        if (ctx.state === 'suspended') {
          await ctx.resume()
        }
        if (ctx.state === 'suspended') {
          initializingRef.current = false
          return false
        }

        await loadSamples(ctx)

        playingRef.current = true
        graph.masterGain.gain.setValueAtTime(0, ctx.currentTime)
        graph.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 4) // slower fade in
        startBass(ctx, graph.mixNode)
        startMelody(ctx, graph.mixNode)
      } else {
        if (ctx.state === 'suspended') {
          await ctx.resume()
        }
        await loadSamples(ctx)

        playingRef.current = true
        if (masterGainRef.current) {
          masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
          masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
          masterGainRef.current.gain.linearRampToValueAtTime(1, ctx.currentTime + 4)
        }
        if (mixNodeRef.current) {
          startBass(ctx, mixNodeRef.current)
          startMelody(ctx, mixNodeRef.current)
        }
      }
      return true
    } catch (err) {
      console.error('Audio init failed:', err)
      return false
    } finally {
      initializingRef.current = false
    }
  }, [initAudioGraph, loadSamples, startBass, startMelody])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      playingRef.current = false
      if (bassTimeoutRef.current) clearTimeout(bassTimeoutRef.current)
      if (melodyTimeoutRef.current) clearTimeout(melodyTimeoutRef.current)
      const ctx = audioContextRef.current
      if (ctx && masterGainRef.current) {
        masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
        masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 3) // slower fade out
        setTimeout(() => ctx.suspend(), 3500)
      }
      setIsPlaying(false)
    } else {
      initAndPlay().then((started) => {
        if (started) setIsPlaying(true)
      })
    }
  }, [isPlaying, initAndPlay])

  // Auto-play when entering gallery
  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current && !isPlaying) {
      hasAutoPlayed.current = true
      initAndPlay().then((started) => {
        if (started) setIsPlaying(true)
      })
    }
  }, [autoPlay, isPlaying, initAndPlay])

  // Cleanup
  useEffect(() => {
    return () => {
      playingRef.current = false
      if (bassTimeoutRef.current) clearTimeout(bassTimeoutRef.current)
      if (melodyTimeoutRef.current) clearTimeout(melodyTimeoutRef.current)
      if (audioContextRef.current && !sharedCtxRef.current) {
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

      <AnimatePresence>
        {showHint && (
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
