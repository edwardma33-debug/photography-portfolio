'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import Header from '@/components/Header'
import Gallery from '@/components/Gallery'
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

export default function Home() {
  const [galleryData, setGalleryData] = useState<GalleryData | null>(null)
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    // Load gallery data from static JSON
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
    
    const images = filter === 'all' 
      ? galleryData.images 
      : galleryData.images.filter(img => img.collection === filter)
    
    const currentIndex = images.findIndex(img => img.id === selectedImage.id)
    let newIndex: number
    
    if (direction === 'prev') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1
    } else {
      newIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0
    }
    
    setSelectedImage(images[newIndex])
  }

  const filteredImages = galleryData?.images.filter(
    img => filter === 'all' || img.collection === filter
  ) || []

  const collections: string[] = galleryData
    ? ['all', ...Array.from(new Set(galleryData.images.map(img => img.collection).filter((c): c is string => Boolean(c))))]
    : ['all']

  return (
    <main className="min-h-screen bg-gallery-black">
      <Header 
        title={galleryData?.title || 'Gallery'}
        subtitle={galleryData?.subtitle}
      />
      
      {/* Collection filters */}
      {collections.length > 1 && (
        <nav className="sticky top-0 z-40 bg-gallery-black/90 backdrop-blur-sm border-b border-gallery-border">
          <div className="max-w-[2000px] mx-auto px-6 py-4">
            <div className="flex gap-6 overflow-x-auto scrollbar-hide">
              {collections.map(collection => (
                <button
                  key={collection}
                  onClick={() => setFilter(collection)}
                  className={`
                    font-mono text-xs uppercase tracking-widest whitespace-nowrap
                    transition-colors duration-300
                    ${filter === collection 
                      ? 'text-gallery-white' 
                      : 'text-gallery-muted hover:text-gallery-text'}
                  `}
                >
                  {collection}
                  {collection !== 'all' && galleryData && (
                    <span className="ml-2 text-gallery-border">
                      {galleryData.images.filter(img => img.collection === collection).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="spinner" />
        </div>
      )}

      {/* Gallery grid */}
      {!loading && galleryData && (
        <Gallery
          images={filteredImages}
          onImageClick={handleImageClick}
          storageBaseUrl={galleryData.storageBaseUrl}
        />
      )}

      {/* Empty state */}
      {!loading && (!galleryData || filteredImages.length === 0) && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
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

      {/* Footer */}
      <footer className="border-t border-gallery-border mt-20">
        <div className="max-w-[2000px] mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="text-center md:text-left">
              <p className="font-display text-xl text-gallery-light">
                {galleryData?.title || 'Gallery'}
              </p>
              <p className="text-xs text-gallery-muted mt-1">
                {filteredImages.length} photographs
              </p>
            </div>
            <div className="flex gap-8">
              <a 
                href="/about" 
                className="text-xs uppercase tracking-widest text-gallery-muted hover:text-gallery-text transition-colors"
              >
                About
              </a>
              <a 
                href="/contact" 
                className="text-xs uppercase tracking-widest text-gallery-muted hover:text-gallery-text transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gallery-border text-center">
            <p className="font-mono text-[10px] text-gallery-border tracking-wider">
              PERMANENT ARCHIVE — ESTABLISHED {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}
