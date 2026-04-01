import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About — Eddie.Raw',
  description: 'Eddie.Raw is a Sydney-based photographer specializing in street photography, architecture, and urban landscapes. Shot on Fujifilm GFX100S II medium format.',
  alternates: {
    canonical: '/about/',
  },
  openGraph: {
    title: 'About — Eddie.Raw',
    description: 'Eddie.Raw is a Sydney-based photographer specializing in street photography, architecture, and urban landscapes. Shot on Fujifilm GFX100S II medium format.',
    url: 'https://eddieraw.com/about/',
    type: 'website',
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
