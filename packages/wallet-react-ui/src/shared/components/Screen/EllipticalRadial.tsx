interface RadialStop {
  offset: number
  color: string
  opacity: number
}

export interface RadialLayer {
  id: string
  // Figma-exported gradientTransform matrix: the unit circle
  // (center 0,0 radius 1) mapped to a rotated/scaled/translated ellipse.
  matrix: [number, number, number, number, number, number]
  // Opacity of the rect the gradient fills (Figma exports this on the <rect>).
  fillOpacity: number
  stops: RadialStop[]
}

// The rect each gradient fills, in the parent SVG's viewBox coordinates.
interface RadialRect {
  x: number
  y: number
  width: number
  height: number
}

export function EllipticalRadial({
  layer,
  rect,
}: {
  layer: RadialLayer
  rect: RadialRect
}) {
  const { id, matrix, fillOpacity, stops } = layer

  return (
    <>
      <defs>
        <radialGradient
          id={id}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform={`matrix(${matrix.join(' ')})`}
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
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        fill={`url(#${id})`}
        fillOpacity={fillOpacity}
      />
    </>
  )
}
