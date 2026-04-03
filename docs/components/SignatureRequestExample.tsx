import { type ComponentType, useEffect, useState } from 'react'
import '../styles.css'

export default function SignatureRequestExample() {
  const [Component, setComponent] = useState<ComponentType | null>(null)

  useEffect(() => {
    Promise.all([
      import('./WalletProvider'),
      import('./SignatureRequestDemo'),
    ]).then(([providerMod, demoMod]) => {
      const Provider = providerMod.WalletProvider
      const Demo = demoMod.default

      setComponent(
        () =>
          function Wrapped() {
            return (
              <Provider>
                <Demo />
              </Provider>
            )
          },
      )
    })
  }, [])

  if (!Component) {
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
      <Component />
    </div>
  )
}
