'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'
import { ImageData } from '@/lib/types'

interface ScrollGalleryProps {
  images: ImageData[]
  onImageClick: (image: ImageData) => void
  storageBaseUrl: string
}

export default function ScrollGallery({ images, onImageClick, storageBaseUrl }: ScrollGalleryProps) {
  return (
    <section className="relative">
      {images.map((image, index) => (
        <ScrollImage
          key={image.id}
          image={image}
          index={index}
          total={images.length}
          onClick={() => onImageClick(image)}
          storageBaseUrl={storageBaseUrl}
        />
      ))}
    </section>
  )
}

interface ScrollImageProps {
  image: ImageData
  index: number
  total: number
  onClick: () => void
  storageBaseUrl: string
}

function ScrollImage({ image, index, total, onClick, storageBaseUrl }: ScrollImageProps) {
  const { theme } = useTimeTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const [developed, setDeveloped] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const isPortrait = image.aspectRatio < 1
  const isLandscape = image.aspectRatio > 1.1

  // Parallax effect
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  const parallaxY = useTransform(scrollYProgress, [0, 1], [40, -40])
  const imageScale = useTransform(scrollYProgress, [0, 0.5, 1], [1.05, 1, 1.05])

  // Start loading image early (600px before viewport)
  useEffect(() => {
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '600px' }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  // When image is loaded AND in the viewport area, trigger the development
  useEffect(() => {
    if (!loaded || developed) return

    // Check if already visible
    if (!containerRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Image is loaded and visible — develop it
          setDeveloped(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [loaded, developed])

  // Also: if image was already visible when it finishes loading, develop immediately
  useEffect(() => {
    if (!loaded || developed || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const isVisible = rect.top < window.innerHeight && rect.bottom > 0
    if (isVisible) {
      setDeveloped(true)
    }
  }, [loaded, developed])

  // Film development CSS — two states only: developing or developed
  const getImageStyle = (): React.CSSProperties => {
    if (developed) {
      // Fully clear — once developed, stays developed forever
      return {
        opacity: 1,
        filter: 'brightness(1) contrast(1) blur(0px) saturate(1)',
        transition: 'filter 2.5s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.5s ease',
      }
    }

    if (loaded) {
      // Loaded but not yet scrolled into view — dark, shapes barely visible
      return {
        opacity: 1,
        filter: 'brightness(0.15) contrast(1.4) blur(4px) saturate(0)',
        transition: 'filter 0.8s ease, opacity 0.5s ease',
      }
    }

    // Not loaded yet — invisible
    return {
      opacity: 0,
      filter: 'brightness(0) blur(12px)',
      transition: 'opacity 0.3s ease',
    }
  }

  // Image sizing based on orientation
  const getImageContainerClass = () => {
    if (isLandscape) {
      return 'w-full max-w-[85vw] md:max-w-[75vw] lg:max-w-[70vw] mx-auto'
    }
    if (isPortrait) {
      return 'w-[75vw] md:w-[50vw] lg:w-[40vw] xl:w-[35vw] mx-auto'
    }
    return 'w-[80vw] md:w-[60vw] lg:w-[50vw] mx-auto'
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center min-h-screen py-16 md:py-24 px-4 md:px-8"
    >
      {/* Image frame with parallax */}
      <motion.div
        style={{ y: parallaxY }}
        className={`relative ${getImageContainerClass()}`}
      >
        {/* Click target */}
        <div
          onClick={onClick}
          className="relative overflow-hidden group"
          data-cursor="image"
        >
          {/* Aspect ratio container */}
          <div style={{ paddingBottom: `${(1 / image.aspectRatio) * 100}%` }} className="relative">
            {/* Dark background while loading */}
            <div
              className="absolute inset-0"
              style={{ background: theme.bgShift }}
            />

            {/* The image — starts loading when 600px from viewport */}
            <motion.div
              style={{ scale: imageScale }}
              className="absolute inset-0"
            >
              {inView && (
                <img
                  ref={imgRef}
                  src={`${storageBaseUrl}/${image.preview}`}
                  alt={image.title}
                  className="absolute inset-0 w-full h-full object-cover"
                  style={getImageStyle()}
                  onLoad={() => setLoaded(true)}
                />
              )}
            </motion.div>

            {/* Subtle vignette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                boxShadow: 'inset 0 0 100px rgba(0,0,0,0.15)',
              }}
            />
          </div>

          {/* Hover: zoom indicator */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
            <div
              className="w-12 h-12 rounded-full border flex items-center justify-center"
              style={{
                borderColor: `${theme.cursorHoverColor}40`,
                background: 'rgba(0,0,0,0.3)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke={theme.cursorHoverColor} viewBox="0 0 24 24" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Image info — appears after development */}
        <motion.div
          initial={false}
          animate={{
            opacity: developed ? 1 : 0,
            y: developed ? 0 : 10,
          }}
          transition={{ duration: 0.8, delay: developed ? 1.2 : 0, ease: [0.4, 0, 0.2, 1] }}
          className="mt-6 md:mt-8 flex justify-between items-end"
        >
          <div>
            {image.title && image.title !== image.filename?.replace(/\.[^/.]+$/, '') && (
              <h3 className="font-display text-lg md:text-xl text-gallery-light">
                {image.title}
              </h3>
            )}
            {image.location && (
              <p className="font-mono text-[10px] md:text-xs tracking-wider mt-1"
                style={{ color: theme.accentMuted }}>
                {image.location}
              </p>
            )}
          </div>
          <div className="text-right">
            {image.date && (
              <p className="font-mono text-[10px] tracking-wider"
                style={{ color: theme.accentMuted }}>
                {image.date}
              </p>
            )}
          </div>
        </motion.div>

        {/* Sequence indicator */}
        <div className="mt-4 flex justify-center">
          <span
            className="font-mono text-[9px] tracking-[0.3em]"
            style={{ color: `${theme.accentMuted}60` }}
          >
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </span>
        </div>
      </motion.div>
    </div>
  )
}
