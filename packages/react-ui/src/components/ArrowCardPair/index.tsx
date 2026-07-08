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
  return <Arrow {...(className === undefined ? {} : { className })} />
}

export interface ArrowCardPairProps {
  topCard: ReactNode
  bottomCard: ReactNode
}

export function ArrowCardPair({ topCard, bottomCard }: ArrowCardPairProps) {
  return (
    <div className="zd:relative zd:flex zd:flex-col zd:gap-1 zd:items-center zd:justify-center zd:w-full">
      <ClippedCard position="top">{topCard}</ClippedCard>
      <ClippedCard position="bottom">{bottomCard}</ClippedCard>
      <div className="zd:absolute zd:inset-0 zd:flex zd:items-center zd:justify-center zd:pointer-events-none">
        <Arrow />
      </div>
    </div>
  )
}
