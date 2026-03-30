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

  // Get frequencies based on time period — very low, barely audible undertones
  const getFrequencies = useCallback((p: string) => {
    // All frequencies are sub-bass to low range — felt more than heard
    switch (p) {
      case 'dawn':
        return { f1: 40, f2: 60, f3: 80, filterFreq: 120, noiseVol: 0.004, padVol: 0.015 }
      case 'morning':
        return { f1: 45, f2: 67, f3: 90, filterFreq: 140, noiseVol: 0.003, padVol: 0.012 }
      case 'midday':
        return { f1: 50, f2: 75, f3: 100, filterFreq: 150, noiseVol: 0.002, padVol: 0.010 }
      case 'afternoon':
        return { f1: 45, f2: 67, f3: 90, filterFreq: 130, noiseVol: 0.003, padVol: 0.012 }
      case 'golden':
        return { f1: 40, f2: 55, f3: 80, filterFreq: 110, noiseVol: 0.004, padVol: 0.015 }
      case 'sunset':
        return { f1: 38, f2: 52, f3: 76, filterFreq: 100, noiseVol: 0.005, padVol: 0.015 }
      case 'blueHour':
        return { f1: 35, f2: 50, f3: 70, filterFreq: 90, noiseVol: 0.005, padVol: 0.018 }
      case 'night':
      default:
        return { f1: 32, f2: 48, f3: 64, filterFreq: 80, noiseVol: 0.006, padVol: 0.020 }
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

    // Heavy low-pass filter — cuts everything harsh
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = freqs.filterFreq
    filter.Q.value = 0.3 // Very gentle roll-off, no resonance
    filter.connect(masterGain)

    // Second filter stage for extra smoothness
    const filter2 = ctx.createBiquadFilter()
    filter2.type = 'lowpass'
    filter2.frequency.value = freqs.filterFreq * 1.5
    filter2.Q.value = 0.3
    filter2.connect(filter)

    // Pad oscillators — sub-bass sine waves, barely audible
    const createPad = (freq: number, detune: number = 0): OscillatorNode => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.detune.value = detune

      const gain = ctx.createGain()
      gain.gain.value = freqs.padVol // Much quieter

      osc.connect(gain)
      gain.connect(filter2)
      osc.start()
      return osc
    }

    const pad1 = createPad(freqs.f1, -2)
    const pad2 = createPad(freqs.f2, 3)
    const pad3 = createPad(freqs.f3, -1)

    // Very slow LFO — gentle breathing, not wobble
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.02 // One cycle every 50 seconds
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 15 // Very subtle filter movement
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    // Filtered noise — like air conditioning hum, room presence
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 6, ctx.sampleRate)
    const noiseData = noiseBuffer.getChannelData(0)
    for (let i = 0; i < noiseData.length; i++) {
      // Brown noise (smoother than white) — integrate white noise
      noiseData[i] = i === 0
        ? (Math.random() * 2 - 1) * 0.01
        : noiseData[i - 1] + (Math.random() * 2 - 1) * 0.02
      // Clamp to prevent drift
      noiseData[i] = Math.max(-1, Math.min(1, noiseData[i]))
    }

    const noiseSource = ctx.createBufferSource()
    noiseSource.buffer = noiseBuffer
    noiseSource.loop = true

    // Triple-filtered noise for extreme softness
    const noiseFilter1 = ctx.createBiquadFilter()
    noiseFilter1.type = 'lowpass'
    noiseFilter1.frequency.value = 80
    noiseFilter1.Q.value = 0.2

    const noiseFilter2 = ctx.createBiquadFilter()
    noiseFilter2.type = 'lowpass'
    noiseFilter2.frequency.value = 120
    noiseFilter2.Q.value = 0.2

    const noiseGain = ctx.createGain()
    noiseGain.gain.value = freqs.noiseVol

    noiseSource.connect(noiseFilter1)
    noiseFilter1.connect(noiseFilter2)
    noiseFilter2.connect(noiseGain)
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
    const t = ctx.currentTime + 20 // Very slow transition over 20 seconds

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
