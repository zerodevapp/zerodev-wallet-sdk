import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScreenOverlayTarget } from '../../../shared/components/Screen'
import {
  CardGlow,
  MultiRadialBackground,
} from '../../../shared/components/Screen/MultiRadialBackground'

/**
 * Chrome shared by the bottom sheets: backdrop + sliding panel with the
 * Screen card's gradient treatment, rendered through the Screen's overlay
 * portal so it spans the inner card edge-to-edge (the card's clip-path rounds
 * the bottom corners). Always mounted so the translate transition animates
 * both directions. Headers/content are the caller's business.
 */
export function SheetShell({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  const overlayTarget = useScreenOverlayTarget()

  if (!overlayTarget) return null

  return createPortal(
    <>
      {/* backdrop — z-20 to paint above the card's z-10 content column */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`zd:absolute zd:inset-0 zd:z-20 zd:bg-black/30 zd:transition-opacity zd:duration-300 ${
          open ? 'zd:opacity-100' : 'zd:opacity-0 zd:pointer-events-none'
        }`}
      />

      {/* panel — gradient layers behind a z-10 content wrapper (positioned
          z-0 layers would otherwise paint over in-flow content).
          rounded-t-4xl matches the card's 32px radius AND the layers' own
          rounding, so the base fill never peeks out at the corners. */}
      <div
        className={`zd:absolute zd:inset-x-0 zd:bottom-0 zd:z-20 zd:rounded-t-4xl zd:overflow-hidden zd:bg-[#FBF7F2] zd:p-4 zd:transition-transform zd:duration-300 ${
          open ? 'zd:translate-y-0' : 'zd:translate-y-full'
        }`}
      >
        <MultiRadialBackground />
        <CardGlow />
        <div className="zd:relative zd:z-10 zd:flex zd:flex-col zd:gap-3 zd:items-center">
          {children}
        </div>
      </div>
    </>,
    overlayTarget,
  )
}
