import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Wrapper } from '../Wrapper'

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
      className="zd:w-full"
      style={{ clipPath }}
    >
      {children}
    </div>
  )
}

function Arrow({ className }: { className?: string }) {
  return (
    <div className={cn('zd:p-1 zd:rounded-2xl', className)}>
      <Wrapper className="zd:w-11 zd:h-11 zd:flex zd:items-center zd:justify-center zd:rounded-xl">
        <Icon name="chevronDown" className="zd:w-4 zd:h-4" />
      </Wrapper>
    </div>
  )
}

export function ArrowView({ className }: { className?: string }) {
  return <Arrow {...(className !== undefined && { className })} />
}

export interface ArrowCardPairProps {
  topCard: ReactNode
  bottomCard: ReactNode
}

export function ArrowCardPair({ topCard, bottomCard }: ArrowCardPairProps) {
  // Pure CSS layout — no measurement, no ResizeObserver. Between the two
  // ClippedCards we drop a zero-height "seam" anchor with equal margins on
  // top and bottom that add up to GAP. The seam's y-coordinate is therefore
  // exactly at the centre of the gap, and the arrow — absolutely positioned
  // inside the seam with `top: 0` and `translate(-50%, -50%)` — centres on
  // that y regardless of either card's height.
  const seamMargin = GAP / 2

  return (
    <div className="zd:relative zd:flex zd:flex-col zd:items-center zd:w-full">
      <ClippedCard position="top">{topCard}</ClippedCard>
      <div
        className="zd:relative zd:w-full"
        style={{
          height: 0,
          marginTop: seamMargin,
          marginBottom: seamMargin,
        }}
      >
        <div
          className="zd:absolute zd:left-1/2 zd:top-0 zd:pointer-events-none"
          style={{ transform: 'translate(-50%, -50%)' }}
        >
          <Arrow />
        </div>
      </div>
      <ClippedCard position="bottom">{bottomCard}</ClippedCard>
    </div>
  )
}
