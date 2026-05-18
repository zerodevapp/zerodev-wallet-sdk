import { type ReactNode, useEffect, useRef, useState } from 'react'

import { Icon } from '../../../shared/components/Icon'
import { Wrapper } from '../../../shared/components/Wrapper'
import { cn } from '../../../shared/utils/common'

const ARROW_INNER = 44
const PADDING = 4
const ARROW_OUTER = ARROW_INNER + PADDING * 2
const GAP = 4
const OVERLAP = (ARROW_OUTER - GAP) / 2
const HALF = ARROW_OUTER / 2
const R = 16

function buildClipPath(
  w: number,
  h: number,
  position: 'top' | 'bottom',
): string {
  const cx = w / 2

  if (position === 'top') {
    const ny = h - OVERLAP
    return [
      'M 0 0',
      `L ${w} 0`,
      `L ${w} ${h}`,
      `L ${cx + HALF} ${h}`,
      `L ${cx + HALF} ${ny + R}`,
      `A ${R} ${R} 0 0 0 ${cx + HALF - R} ${ny}`,
      `L ${cx - HALF + R} ${ny}`,
      `A ${R} ${R} 0 0 0 ${cx - HALF} ${ny + R}`,
      `L ${cx - HALF} ${h}`,
      `L 0 ${h}`,
      'Z',
    ].join(' ')
  }

  const nb = OVERLAP
  return [
    'M 0 0',
    `L ${cx - HALF} 0`,
    `L ${cx - HALF} ${nb - R}`,
    `A ${R} ${R} 0 0 0 ${cx - HALF + R} ${nb}`,
    `L ${cx + HALF - R} ${nb}`,
    `A ${R} ${R} 0 0 0 ${cx + HALF} ${nb - R}`,
    `L ${cx + HALF} 0`,
    `L ${w} 0`,
    `L ${w} ${h}`,
    `L 0 ${h}`,
    'Z',
  ].join(' ')
}

function ClippedCard({
  position,
  children,
}: {
  position: 'top' | 'bottom'
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<{ width: number; height: number }>()

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setLayout((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : { width, height },
      )
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
  }, [])

  const clipPath = layout
    ? `path("${buildClipPath(layout.width, layout.height, position)}")`
    : undefined

  return (
    <div
      ref={ref}
      data-testid={`clipped-card-${position}`}
      className="w-full"
      style={{ clipPath }}
    >
      {children}
    </div>
  )
}

// Outline that traces the outer 52×52 rounded square but skips the GAP-wide
// vertical strips on the left and right (which would otherwise float in the
// empty space between the two cards). Mirrors RN's ArrowBorderSvg.
const ARROW_BORDER_PATH = (() => {
  const gapTop = HALF - GAP / 2
  const gapBottom = HALF + GAP / 2
  return [
    `M ${R} 0`,
    `L ${ARROW_OUTER - R} 0`,
    `A ${R} ${R} 0 0 1 ${ARROW_OUTER} ${R}`,
    `L ${ARROW_OUTER} ${gapTop}`,
    `M ${ARROW_OUTER} ${gapBottom}`,
    `L ${ARROW_OUTER} ${ARROW_OUTER - R}`,
    `A ${R} ${R} 0 0 1 ${ARROW_OUTER - R} ${ARROW_OUTER}`,
    `L ${R} ${ARROW_OUTER}`,
    `A ${R} ${R} 0 0 1 0 ${ARROW_OUTER - R}`,
    `L 0 ${gapBottom}`,
    `M 0 ${gapTop}`,
    `L 0 ${R}`,
    `A ${R} ${R} 0 0 1 ${R} 0`,
  ].join(' ')
})()

function Arrow({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative p-1 rounded-2xl', className)}
      style={{ width: ARROW_OUTER, height: ARROW_OUTER }}
    >
      <svg
        width={ARROW_OUTER}
        height={ARROW_OUTER}
        viewBox={`0 0 ${ARROW_OUTER} ${ARROW_OUTER}`}
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
      >
        <path
          d={ARROW_BORDER_PATH}
          fill="none"
          stroke="white"
          strokeWidth={0.3}
        />
      </svg>
      <Wrapper className="w-11 h-11 flex items-center justify-center rounded-xl">
        <Icon name="chevronDown" className="w-4 h-4" />
      </Wrapper>
    </div>
  )
}

export function ArrowView({ className }: { className?: string }) {
  return <Arrow {...(className === undefined ? {} : { className })} />
}

export interface ArrowCardPairProps {
  topCard: ReactNode
  bottomCard: ReactNode
}

export function ArrowCardPair({ topCard, bottomCard }: ArrowCardPairProps) {
  return (
    <div className="relative flex flex-col gap-1 items-center justify-center w-full">
      <ClippedCard position="top">{topCard}</ClippedCard>
      <ClippedCard position="bottom">{bottomCard}</ClippedCard>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <Arrow />
      </div>
    </div>
  )
}
