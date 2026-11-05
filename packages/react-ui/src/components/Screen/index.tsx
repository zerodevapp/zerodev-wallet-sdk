import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  applyThemeToElement,
  type ResolvedTheme,
  resolveTheme,
  type ThemeInput,
  themeAttributes,
  themeStyle,
} from '../../theme/theme'
import { cn } from '../../utils/common'
import { getZdPortalRoot } from '../../utils/portal'
import { TOP_NAV_HEIGHT } from '../TopNav'
import {
  CardGlow,
  MultiRadialBackground,
  WrapperBorder,
} from './MultiRadialBackground'

const CONTENT_PADDING_TOP = TOP_NAV_HEIGHT + 16
const FOOTER_HEIGHT = 56

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
  theme,
  style,
  topNav,
  footer,
  overlay,
}: {
  children: ReactNode
  className?: string | undefined
  contentClassName?: string | undefined
  size?: 'sm' | 'md' | 'lg' | undefined
  /** The theme: a preset name (`'plain-dark'`), or mode, brand and token
   * overrides. Omitted, the frame inherits whatever theme an ancestor sets,
   * else the default (branded light). See `Theme`. */
  theme?: ThemeInput | undefined
  style?: CSSProperties | undefined
  topNav?: ReactNode
  /** Pinned bottom band — mirrors `topNav`: edge-to-edge, transparent;
   * scrolled content stops at its top edge. */
  footer?: ReactNode
  overlay?: ReactNode
}) {
  // Overlay container ref goes into state so children re-render once the DOM
  // node is available — that lets deeply nested components own their own
  // overlay state and portal into the card without hoisting it up here.
  const [overlayContainer, setOverlayContainer] =
    useState<HTMLDivElement | null>(null)

  // Keyed on the resolved value, not the prop's identity: a host passing an
  // inline object must not re-run the portal sync every render.
  const themeKey =
    theme === undefined ? null : JSON.stringify(resolveTheme(theme))
  const resolvedTheme = useMemo(
    (): ResolvedTheme | null =>
      themeKey === null ? null : (JSON.parse(themeKey) as ResolvedTheme),
    [themeKey],
  )
  // Surfaces that portal out of the frame (tooltips, selects) land in the
  // portal root on document.body, outside this element's attributes and
  // inline properties; mirror the theme there. With several themed frames
  // mounted at once the latest one wins, and its unmount clears it.
  useEffect(() => {
    if (resolvedTheme === null) return
    return applyThemeToElement(getZdPortalRoot(), resolvedTheme)
  }, [resolvedTheme])

  return (
    <div
      data-zd-size={size}
      {...(resolvedTheme && themeAttributes(resolvedTheme))}
      className={cn(
        // Style boundary. reset.css scopes its preflight replacement under
        // this class.
        'zd-scope',
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
      style={resolvedTheme ? { ...themeStyle(resolvedTheme), ...style } : style}
    >
      {/* Gradient border layer — fills the frame; the card on top has a 6px
          margin so this shows as the border ring. Brand art: hidden under
          the plain brand (theme/brand.css). */}
      <div className="zd-brand-art zd:contents">
        <WrapperBorder />
      </div>
      {/* The plain band in its place: the frame-ring token, shown through
          the same 6px margin. */}
      <div
        aria-hidden
        className="zd-plain-frame zd:absolute zd:inset-0 zd:z-0 zd:rounded-4xl zd:bg-frame-ring zd:pointer-events-none"
      />
      {/* Inner card sits on top with a 6px margin, exposing the border ring.
          Its own gradient (base + CardGlow) fills the card so the colour stays
          vivid and distinct from the border. Under the plain brand the ring
          becomes a flat band and the glow a flat frosted surface. */}
      <div
        ref={setOverlayContainer}
        className={cn(
          // m-1.5 = calc(var(--zd-spacing) * 1.5) = 6px at density 1, so the
          // gradient border ring thins with the size variants. (Corner radii
          // stay fixed, so at smaller sizes the ring is marginally non-uniform
          // at the corners — a minor cosmetic trade-off.)
          // Horizontal padding lives on the scroll container so TopNav and
          // footer can span edge-to-edge without escape offsets.
          'zd:flex zd:flex-1 zd:flex-col zd:m-1.5 zd:overflow-hidden zd:rounded-4xl zd:relative',
          contentClassName,
        )}
        // clip-path clips backdrop-filter to the rounded corners; plain
        // overflow-hidden does not (WebKit/Chromium leaves scrolled blurred
        // children bleeding past the radius). Must match rounded-4xl (32px).
        style={{ clipPath: 'inset(0 round 32px)' }}
      >
        <div className="zd-brand-art zd:contents">
          <MultiRadialBackground />
          <CardGlow />
        </div>
        {/* The plain surface: the neutral background token, frosted — the
            design's "blur effect" card. */}
        <div
          aria-hidden
          className="zd-plain-surface zd:absolute zd:inset-0 zd:z-0 zd:rounded-4xl zd:bg-neutral-primary zd:backdrop-blur-[30px] zd:pointer-events-none"
        />
        <div className="zd:relative zd:z-10 zd:flex zd:flex-1 zd:flex-col zd:min-h-0">
          {topNav}
          <div
            // Owns horizontal padding — pages needing edge-to-edge content
            // escape via `zd:-mx-4` on their own outer wrapper.
            className="zd:flex zd:flex-1 zd:flex-col zd:min-h-0 zd:overflow-y-auto zd:overflow-x-hidden zd:px-4"
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
          {footer && (
            <div
              // Flex sibling so scrolled content stops at the footer's top
              // edge; internal px-4 keeps the content at the 16px inset.
              className="zd:flex zd:shrink-0 zd:items-center zd:justify-center zd:px-4 zd:pb-4"
              style={{
                height: `calc(${FOOTER_HEIGHT / 4} * var(--zd-spacing))`,
              }}
            >
              {footer}
            </div>
          )}
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
