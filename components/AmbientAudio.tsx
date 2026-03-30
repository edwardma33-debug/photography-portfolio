'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'

export default function AmbientAudio() {
  const { theme, period } = useTimeTheme()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [showHint, setShowHint] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<{
    masterGain: GainNode
    pad1: OscillatorNode
    pad2: OscillatorNode
    pad3: OscillatorNode
    lfo: OscillatorNode
    noiseGain: GainNode
    noiseSource: AudioBufferSourceNode | null
    filter: BiquadFilterNode
  } | null>(null)

  // Hide hint after 8 seconds
  useEffect(() => {
    const timer = setTimeout(() => setShowHint(false), 8000)
    return () => clearTimeout(timer)
  }, [])

  // Get frequencies based on time period — different moods for different times
  const getFrequencies = useCallback((p: string) => {
    switch (p) {
      case 'dawn':
        return { f1: 65.41, f2: 98.00, f3: 130.81, filterFreq: 400, noiseVol: 0.008 }    // C2, G2, C3 — hopeful
      case 'morning':
        return { f1: 73.42, f2: 110.00, f3: 146.83, filterFreq: 500, noiseVol: 0.006 }    // D2, A2, D3 — bright
      case 'midday':
        return { f1: 82.41, f2: 123.47, f3: 164.81, filterFreq: 600, noiseVol: 0.005 }    // E2, B2, E3 — clear
      case 'afternoon':
        return { f1: 73.42, f2: 110.00, f3: 146.83, filterFreq: 450, noiseVol: 0.006 }    // D2, A2, D3 — warm
      case 'golden':
        return { f1: 65.41, f2: 82.41, f3: 130.81, filterFreq: 350, noiseVol: 0.008 }     // C2, E2, C3 — golden
      case 'sunset':
        return { f1: 61.74, f2: 92.50, f3: 123.47, filterFreq: 300, noiseVol: 0.009 }     // B1, Gb2, B2 — melancholic
      case 'blueHour':
        return { f1: 55.00, f2: 82.41, f3: 110.00, filterFreq: 280, noiseVol: 0.010 }     // A1, E2, A2 — contemplative
      case 'night':
      default:
        return { f1: 49.00, f2: 73.42, f3: 98.00, filterFreq: 250, noiseVol: 0.012 }      // G1, D2, G2 — deep, quiet
    }
  }, [])

  const initAudio = useCallback(() => {
    if (audioContextRef.current) return

    const ctx = new AudioContext()
    audioContextRef.current = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.value = 0 // Start silent, fade in
    masterGain.connect(ctx.destination)

    const freqs = getFrequencies(period)

    // Low-pass filter for warmth
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freqs.filterFreq
    filter.Q.value = 0.7
    filter.connect(masterGain)

    // Pad oscillators — sine waves for pure, meditative tones
    const createPad = (freq: number, detune: number = 0): OscillatorNode => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.detune.value = detune

      const gain = ctx.createGain()
      gain.gain.value = 0.06

      osc.connect(gain)
      gain.connect(filter)
      osc.start()
      return osc
    }

    const pad1 = createPad(freqs.f1, -3)  // Slight detune for warmth
    const pad2 = createPad(freqs.f2, 5)
    const pad3 = createPad(freqs.f3, -2)

    // LFO for gentle movement — modulates filter frequency
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.05 // Very slow oscillation
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 50 // Subtle filter movement
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    // Filtered noise — room tone / atmosphere
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) {
      noiseData[i] = (Math.random() * 2 - 1) * 0.5
    }

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer
    noiseSource.loop = true

    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'lowpass'
    noiseFilter.frequency.value = 200 // Very muffled
    noiseFilter.Q.value = 0.5

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = freqs.noiseVol

    noiseSource.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(masterGain)
    noiseSource.start()

    nodesRef.current = {
      masterGain,
      pad1,
      pad2,
      pad3,
      lfo,
      noiseGain,
      noiseSource,
      filter,
    }

    setIsInitialized(true)
  }, [period, getFrequencies])

  // Fade in/out
  const togglePlay = useCallback(() => {
    if (!isInitialized) {
      initAudio()
    }

    const ctx = audioContextRef.current
    const nodes = nodesRef.current
    if (!ctx || !nodes) {
      // First time — init then play
      initAudio()
      setTimeout(() => {
        const ctx2 = audioContextRef.current
        const nodes2 = nodesRef.current
        if (ctx2 && nodes2) {
          ctx2.resume()
          nodes2.masterGain.gain.linearRampToValueAtTime(1, ctx2.currentTime + 3)
          setIsPlaying(true)
        }
      }, 100)
      return
    }

    if (isPlaying) {
      // Fade out over 2 seconds
      nodes.masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2)
      setTimeout(() => ctx.suspend(), 2100)
      setIsPlaying(false)
    } else {
      // Fade in over 3 seconds
      ctx.resume()
      nodes.masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 3)
      setIsPlaying(true)
    }
  }, [isPlaying, isInitialized, initAudio])

  // Update frequencies when time period changes
  useEffect(() => {
    const nodes = nodesRef.current
    const ctx = audioContextRef.current
    if (!nodes || !ctx || !isPlaying) return

    const freqs = getFrequencies(period)
    const t = ctx.currentTime + 10 // Transition over 10 seconds

    nodes.pad1.frequency.linearRampToValueAtTime(freqs.f1, t)
    nodes.pad2.frequency.linearRampToValueAtTime(freqs.f2, t)
    nodes.pad3.frequency.linearRampToValueAtTime(freqs.f3, t)
    nodes.filter.frequency.linearRampToValueAtTime(freqs.filterFreq, t)
    nodes.noiseGain.gain.linearRampToValueAtTime(freqs.noiseVol, t)
  }, [period, isPlaying, getFrequencies])

  // Cleanup
  useEffect(() => {
    return () => {
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
        aria-label={isPlaying ? 'Mute ambient sound' : 'Play ambient sound'}
      >
        {/* Sound wave animation when playing */}
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
            <path d="M11 5L6 9H2v6h4l5 4V5z" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="23" y1="9" x2="17" y2="15" strokeLinecap="round" />
            <line x1="17" y1="9" x2="23" y2="15" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {/* Hint text — fades away */}
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
            AMBIENT
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}
