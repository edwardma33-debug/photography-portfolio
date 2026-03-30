'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Time periods with smooth gradient transitions
interface TimeTheme {
  period: 'dawn' | 'morning' | 'midday' | 'afternoon' | 'golden' | 'sunset' | 'blueHour' | 'night'
  // UI accent colors (never applied to image backgrounds)
  accent: string
  accentMuted: string
  borderTint: string
  textTint: string
  bgShift: string
  // Cursor colors
  cursorColor: string
  cursorHoverColor: string
  // Atmosphere
  glowColor: string
  glowOpacity: number
}

const TIME_THEMES: Record<string, TimeTheme> = {
  dawn: {
    period: 'dawn',
    accent: '#d4a574',
    accentMuted: '#8b7355',
    borderTint: '#3a2e22',
    textTint: '#c4a882',
    bgShift: '#0c0a08',
    cursorColor: '#d4a574',
    cursorHoverColor: '#e8c49a',
    glowColor: '#d4a574',
    glowOpacity: 0.03,
  },
  morning: {
    period: 'morning',
    accent: '#c9b896',
    accentMuted: '#7a7060',
    borderTint: '#332e28',
    textTint: '#b8a88e',
    bgShift: '#0b0a09',
    cursorColor: '#c9b896',
    cursorHoverColor: '#ddd0b8',
    glowColor: '#c9b896',
    glowOpacity: 0.02,
  },
  midday: {
    period: 'midday',
    accent: '#a0a0a0',
    accentMuted: '#666666',
    borderTint: '#2a2a2a',
    textTint: '#a0a0a0',
    bgShift: '#0a0a0a',
    cursorColor: '#e0e0e0',
    cursorHoverColor: '#fafafa',
    glowColor: '#ffffff',
    glowOpacity: 0,
  },
  afternoon: {
    period: 'afternoon',
    accent: '#bba07a',
    accentMuted: '#7a6b55',
    borderTint: '#332c22',
    textTint: '#bba882',
    bgShift: '#0d0b09',
    cursorColor: '#bba07a',
    cursorHoverColor: '#d4ba96',
    glowColor: '#bba07a',
    glowOpacity: 0.02,
  },
  golden: {
    period: 'golden',
    accent: '#d4944a',
    accentMuted: '#8b6535',
    borderTint: '#3a2818',
    textTint: '#d4a060',
    bgShift: '#0c0908',
    cursorColor: '#d4944a',
    cursorHoverColor: '#e8b070',
    glowColor: '#d4944a',
    glowOpacity: 0.04,
  },
  sunset: {
    period: 'sunset',
    accent: '#c47850',
    accentMuted: '#7a4e38',
    borderTint: '#3a2218',
    textTint: '#c48868',
    bgShift: '#0c0808',
    cursorColor: '#c47850',
    cursorHoverColor: '#e09070',
    glowColor: '#c47850',
    glowOpacity: 0.04,
  },
  blueHour: {
    period: 'blueHour',
    accent: '#7090b0',
    accentMuted: '#4a6078',
    borderTint: '#1a2230',
    textTint: '#80a0b8',
    bgShift: '#08090c',
    cursorColor: '#7090b0',
    cursorHoverColor: '#90b0d0',
    glowColor: '#7090b0',
    glowOpacity: 0.03,
  },
  night: {
    period: 'night',
    accent: '#a0a0a0',
    accentMuted: '#555555',
    borderTint: '#2a2a2a',
    textTint: '#a0a0a0',
    bgShift: '#0a0a0a',
    cursorColor: '#e0e0e0',
    cursorHoverColor: '#fafafa',
    glowColor: '#ffffff',
    glowOpacity: 0,
  },
}

// Map hours to theme periods with transition points
function getThemeForTime(hour: number, minute: number): { current: TimeTheme; next: TimeTheme; progress: number } {
  const time = hour + minute / 60

  // Define transition ranges [start, end, themeName]
  const periods: [number, number, string][] = [
    [5, 6.5, 'dawn'],        // 5:00 - 6:30
    [6.5, 8, 'morning'],     // 6:30 - 8:00
    [8, 12, 'midday'],       // 8:00 - 12:00
    [12, 15, 'afternoon'],   // 12:00 - 15:00
    [15, 17, 'golden'],      // 15:00 - 17:00
    [17, 19, 'sunset'],      // 17:00 - 19:00
    [19, 21, 'blueHour'],    // 19:00 - 21:00
    [21, 29, 'night'],       // 21:00 - 5:00 (next day)
  ]

  // Find current period
  let adjustedTime = time < 5 ? time + 24 : time

  for (let i = 0; i < periods.length; i++) {
    const [start, end, name] = periods[i]
    if (adjustedTime >= start && adjustedTime < end) {
      const nextIndex = (i + 1) % periods.length
      const nextName = periods[nextIndex][2]
      const progress = (adjustedTime - start) / (end - start)

      return {
        current: TIME_THEMES[name],
        next: TIME_THEMES[nextName],
        progress,
      }
    }
  }

  return { current: TIME_THEMES.night, next: TIME_THEMES.dawn, progress: 0 }
}

// Interpolate between two hex colors
function lerpColor(a: string, b: string, t: number): string {
  const ah = parseInt(a.replace('#', ''), 16)
  const bh = parseInt(b.replace('#', ''), 16)

  const ar = (ah >> 16) & 0xff, ag = (ah >> 8) & 0xff, ab = ah & 0xff
  const br = (bh >> 16) & 0xff, bg = (bh >> 8) & 0xff, bb = bh & 0xff

  const rr = Math.round(ar + (br - ar) * t)
  const rg = Math.round(ag + (bg - ag) * t)
  const rb = Math.round(ab + (bb - ab) * t)

  return `#${((rr << 16) | (rg << 8) | rb).toString(16).padStart(6, '0')}`
}

function lerpNumber(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateTheme(current: TimeTheme, next: TimeTheme, progress: number): TimeTheme {
  // Ease the transition — slow in the middle, sharper at edges
  const t = progress < 0.5
    ? 2 * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 2) / 2

  return {
    period: progress < 0.5 ? current.period : next.period,
    accent: lerpColor(current.accent, next.accent, t),
    accentMuted: lerpColor(current.accentMuted, next.accentMuted, t),
    borderTint: lerpColor(current.borderTint, next.borderTint, t),
    textTint: lerpColor(current.textTint, next.textTint, t),
    bgShift: lerpColor(current.bgShift, next.bgShift, t),
    cursorColor: lerpColor(current.cursorColor, next.cursorColor, t),
    cursorHoverColor: lerpColor(current.cursorHoverColor, next.cursorHoverColor, t),
    glowColor: lerpColor(current.glowColor, next.glowColor, t),
    glowOpacity: lerpNumber(current.glowOpacity, next.glowOpacity, t),
  }
}

interface TimeThemeContextValue {
  theme: TimeTheme
  period: string
}

const TimeThemeContext = createContext<TimeThemeContextValue>({
  theme: TIME_THEMES.night,
  period: 'night',
})

export function useTimeTheme() {
  return useContext(TimeThemeContext)
}

export default function TimeThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<TimeTheme>(TIME_THEMES.night)

  const updateTheme = useCallback(() => {
    const now = new Date()
    const { current, next, progress } = getThemeForTime(now.getHours(), now.getMinutes())
    const interpolated = interpolateTheme(current, next, progress)
    setTheme(interpolated)

    // Apply CSS custom properties for non-React consumers
    const root = document.documentElement
    root.style.setProperty('--theme-accent', interpolated.accent)
    root.style.setProperty('--theme-accent-muted', interpolated.accentMuted)
    root.style.setProperty('--theme-border-tint', interpolated.borderTint)
    root.style.setProperty('--theme-text-tint', interpolated.textTint)
    root.style.setProperty('--theme-bg-shift', interpolated.bgShift)
    root.style.setProperty('--theme-cursor-color', interpolated.cursorColor)
    root.style.setProperty('--theme-cursor-hover', interpolated.cursorHoverColor)
    root.style.setProperty('--theme-glow-color', interpolated.glowColor)
    root.style.setProperty('--theme-glow-opacity', String(interpolated.glowOpacity))
  }, [])

  useEffect(() => {
    updateTheme()
    // Update every 60 seconds for smooth real-time transitions
    const interval = setInterval(updateTheme, 60000)
    return () => clearInterval(interval)
  }, [updateTheme])

  return (
    <TimeThemeContext.Provider value={{ theme, period: theme.period }}>
      {children}
    </TimeThemeContext.Provider>
  )
}
