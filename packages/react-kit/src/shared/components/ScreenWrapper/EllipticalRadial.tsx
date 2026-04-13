export interface RadialLayer {
  id: string
  cx: number
  cy: number
  rx: number
  ry: number
  stops: { offset: number; color: string; opacity: number }[]
}

export function EllipticalRadial({ layer }: { layer: RadialLayer }) {
  const { id, cx, cy, rx, ry, stops } = layer
  const adjCx = `${(cx / rx) * 100}%`
  const adjCy = `${(cy / ry) * 100}%`

  return (
    <>
      <defs>
        <radialGradient
          id={id}
          cx={adjCx}
          cy={adjCy}
          r="100%"
          gradientUnits="objectBoundingBox"
          gradientTransform={`scale(${rx}, ${ry})`}
        >
          {stops.map((s, i) => (
            <stop
              key={s.color + i.toString()}
              offset={s.offset}
              stopColor={s.color}
              stopOpacity={s.opacity}
            />
          ))}
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  )
}
