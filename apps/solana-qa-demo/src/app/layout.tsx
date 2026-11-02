import type { Metadata } from 'next'
import Link from 'next/link'
import { Providers } from './providers'

import '@zerodev/wallet-react-ui/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Solana QA demo',
  description: 'Connect, sign a message, disconnect. Kit vs wagmi-only.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>
          <header className="border-b border-border-warm">
            <nav className="mx-auto flex max-w-3xl gap-4 px-6 py-4 text-sm">
              <Link href="/" className="font-semibold">
                Solana QA demo
              </Link>
              <Link href="/with-solana" className="text-muted hover:text-ink">
                /with-solana
              </Link>
              <Link
                href="/without-solana"
                className="text-muted hover:text-ink"
              >
                /without-solana
              </Link>
            </nav>
          </header>
          <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  )
}
