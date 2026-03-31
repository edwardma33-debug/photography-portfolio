'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'

interface EndCreditsProps {
  onReturnToTop: () => void
}

export default function EndCredits({ onReturnToTop }: EndCreditsProps) {
  const { theme } = useTimeTheme()
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end end'],
  })

  // Staggered reveals as user scrolls into the end credits
  const line1Opacity = useTransform(scrollYProgress, [0.1, 0.25], [0, 1])
  const line2Opacity = useTransform(scrollYProgress, [0.25, 0.4], [0, 1])
  const line3Opacity = useTransform(scrollYProgress, [0.4, 0.55], [0, 1])
  const line4Opacity = useTransform(scrollYProgress, [0.55, 0.7], [0, 1])
  const line5Opacity = useTransform(scrollYProgress, [0.7, 0.85], [0, 1])
  const returnOpacity = useTransform(scrollYProgress, [0.85, 1], [0, 1])

  return (
    <div
      ref={containerRef}
      className="relative min-h-[200vh]"
      style={{ background: theme.bgShift }}
    >
      {/* Fade to black from last image */}
      <div
        className="h-[40vh]"
        style={{
          background: `linear-gradient(to bottom, transparent, ${theme.bgShift})`,
        }}
      />

      {/* Credits content — sticky centered */}
      <div className="sticky top-0 h-screen flex flex-col items-center justify-center px-6">
        <div className="text-center max-w-lg">
          {/* Camera info */}
          <motion.p
            style={{ opacity: line1Opacity }}
            className="font-mono text-[10px] tracking-[0.4em] uppercase mb-12"
          >
            <span style={{ color: theme.accentMuted }}>
              Shot on Fujifilm GFX100S II
            </span>
          </motion.p>

          {/* Locations */}
          <motion.p
            style={{ opacity: line2Opacity }}
            className="font-display text-lg md:text-xl italic mb-16"
          >
            <span style={{ color: theme.textTint }}>
              Sydney &middot; Korea &middot; Japan &middot; Europe
            </span>
          </motion.p>

          {/* Decorative line */}
          <motion.div
            style={{ opacity: line3Opacity }}
            className="mx-auto w-12 h-px mb-16"
          >
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(to right, transparent, ${theme.accent}60, transparent)`,
              }}
            />
          </motion.div>

          {/* Name */}
          <motion.h2
            style={{ opacity: line4Opacity }}
            className="font-display text-3xl md:text-5xl font-light tracking-wider mb-6"
          >
            <span style={{ color: theme.textTint }}>
              Eddie.Raw
            </span>
          </motion.h2>

          {/* Contact */}
          <motion.div style={{ opacity: line5Opacity }}>
            <p
              className="font-mono text-[10px] tracking-[0.3em] uppercase mb-4"
              style={{ color: theme.accentMuted }}
            >
              Prints &middot; Licensing &middot; Collaborations
            </p>
            <a
              href="mailto:edwardma33@gmail.com"
              className="font-mono text-sm transition-colors duration-300 hover:opacity-80"
              style={{ color: theme.accent }}
              data-cursor-type="clickable"
            >
              edwardma33@gmail.com
            </a>
          </motion.div>

          {/* Return to beginning */}
          <motion.div
            style={{ opacity: returnOpacity }}
            className="mt-20"
          >
            <button
              onClick={onReturnToTop}
              className="group inline-flex flex-col items-center gap-3"
              data-cursor-type="clickable"
            >
              {/* Upward scroll indicator */}
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <svg
                  width="16"
                  height="24"
                  viewBox="0 0 16 24"
                  fill="none"
                >
                  <rect
                    x="1"
                    y="1"
                    width="14"
                    height="22"
                    rx="7"
                    stroke={`${theme.accentMuted}60`}
                    strokeWidth="1"
                  />
                  <motion.circle
                    cx="8"
                    r="2"
                    fill={`${theme.accent}80`}
                    animate={{ cy: [16, 8, 16] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  />
                </svg>
              </motion.div>
              <span
                className="font-mono text-[9px] tracking-[0.4em] uppercase transition-colors duration-300"
                style={{ color: `${theme.accentMuted}80` }}
              >
                Return to beginning
              </span>
            </button>
          </motion.div>
        </div>
      </div>

      {/* Bottom spacer for scroll */}
      <div className="h-[60vh]" />
    </div>
  )
}
