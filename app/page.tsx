'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import TimeThemeProvider from '@/components/TimeThemeProvider'
import CustomCursor from '@/components/CustomCursor'
import LandingHero from '@/components/LandingHero'
import ScrollGallery from '@/components/ScrollGallery'
import AmbientAudio from '@/components/AmbientAudio'
import EndCredits from '@/components/EndCredits'
import { ImageData, GalleryData } from '@/lib/types'

// Dynamically import ImageViewer to avoid SSR issues with OpenSeadragon
const ImageViewer = dynamic(() => import('@/components/ImageViewer'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 bg-gallery-black flex items-center justify-center z-50">
      <div className="spinner" />
    </div>
  )
})

type AppState = 'landing' | 'gallery'

export default function Home() {
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [appState, setAppState] = useState<AppState>('landing')
  const galleryTopRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/data/gallery.json')
      .then(res => res.json())
      .then(data => {
        setGalleryData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Failed to load gallery data:', err)
        setLoading(false)
      })
  }, [])

  const handleImageClick = (image: ImageData) => {
    setSelectedImage(image)
    document.body.style.overflow = 'hidden'
  }

  const handleCloseViewer = () => {
    setSelectedImage(null)
    document.body.style.overflow = ''
  }

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (!selectedImage || !galleryData) return
    const images = galleryData.images
    const currentIndex = images.findIndex(img => img.id === selectedImage.id)
    let newIndex: number

    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    } else {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    }

    setSelectedImage(images[newIndex])
  }

  const handleEnterGallery = useCallback(() => {
    setAppState('gallery')
    // Smooth scroll to top of gallery after landing dissolves
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
    }, 100)
  }, [])

  const handleReturnToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  // Get hero images from gallery data
  const heroImages = galleryData?.heroImages
    ?.map(id => galleryData.images.find(img => img.id === id))
    .filter((img): img is ImageData => Boolean(img)) || []

  return (
    <TimeThemeProvider>
      <CustomCursor />
      <AmbientAudio autoPlay={appState === 'gallery'} />

      <main className="min-h-screen bg-gallery-black">
        {/* Landing hero — shown first, dissolves on enter */}
        <AnimatePresence>
          {appState === 'landing' && galleryData && heroImages.length > 0 && (
            <LandingHero
              images={heroImages}
              storageBaseUrl={galleryData.storageBaseUrl}
              onEnter={handleEnterGallery}
            />
          )}
        </AnimatePresence>

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center h-screen">
            <div className="spinner" />
          </div>
        )}

        {/* Gallery content — visible after landing */}
        {appState === 'gallery' && galleryData && (
          <motion.div
            ref={galleryTopRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.3 }}
          >
            {/* Gallery header */}
            <header className="relative py-20 md:py-32 px-6 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.5 }}
              >
                <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-light text-gallery-white tracking-wide">
                  {galleryData.title}
                </h1>
                {galleryData.subtitle && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8, delay: 0.8 }}
                    className="mt-4 font-mono text-xs tracking-[0.3em] uppercase text-gallery-muted"
                  >
                    {galleryData.subtitle}
                  </motion.p>
                )}
              </motion.div>

              {/* Decorative line */}
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.5, delay: 1, ease: [0.4, 0, 0.2, 1] }}
                className="mt-12 mx-auto w-24 h-px bg-gradient-to-r from-transparent via-gallery-border to-transparent"
              />

              {/* Scroll hint */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2, duration: 1 }}
                className="mt-16 font-mono text-[9px] tracking-[0.4em] uppercase text-gallery-muted"
              >
                Scroll to explore
              </motion.p>
            </header>

            {/* Scroll gallery */}
            <ScrollGallery
              images={galleryData.images}
              onImageClick={handleImageClick}
              storageBaseUrl={galleryData.storageBaseUrl}
            />

            {/* End credits */}
            <EndCredits onReturnToTop={handleReturnToTop} />

            {/* Minimal footer */}
            <footer className="py-8 text-center">
              <div className="flex justify-center gap-8 mb-6">
                <a
                  href="/about"
                  className="font-mono text-[10px] uppercase tracking-[0.3em] text-gallery-muted hover:text-gallery-text transition-colors duration-300"
                  data-cursor-type="clickable"
                >
                  About
                </a>
                <a
                  href="/about#contact"
                  className="font-mono text-[10px] uppercase tracking-[0.3em] text-gallery-muted hover:text-gallery-text transition-colors duration-300"
                  data-cursor-type="clickable"
                >
                  Contact
                </a>
              </div>
              <p className="font-mono text-[9px] text-gallery-border tracking-wider">
                &copy; {new Date().getFullYear()} EDWARD MA &middot; ALL RIGHTS RESERVED
              </p>
            </footer>
          </motion.div>
        )}

        {/* Empty state */}
        {!loading && (!galleryData || galleryData.images.length === 0) && (
          <div className="flex flex-col items-center justify-center h-screen text-center px-6">
            <p className="font-display text-2xl text-gallery-muted italic mb-4">
              No photographs yet
            </p>
            <p className="text-sm text-gallery-muted max-w-md">
              Run the processing script to add images to your gallery.
            </p>
          </div>
        )}

        {/* Full-screen image viewer */}
        <AnimatePresence>
          {selectedImage && (
            <ImageViewer
              image={selectedImage}
              onClose={handleCloseViewer}
              onNavigate={handleNavigate}
              storageBaseUrl={galleryData?.storageBaseUrl || ''}
            />
          )}
        </AnimatePresence>
      </main>
    </TimeThemeProvider>
  )
}
