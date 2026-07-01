import { useId } from 'react'

import { EllipticalRadial, type RadialLayer } from './EllipticalRadial'

// The design frame: the gradient layers live on a 412×812 rect offset to
// (-6,-6) so they bleed 6px past the 400×800 card on every side — that 6px
// reveal is the wrapper's gradient border. The matrices below are the
// Figma-exported gradientTransform values verbatim, so rendering the SVG with
// a matching viewBox + preserveAspectRatio="none" reproduces the design 1:1
// while still scaling to any container size.
const FRAME_VIEWBOX = '-6 -6 412 812'

export function MultiRadialBackground() {
  // The colorful gradient now lives entirely in CardGlow. This base layer is
  // just a flat, soft warm-white fill behind it so CardGlow's colors read
  // bright and clean, with no gray muddiers underneath.
  return (
    <div className="zd:absolute zd:inset-0 zd:z-0 zd:rounded-4xl zd:pointer-events-none">
      <svg
        width="100%"
        height="100%"
        viewBox={FRAME_VIEWBOX}
        preserveAspectRatio="none"
        role="img"
        aria-label="Decorative gradient background"
      >
        <rect x="-6" y="-6" width="412" height="812" fill="#FBF7F2" />
      </svg>
    </div>
  )
}

// On-card overlay (400×800), sitting ON TOP of the translucent card body so its
// color reads at full strength (the card at 0.8 opacity would otherwise wash a
// behind-card gradient to ~20%). This reproduces the vivid orange + blue that in
// the source design came from the decorative "Amorphic" blob raster overlaid on
// the lower card, plus the design's own white card glow (Figma paint6).
//
// The orange + blue lobes are NOT verbatim Figma layers — they reconstruct the
// blob's measured color footprint (orange across the lower card; blue lobe
// bottom-left ~x 0-150 / y 600-800) as gradients, per the decision to treat the
// blob as a background effect rather than ship the raster.
export function CardGlow() {
  const baseId = useId()
  // VERBATIM from the Figma `--Background-Brand-Gradient` token (6 stacked
  // radial-gradients). CSS lists topmost-first; SVG paints last-on-top, so the
  // array is the CSS list REVERSED. Each matrix is the CSS `rx% ry% at cx% cy%`
  // converted over the 400×800 frame. An upward linear fade is applied on top
  // (see the <rect> below) to soften the gradient toward the top.
  const layers: RadialLayer[] = [
    {
      // (CSS #6) blue → top-right. x-radius widened so the lobe reaches further
      // left; y-radius kept short so it stays up top and doesn't bleed into the
      // orange band.
      id: `${baseId}-blue`,
      matrix: [1850, 0, 0, 645, 381.44, 0],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: '#45ABFB', opacity: 0.66 },
        { offset: 0.4615, color: '#1E9AFB', opacity: 0.35 },
        { offset: 1, color: '#45ABFB', opacity: 0 },
      ],
    },
    {
      // (CSS #5) offWhite → blue, very faint
      id: `${baseId}-offwhite-tr`,
      matrix: [55.28, 0, 0, 773.36, 386.68, 13.28],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: '#F7F5F0', opacity: 0.1 },
        { offset: 1, color: '#45ABFB', opacity: 0 },
      ],
    },
    {
      // (CSS #4) warmGrey
      id: `${baseId}-warmgrey`,
      matrix: [326.72, 0, 0, 855.52, 0, 50.32],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: '#E3CFC3', opacity: 1 },
        { offset: 1, color: '#E3CFC3', opacity: 0 },
      ],
    },
    {
      // (CSS #3) orange — spans the full width across the bottom ~30%, uniform.
      id: `${baseId}-orange`,
      matrix: [580, 0, 0, 380, 200, 835],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: '#EE6C2E', opacity: 0.8 },
        { offset: 0.55, color: '#EE6C2E', opacity: 0.6 },
        { offset: 1, color: '#EE6C2E', opacity: 0.15 },
      ],
    },
    {
      // (CSS #2) peach — spread further up (~30% of the bottom), a bit more vivid
      id: `${baseId}-peach`,
      matrix: [520, 0, 0, 560, 180, 830],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: '#FAC8AC', opacity: 1 },
        { offset: 1, color: '#F27B3E', opacity: 0 },
      ],
    },
    {
      // (CSS #1) white glow (topmost of the colour stack)
      id: `${baseId}-white-bl`,
      matrix: [90.72, 0, 0, 550.48, 38.04, 702.64],
      fillOpacity: 1,
      stops: [
        { offset: 0, color: 'white', opacity: 0.58 },
        { offset: 1, color: 'white', opacity: 0 },
      ],
    },
  ]

  return (
    <div className="zd:absolute zd:inset-0 zd:z-0 zd:rounded-4xl zd:pointer-events-none zd:overflow-hidden">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 800"
        preserveAspectRatio="none"
        role="presentation"
      >
        {layers.map((layer) => (
          <EllipticalRadial
            key={layer.id}
            layer={layer}
            rect={{ x: 0, y: 0, width: 400, height: 800 }}
          />
        ))}
        {/* Vertical white fade — strongest at the bottom, easing linearly to
            nothing at the top. Softens the lower (most vivid) part of the
            gradient. A gradient layer (not an opaque card) so the frosted
            buttons composite over it cleanly. */}
        <defs>
          <linearGradient
            id={`${baseId}-vfade`}
            x1="0"
            y1="0"
            x2="0"
            y2="800"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="white" stopOpacity="0.55" />
            <stop offset="0.45" stopColor="white" stopOpacity="0.52" />
            <stop offset="0.65" stopColor="white" stopOpacity="0.5" />
            <stop offset="0.85" stopColor="white" stopOpacity="0.5" />
            <stop offset="1" stopColor="white" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="400"
          height="800"
          fill={`url(#${baseId}-vfade)`}
        />
        {/* Blue — a diagonal linear gradient from the bottom-left corner fading
            to transparent toward the top-right, so it blends smoothly into the
            orange with no hard edge. On top of the fade so #A7B8E2 reads true. */}
        <defs>
          <linearGradient
            id={`${baseId}-bluefade`}
            x1="0"
            y1="800"
            x2="120"
            y2="640"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0" stopColor="#A7B8E2" stopOpacity="1" />
            <stop offset="0.33" stopColor="#A7B8E2" stopOpacity="0.7" />
            <stop offset="0.66" stopColor="#A7B8E2" stopOpacity="0.35" />
            <stop offset="1" stopColor="#A7B8E2" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y="0"
          width="400"
          height="800"
          fill={`url(#${baseId}-bluefade)`}
        />
      </svg>
    </div>
  )
}

// The wrapper's gradient BORDER. Renders full-frame behind the inner card; the
// card sits on top with a 6px margin so this gradient shows as the border ring.
// Uses normalized cx/cy/rx/ry radial gradients (scale-transform) over a #130E0B
// base — the original border look.
type BorderLayer = {
  id: string
  cx: number
  cy: number
  rx: number
  ry: number
  stops: { offset: number; color: string; opacity: number }[]
}

export function WrapperBorder() {
  const baseId = useId()
  // VERBATIM from the Figma `--Background-Brand-Gradient` token (6 stacked
  // radial-gradients). CSS lists topmost-first, SVG paints last-on-top, so the
  // array is the CSS list REVERSED. Each CSS `rx% ry% at cx% cy%` maps to
  // normalized cx/cy/rx/ry (÷100); the inline <radialGradient> below applies
  // the cx=(cx/rx)*100% + scale(rx,ry) convention.
  const layers: BorderLayer[] = [
    {
      id: `${baseId}-g6`, // (CSS #6) blue, top-right
      cx: 0.9536,
      cy: 0.0,
      rx: 0.9385,
      ry: 1.2256,
      stops: [
        { offset: 0, color: '#45ABFB', opacity: 0.6 },
        { offset: 0.4615, color: '#1E9AFB', opacity: 0.32 },
        { offset: 1, color: '#45ABFB', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g5`, // (CSS #5) faint light, top-right
      cx: 0.9667,
      cy: 0.0166,
      rx: 0.1382,
      ry: 0.9667,
      stops: [
        { offset: 0, color: '#F7F5F0', opacity: 0.1 },
        { offset: 1, color: '#45ABFB', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g4`, // (CSS #4) warm grey, top-left
      cx: 0.0,
      cy: 0.0629,
      rx: 0.8168,
      ry: 1.0694,
      stops: [
        { offset: 0, color: '#E3CFC3', opacity: 1 },
        { offset: 1, color: '#E3CFC3', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g3`, // (CSS #3) orange, bottom-left
      cx: 0.0393,
      cy: 1.0,
      rx: 1.0628,
      ry: 1.0303,
      stops: [
        { offset: 0, color: '#FF6B1F', opacity: 1 },
        { offset: 0.476, color: '#E76000', opacity: 0.72 },
        { offset: 1, color: '#E76000', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g2`, // (CSS #2) peach, bottom-center
      cx: 0.3476,
      cy: 1.0,
      rx: 0.9614,
      ry: 0.338,
      stops: [
        { offset: 0, color: '#FAC8AC', opacity: 0.7 },
        { offset: 1, color: '#F27B3E', opacity: 0 },
      ],
    },
    {
      id: `${baseId}-g1`, // (CSS #1) white glow, bottom-left
      cx: 0.0951,
      cy: 0.8783,
      rx: 0.2268,
      ry: 0.6881,
      stops: [
        { offset: 0, color: '#FFFFFF', opacity: 0.58 },
        { offset: 1, color: '#FFFFFF', opacity: 0 },
      ],
    },
  ]

  return (
    <div className="zd:absolute zd:inset-0 zd:z-0 zd:rounded-4xl zd:pointer-events-none zd:overflow-hidden">
      <svg
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        role="presentation"
      >
        <rect width="100%" height="100%" fill="#130E0B" />
        <defs>
          {layers.map((layer) => (
            <radialGradient
              key={layer.id}
              id={layer.id}
              cx={`${(layer.cx / layer.rx) * 100}%`}
              cy={`${(layer.cy / layer.ry) * 100}%`}
              r="100%"
              gradientUnits="objectBoundingBox"
              gradientTransform={`scale(${layer.rx}, ${layer.ry})`}
            >
              {layer.stops.map((s, i) => (
                <stop
                  key={s.color + i.toString()}
                  offset={s.offset}
                  stopColor={s.color}
                  stopOpacity={s.opacity}
                />
              ))}
            </radialGradient>
          ))}
        </defs>
        {layers.map((layer) => (
          <rect
            key={`${layer.id}-rect`}
            width="100%"
            height="100%"
            fill={`url(#${layer.id})`}
          />
        ))}
      </svg>
    </div>
  )
}
