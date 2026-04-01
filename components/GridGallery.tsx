'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTimeTheme } from './TimeThemeProvider'
import { ImageData } from '@/lib/types'

interface GridGalleryProps {
  images: ImageData[]
  onImageClick: (image: ImageData) => void
  storageBaseUrl: string
}

function GridImage({
  image,
  index,
  onClick,
  storageBaseUrl,
}: {
  image: ImageData
  index: number
  onClick: () => void
  storageBaseUrl: string
}) {
  const { theme } = useTimeTheme()
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Lazy load when near viewport
  useEffect(() => {
    if (!ref.current) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0 }}
      animate={{ opacity: loaded ? 1 : 0 }}
      transition={{ duration: 0.6, delay: Math.min(index * 0.03, 0.3) }}
      className="relative aspect-square overflow-hidden cursor-pointer group"
      onClick={onClick}
      data-cursor="image"
    >
      {/* Background */}
      <div
        className="absolute inset-0"
        style={{ background: theme.bgShift }}
      />

      {/* Image */}
      {inView && (
        <img
          src={`${storageBaseUrl}/${image.thumbnail}`}
          alt={image.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          onLoad={() => setLoaded(true)}
        />
      )}

      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
    </motion.div>
  )
}

export default function GridGallery({ images, onImageClick, storageBaseUrl }: GridGalleryProps) {
  return (
    <section className="px-1 md:px-2">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 md:gap-1.5">
        {images.map((image, index) => (
          <GridImage
            key={image.id}
            image={image}
            index={index}
            onClick={() => onImageClick(image)}
            storageBaseUrl={storageBaseUrl}
          />
        ))}
      </div>
    </section>
  )
}
