import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eddie.Raw',
  description: 'A permanent gallery of photographs by Eddie.Raw. Medium format photography capturing moments across the world.',
  keywords: ['photography', 'medium format', 'Fujifilm GFX', 'fine art', 'gallery', 'Eddie.Raw'],
  authors: [{ name: 'Eddie.Raw' }],
  openGraph: {
    title: 'Eddie.Raw',
    description: 'A permanent gallery of photographs by Eddie.Raw. Medium format photography capturing moments across the world.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
