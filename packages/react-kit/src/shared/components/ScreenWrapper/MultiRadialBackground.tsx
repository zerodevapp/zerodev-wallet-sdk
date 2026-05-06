import { useId } from 'react'

import { EllipticalRadial, type RadialLayer } from './EllipticalRadial'

export function MultiRadialBackground() {
  const baseId = useId()
  const layers: RadialLayer[] = [
    {
      id: `${baseId}-g1`, // left/top warm brown
      cx: 0.0,
      cy: 0.0629,
      rx: 0.9036,
      ry: 0.572,
      stops: [
        { offset: 0, color: '#B78C71', opacity: 0.85 },
        { offset: 1, color: '#B78C71', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g2`, // right/top blue
      cx: 0.9536,
      cy: 0.0,
      rx: 1.0333,
      ry: 0.6589,
      stops: [
        { offset: 0, color: '#45ABFB', opacity: 1 },
        { offset: 0.4615, color: '#1E9AFB', opacity: 0.54 },
        { offset: 1, color: '#45ABFB', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g3`, // small soft light near top-right
      cx: 0.9667,
      cy: 0.0166,
      rx: 0.9667,
      ry: 0.1382,
      stops: [
        { offset: 0, color: '#F7F5F0', opacity: 0.7 },
        { offset: 1, color: '#F7F5F0', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g4`, // bottom-left orange
      cx: 0.0393,
      cy: 1.0,
      rx: 0.8615,
      ry: 0.7591,
      stops: [
        { offset: 0, color: '#F27B3E', opacity: 0.75 },
        { offset: 0.476, color: '#D44800', opacity: 0.35 },
        { offset: 1, color: '#F27B3E', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g5`, // bottom-center peach
      cx: 0.3476,
      cy: 1.0,
      rx: 0.9612,
      ry: 0.3377,
      stops: [
        { offset: 0, color: '#FAC8AC', opacity: 0.6 },
        { offset: 1, color: '#FAC8AC', opacity: 0 },
      ],
    },
  ]

  return (
    <div className="absolute inset-0 z-0 rounded-[36px] pointer-events-none">
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="img"
        aria-label="Decorative gradient background"
      >
        <rect width="100%" height="100%" fill="#130E0B" />
        {layers.map((layer) => (
          <EllipticalRadial key={layer.id} layer={layer} />
        ))}
      </svg>
    </div>
  )
}
