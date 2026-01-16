export interface ImageData {
  id: string
  title: string
  filename: string
  collection?: string
  date?: string
  location?: string
  description?: string
  
  // Dimensions
  width: number
  height: number
  aspectRatio: number
  
  // File paths (relative to storage base URL)
  thumbnail: string      // Small preview for grid (~400px)
  preview: string        // Medium preview for lightbox (~2000px)
  tiles: string          // Path to DZI tiles folder
  master: string         // Full resolution lossless file
  
  // Technical metadata
  camera?: string
  lens?: string
  focalLength?: string
  aperture?: string
  shutterSpeed?: string
  iso?: string
  
  // File info
  masterSize?: number    // Size in bytes
  masterFormat?: string  // 'tiff', 'png', etc.
}

export interface GalleryData {
  title: string
  subtitle?: string
  author: string
  storageBaseUrl: string  // Base URL for cloud storage (R2, S3, etc.)
  images: ImageData[]
  collections: string[]
  lastUpdated: string
}

export interface ViewerState {
  zoom: number
  center: { x: number; y: number }
  isFullscreen: boolean
  showMetadata: boolean
}
