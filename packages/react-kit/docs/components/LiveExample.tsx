import { lazy, type ReactNode, Suspense } from 'react'
import '../styles.css'

const WalletProviderLazy = lazy(() =>
  import('./WalletProvider').then((mod) => ({ default: mod.WalletProvider })),
)

export function LiveExample({ children }: { children: ReactNode }) {
  if (typeof window === 'undefined') {
    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
          marginTop: 16,
          background: '#f9fafb',
          color: '#999',
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    )
  }

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginTop: 16,
        background: '#f9fafb',
      }}
    >
      <Suspense
        fallback={<div style={{ color: '#999', fontSize: 13 }}>Loading...</div>}
      >
        <WalletProviderLazy>{children}</WalletProviderLazy>
      </Suspense>
    </div>
  )
}

export function LazyDemo({
  load,
}: {
  load: () => Promise<{ default: React.ComponentType }>
}) {
  if (typeof window === 'undefined') {
    return (
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 24,
          marginTop: 16,
          background: '#f9fafb',
          color: '#999',
          fontSize: 13,
        }}
      >
        Loading...
      </div>
    )
  }

  const Component = lazy(load)

  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
        marginTop: 16,
        background: '#f9fafb',
      }}
    >
      <Suspense
        fallback={<div style={{ color: '#999', fontSize: 13 }}>Loading...</div>}
      >
        <WalletProviderLazy>
          <Component />
        </WalletProviderLazy>
      </Suspense>
    </div>
  )
}
