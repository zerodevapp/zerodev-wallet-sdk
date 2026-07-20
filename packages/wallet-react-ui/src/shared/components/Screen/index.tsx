import { cn } from '@zerodev/react-ui'
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from 'react'
import { TOP_NAV_HEIGHT } from '../TopNav'
import {
  CardGlow,
  MultiRadialBackground,
  WrapperBorder,
} from './MultiRadialBackground'

const CONTENT_PADDING_TOP = TOP_NAV_HEIGHT + 16
// Fixed footer zone (PoweredBy). Content scrolls behind neither the nav nor
// this — the scroll viewport is inset by margins on both ends.
const FOOTER_HEIGHT = 56

/**
 * Portal target for overlays (sheets, dialogs) that must span the Screen's
 * inner card edge-to-edge — the card is `relative`, unpadded, and its
 * clip-path rounds anything reaching the corners. Children of Screen read it
 * via `useScreenOverlayTarget()` and `createPortal` into it; `null` until the
 * card has mounted (and during SSR).
 */
const ScreenOverlayContext = createContext<HTMLDivElement | null>(null)

export function useScreenOverlayTarget() {
  return useContext(ScreenOverlayContext)
}

export function Screen({
  children,
  className,
  contentClassName,
  footer,
  size = 'lg',
  style,
  topNav,
}: {
  children: ReactNode
  className?: string | undefined
  contentClassName?: string | undefined
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
}) {
  // State (not a ref) so consumers re-render once the target exists.
  const [overlayTarget, setOverlayTarget] = useState<HTMLDivElement | null>(
    null,
  )

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
        ref={setOverlayTarget}
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
            className="zd:flex zd:flex-1 zd:flex-col zd:min-h-0 zd:overflow-y-auto zd:overflow-x-hidden"
            // Margin (not padding) so the scroll viewport itself starts below
            // the absolutely-positioned TopNav: scrolled content clips at the
            // nav's bottom edge instead of sliding beneath the transparent
            // nav. Scaled via --zd-spacing (matches TopNav's scaled height)
            // so the offset shrinks with the size variants.
            style={{
              marginTop: `calc(${CONTENT_PADDING_TOP / 4} * var(--zd-spacing))`,
              ...(footer && {
                marginBottom: `calc(${FOOTER_HEIGHT / 4} * var(--zd-spacing))`,
              }),
            }}
          >
            <ScreenOverlayContext.Provider value={overlayTarget}>
              {children}
            </ScreenOverlayContext.Provider>
          </div>
          {footer && (
            <div
              className="zd:absolute zd:inset-x-0 zd:bottom-0 zd:flex zd:items-center zd:justify-center"
              style={{
                height: `calc(${FOOTER_HEIGHT / 4} * var(--zd-spacing))`,
              }}
            >
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
