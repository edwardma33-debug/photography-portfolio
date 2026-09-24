import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://eddieraw.com'),
  title: 'Eddie.Raw — Photography',
  description: 'A permanent gallery of photographs by Eddie.Raw. Medium format photography capturing moments across the world.',
  keywords: ['photography', 'medium format', 'Fujifilm GFX', 'fine art', 'gallery', 'Eddie.Raw', 'Edward Ma', 'Sydney'],
  authors: [{ name: 'Eddie.Raw' }],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Eddie.Raw — Photography',
    description: 'A permanent gallery of photographs by Eddie.Raw. Medium format photography capturing moments across the world.',
    url: 'https://eddieraw.com',
    siteName: 'Eddie.Raw',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Eddie.Raw — Photography',
    description: 'A permanent gallery of photographs by Eddie.Raw. Medium format photography capturing moments across the world.',
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
