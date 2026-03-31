'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'
import { ImageData } from '@/lib/types'

interface LandingHeroProps {
  images: ImageData[]
  storageBaseUrl: string
  onEnter: () => void
}

export default function LandingHero({ images, storageBaseUrl, onEnter }: LandingHeroProps) {
  const { theme } = useTimeTheme()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imagesLoaded, setImagesLoaded] = useState<Set<number>>(new Set())
  const [isExiting, setIsExiting] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Preload hero images
  useEffect(() => {
    images.forEach((img, i) => {
      const image = new Image()
      image.onload = () => {
        setImagesLoaded(prev => new Set(prev).add(i))
      }
      image.src = `${storageBaseUrl}/${img.preview}`
    })
  }, [images, storageBaseUrl])

  // Cycle through images with slow crossfade
  useEffect(() => {
    if (images.length <= 1) return
    intervalRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % images.length)
    }, 8000) // 8 seconds per image

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [images.length])

  const handleEnter = useCallback(() => {
    setIsExiting(true)
    if (intervalRef.current) clearInterval(intervalRef.current)
    // Wait for exit animation then trigger parent
    setTimeout(() => {
      onEnter()
    }, 1200)
  }, [onEnter])

  // Handle scroll to enter
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.deltaY > 30 && !isExiting) {
        handleEnter()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') && !isExiting) {
        handleEnter()
      }
    }

    // Touch swipe up to enter
    let touchStartY = 0
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY
    }
    const handleTouchEnd = (e: TouchEvent) => {
      const diff = touchStartY - e.changedTouches[0].clientY
      if (diff > 60 && !isExiting) {
        handleEnter()
      }
    }

    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('touchstart', handleTouchStart)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isExiting, handleEnter])

  const allLoaded = imagesLoaded.size >= 1 // Show as soon as first image loads

  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: isExiting ? 0 : 1 }}
      transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
      className="fixed inset-0 z-[60] bg-gallery-black overflow-hidden"
    >
      {/* Background images with Ken Burns */}
      <div className="absolute inset-0">
        {images.map((img, index) => (
          <div
            key={img.id}
            className="absolute inset-0"
            style={{
              opacity: currentIndex === index ? 1 : 0,
              transition: 'opacity 2.5s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            <div
              className="absolute inset-0 kenburns-active"
              style={{
                backgroundImage: `url(${storageBaseUrl}/${img.preview})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                // Alternate Ken Burns directions per image
                animation: `kenburns-${index % 3} 20s ease-in-out infinite`,
              }}
            />
          </div>
        ))}

        {/* Atmospheric gradient overlay — tinted by time of day */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse at center, transparent 0%, ${theme.bgShift}dd 70%, ${theme.bgShift}ff 100%),
              linear-gradient(to bottom, ${theme.bgShift}80 0%, transparent 30%, transparent 60%, ${theme.bgShift}ee 100%)
            `,
          }}
        />

        {/* Subtle atmospheric glow at top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${theme.glowColor}${Math.round(theme.glowOpacity * 255).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
          }}
        />
      </div>

      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full px-6">
        <AnimatePresence>
          {allLoaded && !isExiting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 1.5, delay: 0.3 }}
              className="text-center"
            >
              {/* Name */}
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1.2, delay: 0.5, ease: [0.4, 0, 0.2, 1] }}
                className="font-display text-5xl md:text-7xl lg:text-8xl xl:text-9xl font-light text-gallery-white tracking-wider"
                style={{ textShadow: '0 2px 40px rgba(0,0,0,0.5)' }}
              >
                Eddie.Raw
              </motion.h1>

              {/* Decorative line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.5, delay: 1.6, ease: [0.4, 0, 0.2, 1] }}
                className="mt-8 mx-auto w-16 h-px"
                style={{ background: `linear-gradient(to right, transparent, ${theme.accent}60, transparent)` }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Enter prompt */}
        <AnimatePresence>
          {allLoaded && !isExiting && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1, delay: 2.5 }}
              className="absolute bottom-16 md:bottom-20 left-0 right-0 text-center"
            >
              <button
                onClick={handleEnter}
                className="group inline-flex flex-col items-center gap-3"
                data-cursor-type="clickable"
              >
                <span
                  className="font-mono text-[10px] tracking-[0.4em] uppercase transition-colors duration-500"
                  style={{ color: theme.accentMuted }}
                >
                  Enter Gallery
                </span>

                {/* Animated scroll indicator */}
                <motion.div
                  animate={{ y: [0, 6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <svg
                    width="16"
                    height="24"
                    viewBox="0 0 16 24"
                    fill="none"
                    className="transition-colors duration-500"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="14"
                      height="22"
                      rx="7"
                      stroke={theme.accentMuted}
                      strokeWidth="1"
                    />
                    <motion.circle
                      cx="8"
                      cy="8"
                      r="2"
                      fill={theme.accent}
                      animate={{ cy: [7, 14, 7] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  </svg>
                </motion.div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Image counter dots */}
      {images.length > 1 && allLoaded && !isExiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3 }}
          className="absolute bottom-16 md:bottom-20 right-8 flex flex-col gap-2"
        >
          {images.map((_, i) => (
            <div
              key={i}
              className="w-1 h-1 rounded-full transition-all duration-700"
              style={{
                background: currentIndex === i ? theme.accent : theme.accentMuted,
                transform: currentIndex === i ? 'scale(1.5)' : 'scale(1)',
              }}
            />
          ))}
        </motion.div>
      )}
    </motion.div>
  )
}
