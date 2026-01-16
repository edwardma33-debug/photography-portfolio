'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ImageData } from '@/lib/types'

interface GalleryProps {
  images: ImageData[]
  onImageClick: (image: ImageData) => void
}

export default function Gallery({ images, onImageClick }: GalleryProps) {
  return (
    <section className="px-4 md:px-6 pb-12">
      <div className="max-w-[2000px] mx-auto">
        <div className="masonry-grid">
          {images.map((image, index) => (
            <GalleryItem
              key={image.id}
              image={image}
              index={index}
              onClick={() => onImageClick(image)}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

interface GalleryItemProps {
  image: ImageData
  index: number
  onClick: () => void
}

function GalleryItem({ image, index, onClick }: GalleryItemProps) {
  const [loaded, setLoaded] = useState(false)
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' }
    )

    if (ref.current) {
      observer.observe(ref.current)
    }

    return () => observer.disconnect()
  }, [])

  // Calculate aspect ratio for placeholder
  const paddingBottom = `${(image.height / image.width) * 100}%`

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.6, 
        delay: Math.min(index * 0.05, 0.5),
        ease: [0.4, 0, 0.2, 1]
      }}
      className="masonry-item"
    >
      <div
        onClick={onClick}
        className="image-container cursor-pointer group"
        style={{ paddingBottom }}
      >
        {/* Placeholder */}
        <div 
          className="absolute inset-0 bg-gallery-dark"
          style={{ opacity: loaded ? 0 : 1, transition: 'opacity 0.3s ease' }}
        />
        
        {/* Image */}
        {inView && (
          <img
            src={image.thumbnail}
            alt={image.title}
            className={`
              absolute inset-0 w-full h-full object-cover
              transition-all duration-500 ease-out
              group-hover:scale-[1.02]
              ${loaded ? 'opacity-100' : 'opacity-0'}
            `}
            onLoad={() => setLoaded(true)}
            loading="lazy"
          />
        )}

        {/* Overlay with info */}
        <div className="
          absolute inset-0 
          bg-gradient-to-t from-black/70 via-transparent to-transparent
          opacity-0 group-hover:opacity-100
          transition-opacity duration-300
          flex flex-col justify-end p-4
        ">
          <h3 className="font-display text-lg text-gallery-white">
            {image.title}
          </h3>
          {image.location && (
            <p className="font-mono text-xs text-gallery-text mt-1 tracking-wider">
              {image.location}
            </p>
          )}
        </div>

        {/* Zoom indicator */}
        <div className="
          absolute top-3 right-3
          w-8 h-8 rounded-full
          bg-black/50 backdrop-blur-sm
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          transition-opacity duration-300
          pointer-events-none
        ">
          <svg 
            className="w-4 h-4 text-gallery-white" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
            />
          </svg>
        </div>
      </div>
    </motion.div>
  )
}
