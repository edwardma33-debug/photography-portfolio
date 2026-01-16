'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'

export default function About() {
  return (
    <main className="min-h-screen bg-gallery-black">
      {/* Header */}
      <header className="border-b border-gallery-border">
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <Link 
            href="/"
            className="font-display text-xl text-gallery-white hover:text-gallery-light transition-colors"
          >
            Edward Ma
          </Link>
          <nav className="flex gap-8">
            <Link 
              href="/"
              className="text-xs uppercase tracking-widest text-gallery-muted hover:text-gallery-text transition-colors"
            >
              Gallery
            </Link>
            <Link 
              href="/about"
              className="text-xs uppercase tracking-widest text-gallery-white"
            >
              About
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <article className="max-w-2xl mx-auto px-6 py-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="font-display text-4xl md:text-5xl text-gallery-white mb-12">
            About
          </h1>

          <div className="space-y-6 text-gallery-text leading-relaxed">
            <p>
              I'm a photographer based in Sydney, Australia. My work focuses on street photography, 
              architecture, and urban landscapes, exploring the intersection of human activity and 
              built environments.
            </p>

            <p>
              This gallery is shot primarily on medium format — a Fujifilm GFX100S II paired with 
              the GF 32-64mm f/4. The 102-megapixel sensor captures an extraordinary level of detail 
              that I believe photography deserves. Every image here is available for deep-zoom viewing 
              at full resolution.
            </p>

            <p>
              I've traveled extensively through Korea, Japan, China, and Europe, documenting cities 
              and their stories. My approach emphasizes patience and observation — waiting for the 
              right light, the right moment, the right convergence of elements that transforms a 
              scene into something worth preserving.
            </p>

            <h2 className="font-display text-2xl text-gallery-white mt-12 mb-6">
              On Permanence
            </h2>

            <p>
              This gallery is designed as a permanent archive. Every photograph exists in multiple 
              redundant formats and locations. The master files are 16-bit TIFFs with full metadata 
              preserved. The website itself is static and hostable anywhere — no database, no 
              dependencies that could disappear.
            </p>

            <p>
              In a world of ephemeral digital content, I wanted to create something that could 
              outlast me. These images are my contribution to the visual record of our time.
            </p>

            <h2 className="font-display text-2xl text-gallery-white mt-12 mb-6">
              Technical
            </h2>

            <div className="font-mono text-sm space-y-2">
              <p><span className="text-gallery-muted">Camera:</span> Fujifilm GFX100S II</p>
              <p><span className="text-gallery-muted">Primary Lens:</span> GF 32-64mm f/4 R LM WR</p>
              <p><span className="text-gallery-muted">Processing:</span> Adobe Lightroom Classic</p>
              <p><span className="text-gallery-muted">Export:</span> 16-bit TIFF, Adobe RGB</p>
            </div>

            <h2 className="font-display text-2xl text-gallery-white mt-12 mb-6">
              Contact
            </h2>

            <p>
              For inquiries about prints, licensing, or collaborations:
            </p>

            <p className="font-mono text-sm">
              <a
                href="mailto:edwardma33@gmail.com"
                className="text-gallery-light hover:text-gallery-white transition-colors"
              >
                edwardma33@gmail.com
              </a>
            </p>
          </div>
        </motion.div>
      </article>

      {/* Footer */}
      <footer className="border-t border-gallery-border mt-20">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <p className="font-mono text-[10px] text-gallery-border tracking-wider">
            © {new Date().getFullYear()} EDWARD MA · ALL RIGHTS RESERVED
          </p>
        </div>
      </footer>
    </main>
  )
}
