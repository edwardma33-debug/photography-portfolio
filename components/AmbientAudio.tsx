'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'

// Satie — Gnossienne No.1 (public domain)
// Notes as [noteName, duration in beats]
// '' = rest

const TEMPO = 0.7 // seconds per beat

// Bass ostinato (left hand) — F minor arpeggio
const BASS_PATTERN: [string, number][] = [
  ['F2', 1], ['C3', 1], ['F3', 1], ['Ab3', 1], ['F3', 1], ['C3', 1],
]

// Melody phrases (right hand)
const MELODY_PHRASE_1: [string, number][] = [
  ['', 6], ['', 6],
  ['Bb4', 3], ['Ab4', 1], ['G4', 1], ['F4', 1],
  ['Eb4', 2], ['F4', 2], ['', 2],
  ['Bb4', 3], ['Ab4', 1], ['G4', 1], ['F4', 1],
  ['F4', 2], ['Eb4', 2], ['Db4', 2],
]

const MELODY_PHRASE_2: [string, number][] = [
  ['Eb4', 3], ['F4', 1], ['Ab4', 1], ['G4', 1],
  ['F4', 2], ['Eb4', 2], ['Db4', 2],
  ['C4', 3], ['Db4', 1], ['Eb4', 2],
  ['F4', 3], ['', 3],
]

const MELODY_PHRASE_3: [string, number][] = [
  ['C5', 3], ['Bb4', 1], ['Ab4', 1], ['G4', 1],
  ['Ab4', 2], ['Bb4', 2], ['Ab4', 2],
  ['G4', 1], ['F4', 1], ['Eb4', 2],
  ['Db4', 2], ['C4', 3], ['', 4],
]

const FULL_MELODY = [...MELODY_PHRASE_1, ...MELODY_PHRASE_2, ...MELODY_PHRASE_3]

// All unique notes we need to load
const ALL_NOTES = Array.from(new Set([
  ...BASS_PATTERN.map(([n]) => n),
  ...FULL_MELODY.map(([n]) => n),
].filter(Boolean)))

// Soundfont CDN base
const SF_BASE = 'https://gleitz.github.io/midi-js-soundfonts/MusyngKite/acoustic_grand_piano-mp3.js'

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

  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Load piano samples from soundfont CDN
  const loadSamples = useCallback(async (ctx: AudioContext) => {
    if (Object.keys(buffersRef.current).length > 0) return buffersRef.current

    // Fetch the soundfont JS file — it's a script that sets MIDI.Soundfont.acoustic_grand_piano
    const response = await fetch(SF_BASE)
    const text = await response.text()

    // Parse the base64 audio data from the JS file
    // Format: MIDI.Soundfont.acoustic_grand_piano={note:"data:audio/mp3;base64,...", ...}
    // Extract the object between first { and last }
    const startIdx = text.indexOf('{')
    const endIdx = text.lastIndexOf('}')
    if (startIdx === -1 || endIdx === -1) throw new Error('Failed to parse soundfont')
    const objStr = text.slice(startIdx + 1, endIdx)

    const noteData: Record<string, string> = {}
    // Match each "noteName":"dataUri" pair — values contain special chars so we match quoted strings carefully
    const regex = /"([A-Ga-g][b#]?\d)"\s*:\s*"(data:audio[^"]+)"/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(objStr)) !== null) {
      noteData[m[1]] = m[2]
    }

    // Decode only the notes we need
    const buffers: Record<string, AudioBuffer> = {}
    await Promise.all(ALL_NOTES.map(async (note) => {
      const dataUri = noteData[note]
      if (!dataUri) {
        console.warn(`Note ${note} not found in soundfont`)
        return
      }
      // Extract base64 data from data URI
      const base64 = dataUri.split(',')[1]
      if (!base64) return

      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0))
      buffers[note] = audioBuffer
    }))

    buffersRef.current = buffers
    return buffers
  }, [])

  // Play a single note sample
  const playNote = useCallback((
    ctx: AudioContext,
    destination: AudioNode,
    note: string,
    duration: number,
    gain: number,
  ) => {
    if (!note) return
    const buffer = buffersRef.current[note]
    if (!buffer) return

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const gainNode = ctx.createGain()
    const now = ctx.currentTime
    const noteLen = duration * TEMPO

    gainNode.gain.setValueAtTime(gain, now)
    // Gentle release at the end
    gainNode.gain.setValueAtTime(gain, now + noteLen * 0.7)
    gainNode.gain.linearRampToValueAtTime(0, now + noteLen)

    source.connect(gainNode)
    gainNode.connect(destination)
    source.start(now)
    source.stop(now + noteLen + 0.05)
  }, [])

  // Schedule bass loop
  const startBass = useCallback((ctx: AudioContext, dest: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return
      const [note, dur] = BASS_PATTERN[noteIndex % BASS_PATTERN.length]
      playNote(ctx, dest, note, dur, 0.3)
      noteIndex++
      bassTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }
    scheduleNext()
  }, [playNote])

  // Schedule melody loop
  const startMelody = useCallback((ctx: AudioContext, dest: AudioNode) => {
    let noteIndex = 0

    const scheduleNext = () => {
      if (!playingRef.current) return
      const [note, dur] = FULL_MELODY[noteIndex % FULL_MELODY.length]
      playNote(ctx, dest, note, dur, 0.5)
      noteIndex++
      melodyTimeoutRef.current = setTimeout(scheduleNext, dur * TEMPO * 1000)
    }
    scheduleNext()
  }, [playNote])

  const initAudioGraph = useCallback(() => {
    // Use shared context (created during user gesture on mobile) or create new
    const ctx = sharedAudioContext || new AudioContext()
    audioContextRef.current = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0
    masterGain.connect(ctx.destination)
    masterGainRef.current = masterGain

    // Delay-based reverb
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

    const dryGain = ctx.createGain()
    dryGain.gain.value = 0.75
    dryGain.connect(masterGain)

    delay1.connect(delay1Gain)
    delay1Gain.connect(delayFilter)
    delay2.connect(delay2Gain)
    delay2Gain.connect(delayFilter)
    delayFilter.connect(masterGain)

    const mixNode = ctx.createGain()
    mixNode.gain.value = 1
    mixNode.connect(dryGain)
    mixNode.connect(delay1)
    mixNode.connect(delay2)
    mixNodeRef.current = mixNode

    return { ctx, masterGain, mixNode }
  }, [sharedAudioContext])

  const initAndPlay = useCallback(async () => {
    if (initializingRef.current) return
    initializingRef.current = true

    try {
      let ctx = audioContextRef.current

      if (!ctx) {
        const graph = initAudioGraph()
        ctx = graph.ctx

        // Load real piano samples
        await loadSamples(ctx)

        // Fade in
        playingRef.current = true
        graph.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
        startBass(ctx, graph.mixNode)
        startMelody(ctx, graph.mixNode)
      } else {
        await ctx.resume()
        playingRef.current = true
        if (masterGainRef.current) {
          masterGainRef.current.gain.cancelScheduledValues(ctx.currentTime)
          masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, ctx.currentTime)
          masterGainRef.current.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
        }
        if (mixNodeRef.current) {
          startBass(ctx, mixNodeRef.current)
          startMelody(ctx, mixNodeRef.current)
        }
      }
    } catch (err) {
      console.error('Audio init failed:', err)
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
