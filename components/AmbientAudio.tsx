'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'
import Soundfont from 'soundfont-player'

// Satie — Gnossienne No.1 (public domain)
// Encoded as [note, duration in beats] pairs
// '' = rest

const TEMPO = 0.7 // seconds per beat — slow, contemplative

// Bass ostinato pattern (left hand) — repeating F minor arpeggio
const BASS_PATTERN: [string, number][] = [
  ['F2', 1],
  ['C3', 1],
  ['F3', 1],
  ['Ab3', 1],
  ['F3', 1],
  ['C3', 1],
]

// Melody phrases (right hand) — the haunting Gnossienne theme
const MELODY_PHRASE_1: [string, number][] = [
  ['', 6],          // Rest — let bass establish
  ['', 6],          // Another bar of bass alone
  ['Bb4', 3],       // The iconic opening note, held
  ['Ab4', 1],
  ['G4', 1],
  ['F4', 1],
  ['Eb4', 2],
  ['F4', 2],
  ['', 2],          // Brief pause
  ['Bb4', 3],
  ['Ab4', 1],
  ['G4', 1],
  ['F4', 1],
  ['F4', 2],        // Held
  ['Eb4', 2],
  ['Db4', 2],
]

const MELODY_PHRASE_2: [string, number][] = [
  ['Eb4', 3],
  ['F4', 1],
  ['Ab4', 1],
  ['G4', 1],
  ['F4', 2],
  ['Eb4', 2],
  ['Db4', 2],
  ['C4', 3],
  ['Db4', 1],
  ['Eb4', 2],
  ['F4', 3],        // Resolving
  ['', 3],          // Rest
]

const MELODY_PHRASE_3: [string, number][] = [
  ['C5', 3],        // Higher register, building
  ['Bb4', 1],
  ['Ab4', 1],
  ['G4', 1],
  ['Ab4', 2],
  ['Bb4', 2],
  ['Ab4', 2],
  ['G4', 1],
  ['F4', 1],
  ['Eb4', 2],
  ['Db4', 2],
  ['C4', 3],
  ['', 4],          // Long rest before repeat
]

const FULL_MELODY = [...MELODY_PHRASE_1, ...MELODY_PHRASE_2, ...MELODY_PHRASE_3]

interface AmbientAudioProps {
  autoPlay?: boolean
}

export default function AmbientAudio({ autoPlay = false }: AmbientAudioProps) {
  const { theme } = useTimeTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const hasAutoPlayed = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const mixNodeRef = useRef<GainNode | null>(null)
  const pianoRef = useRef<any>(null)
  const playingRef = useRef(false)
  const initializingRef = useRef(false)
  const bassTimeoutRef = useRef<NodeJS.Timeout>()
  const melodyTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Schedule the bass loop
  const startBass = useCallback((piano: any, ctx: AudioContext) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return

      const [note, dur] = BASS_PATTERN[noteIndex % BASS_PATTERN.length]
      if (note) {
        piano.play(note, ctx.currentTime, {
          duration: dur * TEMPO * 0.9,
          gain: 0.35,
        })
      }
      noteIndex++
      bassTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }

    scheduleNext()
  }, [])

  // Schedule the melody loop
  const startMelody = useCallback((piano: any, ctx: AudioContext) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return

      const [note, dur] = FULL_MELODY[noteIndex % FULL_MELODY.length]
      if (note) {
        piano.play(note, ctx.currentTime, {
          duration: dur * TEMPO * 0.85,
          gain: 0.55,
        })
      }
      noteIndex++
      melodyTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }

    scheduleNext()
  }, [])

  const initAudioGraph = useCallback(() => {
    const ctx = new AudioContext()
    audioContextRef.current = ctx

    // Master gain for fade in/out
    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain

    // Reverb via delay lines
    const delay1 = ctx.createDelay(1)
    delay1.delayTime.value = 0.15
    const delay1Gain = ctx.createGain()
    delay1Gain.gain.value = 0.18

    const delay2 = ctx.createDelay(1)
    delay2.delayTime.value = 0.35
    const delay2Gain = ctx.createGain()
    delay2Gain.gain.value = 0.08

    const delayFilter = ctx.createBiquadFilter()
    delayFilter.type = 'lowpass'
    delayFilter.frequency.value = 1500
    delayFilter.Q.value = 0.3

    // Dry signal
    const dryGain = ctx.createGain()
    dryGain.gain.value = 0.75
    dryGain.connect(masterGain)

    // Wet signals
    delay1.connect(delay1Gain)
    delay1Gain.connect(delayFilter)
    delay2.connect(delay2Gain)
    delay2Gain.connect(delayFilter)
    delayFilter.connect(masterGain)

    // Mix node — piano goes here, splits to dry + delays
    const mixNode = ctx.createGain()
    mixNode.gain.value = 1
    mixNode.connect(dryGain)
    mixNode.connect(delay1)
    mixNode.connect(delay2)
    mixNodeRef.current = mixNode

    return { ctx, masterGain, mixNode }
  }, [])

  const initAndPlay = useCallback(async () => {
    // Prevent double-init
    if (initializingRef.current) return
    initializingRef.current = true

    try {
      let ctx = audioContextRef.current
      let piano = pianoRef.current

      if (!ctx) {
        // First time — build the audio graph
        const graph = initAudioGraph()
        ctx = graph.ctx

        // Load real piano samples — connects directly to our mix node
        piano = await Soundfont.instrument(ctx, 'acoustic_grand_piano', {
          destination: graph.mixNode,
        })
        pianoRef.current = piano

        // Fade in
        graph.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      } else {
        // Resume existing context
        await ctx.resume()
        if (masterGainRef.current) {
          masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
          masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
          masterGainRef.current.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
        }
      }

      if (!piano) {
        console.warn('Piano failed to load')
        initializingRef.current = false
        return
      }

      // Start the sequences
      playingRef.current = true
      startBass(piano, ctx)
      startMelody(piano, ctx)
    } catch (err) {
      console.error('Audio init failed:', err)
    } finally {
      initializingRef.current = false
    }
  }, [initAudioGraph, startBass, startMelody])

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      // Stop
      playingRef.current = false
      if (bassTimeoutRef.current) clearTimeout(bassTimeoutRef.current)
      if (melodyTimeoutRef.current) clearTimeout(melodyTimeoutRef.current)
      const ctx = audioContextRef.current
      if (ctx && masterGainRef.current) {
        masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
        masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
        masterGainRef.current.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)
        setTimeout(() => ctx.suspend(), 2200)
      }
      setIsPlaying(false)
    } else {
      initAndPlay()
      setIsPlaying(true)
    }
  }, [isPlaying, initAndPlay])

  // Auto-play when entering gallery
  useEffect(() => {
    if (autoPlay && !hasAutoPlayed.current && !isPlaying) {
      hasAutoPlayed.current = true
      initAndPlay()
      setIsPlaying(true)
    }
  }, [autoPlay, isPlaying, initAndPlay])

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
