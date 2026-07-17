import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'

import { cn } from '../../utils/common'
import { useScreenOverlayContainer } from '../Screen'

export interface SheetShellProps {
  /** Whether the sheet is open. Controlled — pair with `onOpenChange`. */
  open: boolean
  /** Called when the sheet requests to close (backdrop click, ESC, back
   * navigation). Also fires with `true` when Radix's internal logic opens
   * the sheet, but that path isn't used here since callers drive `open`. */
  onOpenChange: (open: boolean) => void
  /** Accessible label for the sheet. Rendered visually inside the sheet is
   * up to the caller; this is only used for screen readers. */
  title: string
  /** Sheet body content. */
  children: ReactNode
  /** Extra classes applied to the sheet container (on top of the built-in
   * bottom-sheet chrome). */
  className?: string
}

/**
 * Bottom sheet chrome built on top of Radix Dialog. Composes:
 *   - `Dialog.Portal container={useScreenOverlayContainer()}` so the sheet
 *     renders inside the `Screen`'s clipped frame, not on the page body.
 *   - `Dialog.Overlay` + `Dialog.Content` with `data-state`-bound CSS
 *     animations (defined in `tailwind.config.ts`).
 *   - `Dialog.Title` (visually hidden by default) for a11y.
 *
 * Consumers own the sheet's inner layout; this component only supplies the
 * portal target, backdrop, positioning, and open/close animation.
 */
export function SheetShell({
  open,
  onOpenChange,
  title,
  children,
  className,
}: SheetShellProps) {
  const container = useScreenOverlayContainer()
  if (!container) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={container}>
        <Dialog.Overlay
          className={cn(
            // z-20 stacks above the Screen's content wrapper (z-10) — the
            // portal is a sibling of that wrapper, so without a higher
            // z-index the sheet renders behind the page content.
            'zd:absolute zd:inset-0 zd:z-20 zd:bg-greyScale/20',
            'zd:data-[state=open]:animate-backdrop-in',
            'zd:data-[state=closed]:animate-backdrop-out',
          )}
        />
        <Dialog.Content
          className={cn(
            // Bottom/left/right-0 flush against the inner card; the inner
            // card already sits `m-1.5` (6px) inside the Screen's gradient
            // border, so the sheet doesn't cover the colored border ring.
            'zd:absolute zd:bottom-0 zd:left-0 zd:right-0 zd:z-20',
            'zd:bg-white zd:rounded-[32px] zd:overflow-hidden',
            'zd:outline-none',
            'zd:data-[state=open]:animate-sheet-in',
            'zd:data-[state=closed]:animate-sheet-out',
            className,
          )}
        >
          <Dialog.Title className="zd:sr-only">{title}</Dialog.Title>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
