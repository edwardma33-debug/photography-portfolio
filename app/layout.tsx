import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Edward Ma — Photography',
  description: 'A permanent gallery of photographs by Edward Ma. Medium format photography capturing moments across the world.',
  keywords: ['photography', 'medium format', 'Fujifilm GFX', 'fine art', 'gallery'],
  authors: [{ name: 'Edward Ma' }],
  openGraph: {
    title: 'Edward Ma — Photography',
    description: 'A permanent gallery of photographs',
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
