'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import OpenSeadragon from 'openseadragon'
import { ImageData } from '@/lib/types'

interface ImageViewerProps {
  image: ImageData
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
  storageBaseUrl: string
}

export default function ImageViewer({ 
  image, 
  onClose, 
  onNavigate,
  storageBaseUrl 
}: ImageViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const osdRef = useRef<OpenSeadragon.Viewer | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // Initialize OpenSeadragon
  useEffect(() => {
    if (!viewerRef.current) return

    // Reset state for new image
    setLoadError(null)
    setIsLoading(true)

    // Handle both local paths and cloud storage URLs
    const tilesUrl = storageBaseUrl
      ? `${storageBaseUrl}/${image.tiles}`
      : `/${image.tiles}`

    const dziPath = `${tilesUrl}/image.dzi`
    console.log('Loading DZI from:', dziPath)

    osdRef.current = OpenSeadragon({
      element: viewerRef.current,
      tileSources: dziPath,
      prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/',
      showNavigator: true,
      navigatorPosition: 'BOTTOM_RIGHT',
      navigatorHeight: 100,
      navigatorWidth: 150,
      showNavigationControl: false,
      showZoomControl: false,
      showHomeControl: false,
      showFullPageControl: false,
      showRotationControl: false,
      animationTime: 0.3,
      springStiffness: 10,
      visibilityRatio: 1,
      constrainDuringPan: true,
      // Use image ratio instead of absolute zoom for large images
      minZoomImageRatio: 0.8,
      maxZoomPixelRatio: 4,
      // Start with image filling the viewer
      defaultZoomLevel: 0,
      homeFillsViewer: true,
      gestureSettingsMouse: {
        clickToZoom: true,
        dblClickToZoom: true,
        scrollToZoom: true,
      },
      gestureSettingsTouch: {
        pinchToZoom: true,
        flickEnabled: true,
      },
      // Render immediately for faster display
      immediateRender: true,
    })

    // Track successful load
    osdRef.current.addHandler('open', () => {
      console.log('OpenSeadragon: Image loaded successfully')
      setIsLoading(false)
      setLoadError(null)
      // Get the initial zoom level after image loads
      if (osdRef.current) {
        // Force a resize to ensure proper rendering
        setTimeout(() => {
          if (osdRef.current && viewerRef.current) {
            const rect = viewerRef.current.getBoundingClientRect()
            console.log('Viewer container size:', rect.width, 'x', rect.height)
            osdRef.current.viewport.resize()

            // Set default zoom to 67% of home (fit-to-screen) zoom
            const homeZoom = osdRef.current.viewport.getHomeZoom()
            const targetZoom = homeZoom * 0.67
            osdRef.current.viewport.zoomTo(targetZoom, undefined, true)
          }
        }, 100)

        const homeZoom = osdRef.current.viewport.getHomeZoom()
        // Store home zoom for percentage calculation
        ;(osdRef.current as any).homeZoom = homeZoom
        setZoomLevel(0.67) // Initial display at 67%
        console.log('Home zoom:', homeZoom, 'Target zoom: 67%')
      }
    })

    // Track load errors
    osdRef.current.addHandler('open-failed', (event) => {
      console.error('OpenSeadragon: Failed to load image', event)
      setIsLoading(false)
      setLoadError(`Failed to load image tiles from ${dziPath}`)
    })

    // Track zoom changes - normalize to percentage where 100% = fit to screen
    osdRef.current.addHandler('zoom', (event) => {
      if (event.zoom && osdRef.current) {
        const homeZoom = (osdRef.current as any).homeZoom || osdRef.current.viewport.getHomeZoom()
        setZoomLevel(event.zoom / homeZoom)
      }
    })

    return () => {
      if (osdRef.current) {
        osdRef.current.destroy()
        osdRef.current = null
      }
    }
  }, [image, storageBaseUrl])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose()
          break
        case 'ArrowLeft':
          onNavigate('prev')
          break
        case 'ArrowRight':
          onNavigate('next')
          break
        case 'i':
          setShowMetadata(prev => !prev)
          break
        case '+':
        case '=':
          osdRef.current?.viewport.zoomBy(1.5)
          break
        case '-':
          osdRef.current?.viewport.zoomBy(0.67)
          break
        case '0':
          osdRef.current?.viewport.goHome()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, onNavigate])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false)
    }, 3000)
  }, [])

  useEffect(() => {
    resetControlsTimeout()
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [resetControlsTimeout])

  const handleMouseMove = () => {
    resetControlsTimeout()
  }

  // Viewer controls
  const handleZoomIn = () => osdRef.current?.viewport.zoomBy(1.5)
  const handleZoomOut = () => osdRef.current?.viewport.zoomBy(0.67)
  const handleReset = () => osdRef.current?.viewport.goHome()

  const handleDownload = () => {
    // Handle both local paths and cloud storage URLs
    const masterUrl = storageBaseUrl
      ? `${storageBaseUrl}/${image.master}`
      : `/${image.master}`
    window.open(masterUrl, '_blank')
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-50 bg-gallery-black"
      onMouseMove={handleMouseMove}
    >
      {/* OpenSeadragon container - explicit dimensions for proper rendering */}
      <div
        ref={viewerRef}
        className="absolute inset-0 w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-5 pointer-events-none">
          <div className="flex flex-col items-center gap-4">
            <div className="spinner" />
            <p className="text-gallery-muted text-sm font-mono">Loading tiles...</p>
          </div>
        </div>
      )}

      {/* Error message */}
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center z-5">
          <div className="bg-gallery-dark/90 border border-red-500/30 rounded-lg p-6 max-w-md text-center">
            <p className="text-red-400 font-mono text-sm mb-2">Failed to load image</p>
            <p className="text-gallery-muted text-xs">{loadError}</p>
            <p className="text-gallery-muted text-xs mt-4">Check browser console (F12) for details</p>
          </div>
        </div>
      )}

      {/* Top bar */}
      <motion.div
        initial={false}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute top-0 left-0 right-0 z-10 pointer-events-none"
      >
        <div className="bg-gradient-to-b from-black/60 to-transparent p-6">
          <div className="flex items-start justify-between pointer-events-auto">
            {/* Image info */}
            <div>
              <h2 className="font-display text-2xl text-gallery-white">
                {image.title}
              </h2>
              {image.location && (
                <p className="font-mono text-xs text-gallery-text mt-1 tracking-wider">
                  {image.location}
                </p>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              className="p-2 text-gallery-text hover:text-gallery-white transition-colors"
              aria-label="Close viewer"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Navigation arrows */}
      <motion.button
        initial={false}
        animate={{ opacity: showControls ? 1 : 0 }}
        onClick={() => onNavigate('prev')}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 text-gallery-text hover:text-gallery-white transition-colors"
        aria-label="Previous image"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
        </svg>
      </motion.button>

      <motion.button
        initial={false}
        animate={{ opacity: showControls ? 1 : 0 }}
        onClick={() => onNavigate('next')}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 text-gallery-text hover:text-gallery-white transition-colors"
        aria-label="Next image"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
        </svg>
      </motion.button>

      {/* Bottom controls */}
      <motion.div
        initial={false}
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
      >
        <div className="bg-gradient-to-t from-black/60 to-transparent p-6">
          <div className="flex items-center justify-center gap-1 pointer-events-auto">
            {/* Zoom controls */}
            <div className="flex items-center bg-gallery-dark/90 backdrop-blur-sm border border-gallery-border rounded overflow-hidden">
              <button
                onClick={handleZoomOut}
                className="viewer-control-btn"
                aria-label="Zoom out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
                </svg>
              </button>
              
              <div className="px-3 py-2 font-mono text-xs text-gallery-text min-w-[60px] text-center border-x border-gallery-border">
                {Math.round(zoomLevel * 100)}%
              </div>
              
              <button
                onClick={handleZoomIn}
                className="viewer-control-btn"
                aria-label="Zoom in"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                </svg>
              </button>
              
              <button
                onClick={handleReset}
                className="viewer-control-btn border-l border-gallery-border"
                aria-label="Reset view"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </button>
            </div>

            {/* Info button */}
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className={`
                ml-2 p-3 rounded border transition-colors
                ${showMetadata 
                  ? 'bg-gallery-white text-gallery-black border-gallery-white' 
                  : 'bg-gallery-dark/90 text-gallery-text border-gallery-border hover:text-gallery-white'}
              `}
              aria-label="Toggle metadata"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            {/* Download button */}
            <button
              onClick={handleDownload}
              className="ml-2 p-3 rounded bg-gallery-dark/90 border border-gallery-border text-gallery-text hover:text-gallery-white transition-colors"
              aria-label="Download master file"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>

          {/* Keyboard hints */}
          <div className="mt-4 text-center">
            <p className="font-mono text-[10px] text-gallery-muted tracking-wider">
              SCROLL TO ZOOM · DRAG TO PAN · ARROWS TO NAVIGATE · I FOR INFO · ESC TO CLOSE
            </p>
          </div>
        </div>
      </motion.div>

      {/* Metadata panel */}
      <div className={`metadata-panel ${showMetadata ? 'open' : ''}`}>
        <button
          onClick={() => setShowMetadata(false)}
          className="absolute top-4 right-4 p-2 text-gallery-muted hover:text-gallery-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 className="font-display text-2xl text-gallery-white mb-8">
          {image.title}
        </h3>

        {image.description && (
          <div className="mb-8">
            <div className="metadata-label">Description</div>
            <p className="text-sm text-gallery-text leading-relaxed">
              {image.description}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {image.date && (
            <div>
              <div className="metadata-label">Date</div>
              <div className="metadata-value">{image.date}</div>
            </div>
          )}

          {image.location && (
            <div>
              <div className="metadata-label">Location</div>
              <div className="metadata-value">{image.location}</div>
            </div>
          )}

          <div className="border-t border-gallery-border my-6" />
          
          <div className="metadata-label">Technical</div>
          
          <div className="grid grid-cols-2 gap-4">
            {image.camera && (
              <div>
                <div className="metadata-label">Camera</div>
                <div className="metadata-value">{image.camera}</div>
              </div>
            )}
            
            {image.lens && (
              <div>
                <div className="metadata-label">Lens</div>
                <div className="metadata-value">{image.lens}</div>
              </div>
            )}
            
            {image.focalLength && (
              <div>
                <div className="metadata-label">Focal Length</div>
                <div className="metadata-value">{image.focalLength}</div>
              </div>
            )}
            
            {image.aperture && (
              <div>
                <div className="metadata-label">Aperture</div>
                <div className="metadata-value">{image.aperture}</div>
              </div>
            )}
            
            {image.shutterSpeed && (
              <div>
                <div className="metadata-label">Shutter</div>
                <div className="metadata-value">{image.shutterSpeed}</div>
              </div>
            )}
            
            {image.iso && (
              <div>
                <div className="metadata-label">ISO</div>
                <div className="metadata-value">{image.iso}</div>
              </div>
            )}
          </div>

          <div className="border-t border-gallery-border my-6" />

          <div>
            <div className="metadata-label">Dimensions</div>
            <div className="metadata-value">
              {image.width} × {image.height} px
            </div>
          </div>

          <div>
            <div className="metadata-label">Master File</div>
            <div className="metadata-value">
              {image.masterFormat?.toUpperCase()} · {formatFileSize(image.masterSize)}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={handleDownload}
            className="btn btn-primary w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Master
          </button>
        </div>
      </div>
    </motion.div>
  )
}
