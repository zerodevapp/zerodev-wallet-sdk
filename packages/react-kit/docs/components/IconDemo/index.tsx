import { type ComponentType, useEffect, useState } from 'react'
import '../../styles.css'

export default function IconDemoLoader() {
  const [Component, setComponent] = useState<ComponentType | null>(null)

  useEffect(() => {
    import('./Demo').then((mod) => {
      setComponent(() => mod.default)
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
