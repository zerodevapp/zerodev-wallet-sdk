import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from 'react'
import { cn } from '../../utils/common'
import { TOP_NAV_HEIGHT } from '../TopNav'
import {
  CardGlow,
  MultiRadialBackground,
  WrapperBorder,
} from './MultiRadialBackground'

const CONTENT_PADDING_TOP = TOP_NAV_HEIGHT + 16

// Container for card-scoped overlays (bottom sheets, dialogs, etc.). Consumers
// portal into this element via `Radix Dialog.Portal container={...}` so the
// overlay is clipped inside the card's rounded frame instead of covering the
// whole page. Populated once Screen's inner card mounts.
const ScreenOverlayContext = createContext<HTMLDivElement | null>(null)

/** Element inside `Screen` that overlay/portal-based components (e.g. the QR
 * sheet) should render into. Returns `null` outside a `Screen` — callers
 * should guard on that and skip rendering. */
export function useScreenOverlayContainer() {
  return useContext(ScreenOverlayContext)
}

export function Screen({
  children,
  className,
  contentClassName,
  size = 'lg',
  style,
  topNav,
  overlay,
}: {
  children: ReactNode
  className?: string | undefined
  contentClassName?: string | undefined
  size?: 'sm' | 'md' | 'lg' | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
  overlay?: ReactNode
}) {
  // Overlay container ref goes into state so children re-render once the DOM
  // node is available — that lets deeply nested components own their own
  // overlay state and portal into the card without hoisting it up here.
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null)

  return (
    <div
      data-zd-size={size}
      className={cn(
        // 400×810 by default, but never taller/wider than the parent — a
        // consumer wrapper with its own size caps the Screen (max-w/h-full =
        // 100% of the parent). overflow-hidden clips the frame to its rounded
        // border ring; content scrolls in the inner div below.
        'zd:relative zd:flex zd:flex-col zd:text-left',
        // w-100 = 400px, h-202.5 = 810px at density 1; both compile to
        // calc(var(--zd-spacing) * N), so they scale with the size variants.
        // rounded-[38px] = inner card radius (32px) + the 6px border-ring gap,
        // so the ring has a uniform width — equal inner/outer radii would make
        // the corners read thicker than the sides.
        'zd:w-100 zd:h-202.5 zd:max-w-full zd:max-h-full zd:overflow-hidden zd:rounded-[38px]',
        className,
      )}
      style={style}
    >
      {/* Gradient border layer — fills the frame; the card on top has a 6px
          margin so this shows as the border ring. */}
      <WrapperBorder />
      {/* Inner card sits on top with a 6px margin, exposing the border ring.
          Its own gradient (base + CardGlow) fills the card so the colour stays
          vivid and distinct from the border. */}
      <div
        ref={setOverlayContainer}
        className={cn(
          // m-1.5 = calc(var(--zd-spacing) * 1.5) = 6px at density 1, so the
          // gradient border ring thins with the size variants. (Corner radii
          // stay fixed, so at smaller sizes the ring is marginally non-uniform
          // at the corners — a minor cosmetic trade-off.)
          'zd:flex zd:flex-1 zd:flex-col zd:m-1.5 zd:px-4 zd:overflow-hidden zd:rounded-4xl zd:relative',
          contentClassName,
        )}
        // clip-path clips backdrop-filter to the rounded corners; plain
        // overflow-hidden does not (WebKit/Chromium leaves scrolled blurred
        // children bleeding past the radius). Must match rounded-4xl (32px).
        style={{ clipPath: 'inset(0 round 32px)' }}
      >
        <MultiRadialBackground />
        <CardGlow />
        <div className="zd:relative zd:z-10 zd:flex zd:flex-1 zd:flex-col zd:min-h-0">
          {topNav}
          <div
            className="zd:flex zd:flex-1 zd:flex-col zd:min-h-0 zd:overflow-y-auto zd:overflow-x-hidden zd:-mr-4 zd:pr-4"
            // Scale via --zd-spacing (matches TopNav's scaled height) so the
            // top padding shrinks with the frame — otherwise the fixed 68px
            // eats a disproportionate share at smaller sizes and overflows.
            style={{
              paddingTop: `calc(${CONTENT_PADDING_TOP / 4} * var(--zd-spacing))`,
            }}
          >
            <ScreenOverlayContext.Provider value={overlayContainer}>
              {children}
            </ScreenOverlayContext.Provider>
          </div>
        </div>
      </div>
      {/* Overlay is a sibling of the inner card, not a child — so it escapes
          the card's clip-path + horizontal padding, and its own absolute
          `inset-0` fills the outer 400×810 frame. That lets the backdrop dim
          the TopNav band too and lets a bottom sheet anchor to the outer
          frame's bottom, not the padded inner card. */}
      {overlay}
    </div>
  )
}
