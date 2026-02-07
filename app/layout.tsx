import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PolyAgent - Polymarket Trading Hub',
  description: 'Your cheatcode for Polymarket trading - Scout, analyze, and copy trade the best performers',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
