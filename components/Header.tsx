'use client'

import { motion } from 'framer-motion'

interface HeaderProps {
  title: string
  subtitle?: string
}

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="relative py-16 md:py-24 px-6">
      <div className="max-w-[2000px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          className="text-center"
        >
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-gallery-white tracking-wide">
            {title}
          </h1>
          {subtitle && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-4 font-body text-sm md:text-base text-gallery-muted tracking-wider"
            >
              {subtitle}
            </motion.p>
          )}
        </motion.div>
        
        {/* Decorative line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: [0.4, 0, 0.2, 1] }}
          className="mt-12 mx-auto w-24 h-px bg-gradient-to-r from-transparent via-gallery-border to-transparent"
        />
      </div>
    </header>
  )
}
