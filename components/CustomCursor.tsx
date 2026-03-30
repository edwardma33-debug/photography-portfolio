'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useTimeTheme } from './TimeThemeProvider'

interface CursorState {
  x: number
  y: number
  visible: boolean
  hovering: 'default' | 'image' | 'clickable' | 'viewer' | 'text'
}

export default function CustomCursor() {
  const { theme } = useTimeTheme()
  const [cursor, setCursor] = useState<CursorState>({
    x: 0,
    y: 0,
    visible: false,
    hovering: 'default',
  })

  // Smooth trailing position
  const trailRef = useRef({ x: 0, y: 0 })
  const targetRef = useRef({ x: 0, y: 0 })
  const rafRef = useRef<number>()
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  // Detect hover targets
  const getHoverState = useCallback((target: HTMLElement): CursorState['hovering'] => {
    // Walk up the DOM tree to find semantic elements
    let el: HTMLElement | null = target
    while (el) {
      if (el.dataset.cursorType) {
        return el.dataset.cursorType as CursorState['hovering']
      }
      if (el.classList.contains('image-container') || el.dataset.cursor === 'image') {
        return 'image'
      }
      if (
        el.tagName === 'BUTTON' ||
        el.tagName === 'A' ||
        el.getAttribute('role') === 'button' ||
        el.classList.contains('btn') ||
        el.classList.contains('cursor-pointer')
      ) {
        return 'clickable'
      }
      if (el.classList.contains('viewer-active')) {
        return 'viewer'
      }
      el = el.parentElement
    }
    return 'default'
  }, [])

  // Animation loop for smooth trailing
  useEffect(() => {
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t

    const animate = () => {
      trailRef.current.x = lerp(trailRef.current.x, targetRef.current.x, 0.15)
      trailRef.current.y = lerp(trailRef.current.y, targetRef.current.y, 0.15)

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${trailRef.current.x}px, ${trailRef.current.y}px) translate(-50%, -50%)`
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${targetRef.current.x}px, ${targetRef.current.y}px) translate(-50%, -50%)`
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  // Mouse event listeners
  useEffect(() => {
    // Only enable custom cursor on non-touch devices
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isTouch) return

    // Hide default cursor globally
    document.documentElement.style.cursor = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY }
      const target = e.target as HTMLElement
      setCursor(prev => ({
        ...prev,
        x: e.clientX,
        y: e.clientY,
        visible: true,
        hovering: getHoverState(target),
      }))
    }

    const handleMouseLeave = () => {
      setCursor(prev => ({ ...prev, visible: false }))
    }

    const handleMouseEnter = () => {
      setCursor(prev => ({ ...prev, visible: true }))
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseleave', handleMouseLeave)
    document.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      document.documentElement.style.cursor = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
      document.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [getHoverState])

  // Don't render on touch devices
  const [isTouch, setIsTouch] = useState(true)
  useEffect(() => {
    setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  if (isTouch) return null

  // Determine cursor sizes and styles based on hover state
  const getRingSize = () => {
    switch (cursor.hovering) {
      case 'image': return 56
      case 'clickable': return 20
      case 'viewer': return 40
      default: return 32
    }
  }

  const getRingStyle = (): React.CSSProperties => {
    const size = getRingSize()
    const isImage = cursor.hovering === 'image'
    const isClickable = cursor.hovering === 'clickable'

    return {
      width: size,
      height: size,
      border: isClickable
        ? `1.5px solid ${theme.cursorColor}`
        : isImage
          ? `1px solid ${theme.cursorHoverColor}`
          : `1px solid ${theme.cursorColor}`,
      borderRadius: '50%',
      background: isClickable
        ? `${theme.cursorColor}15`
        : isImage
          ? `${theme.cursorHoverColor}08`
          : 'transparent',
      opacity: cursor.visible ? 1 : 0,
      transition: 'width 0.35s cubic-bezier(0.23, 1, 0.32, 1), height 0.35s cubic-bezier(0.23, 1, 0.32, 1), border 0.3s ease, background 0.3s ease, opacity 0.2s ease',
      pointerEvents: 'none' as const,
      position: 'fixed' as const,
      top: 0,
      left: 0,
      zIndex: 9999,
      mixBlendMode: cursor.hovering === 'viewer' ? 'difference' as const : 'normal' as const,
    }
  }

  const getDotStyle = (): React.CSSProperties => {
    const isImage = cursor.hovering === 'image'
    const isClickable = cursor.hovering === 'clickable'
    const dotSize = isImage ? 3 : isClickable ? 4 : 3

    return {
      width: dotSize,
      height: dotSize,
      borderRadius: '50%',
      background: isImage ? theme.cursorHoverColor : theme.cursorColor,
      opacity: cursor.visible ? 1 : 0,
      transition: 'width 0.2s ease, height 0.2s ease, background 0.3s ease, opacity 0.2s ease',
      pointerEvents: 'none' as const,
      position: 'fixed' as const,
      top: 0,
      left: 0,
      zIndex: 9999,
    }
  }

  // Viewfinder crosshair lines for image hover
  const showCrosshair = cursor.hovering === 'image'

  return (
    <>
      {/* Trailing ring */}
      <div ref={ringRef} style={getRingStyle()}>
        {/* Viewfinder tick marks when hovering images */}
        {showCrosshair && (
          <>
            <span style={{
              position: 'absolute', top: -6, left: '50%', width: 1, height: 5,
              background: theme.cursorHoverColor, transform: 'translateX(-50%)',
              opacity: 0.6, transition: 'opacity 0.3s ease',
            }} />
            <span style={{
              position: 'absolute', bottom: -6, left: '50%', width: 1, height: 5,
              background: theme.cursorHoverColor, transform: 'translateX(-50%)',
              opacity: 0.6, transition: 'opacity 0.3s ease',
            }} />
            <span style={{
              position: 'absolute', left: -6, top: '50%', width: 5, height: 1,
              background: theme.cursorHoverColor, transform: 'translateY(-50%)',
              opacity: 0.6, transition: 'opacity 0.3s ease',
            }} />
            <span style={{
              position: 'absolute', right: -6, top: '50%', width: 5, height: 1,
              background: theme.cursorHoverColor, transform: 'translateY(-50%)',
              opacity: 0.6, transition: 'opacity 0.3s ease',
            }} />
          </>
        )}
      </div>

      {/* Center dot (follows mouse exactly) */}
      <div ref={dotRef} style={getDotStyle()} />

      {/* Global style to hide default cursor on all interactive elements */}
      <style jsx global>{`
        *, *::before, *::after {
          cursor: none !important;
        }
      `}</style>
    </>
  )
}
