import type { Metadata } from 'next'

import '@zerodev/smart-routing-address-react-ui/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Smart Routing Address Demo',
  description: 'Demo for ZeroDev Smart Routing Address deposits',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}
