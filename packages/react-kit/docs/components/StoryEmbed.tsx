const STORYBOOK_URL = 'http://localhost:6006'

interface StoryEmbedProps {
  id: string
  height?: number
}

export function StoryEmbed({ id, height = 200 }: StoryEmbedProps) {
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
          height,
        }}
      >
        Loading Storybook...
      </div>
    )
  }

  return (
    <iframe
      src={`${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story`}
      style={{
        width: '100%',
        height,
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        marginTop: 16,
        background: '#f9fafb',
      }}
      title={id}
    />
  )
}
