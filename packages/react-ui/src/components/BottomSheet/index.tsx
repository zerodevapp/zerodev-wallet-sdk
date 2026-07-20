import { Dialog } from 'radix-ui'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '../../utils/common'
import { useScreenOverlayContainer } from '../Screen'

export const BottomSheet = Dialog.Root
export const SheetClose = Dialog.Close

/** Accessible label for the sheet. `sr-only` by default — consumers who want
 * a visible title render their own heading inside `<SheetContent>` and keep
 * `<SheetTitle>` as the screen-reader label. */
export function SheetTitle({
  className,
  ...props
}: ComponentProps<typeof Dialog.Title>) {
  return <Dialog.Title className={cn('zd:sr-only', className)} {...props} />
}

/** Bottom-anchored sheet chrome. Portals into the nearest `Screen`, renders
 * the backdrop + panel, and drives open/close animations from Radix's
 * `data-state` attribute. Wrap in `<BottomSheet open onOpenChange>` and
 * compose children freely (title, body, `<SheetClose>` action). */
export function SheetContent({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const container = useScreenOverlayContainer()
  if (!container) return null

  return (
    <Dialog.Portal container={container}>
      <Dialog.Overlay
        className={cn(
          'zd:absolute zd:inset-0 zd:z-20 zd:bg-greyScale/20',
          'zd:data-[state=open]:animate-backdrop-in',
          'zd:data-[state=closed]:animate-backdrop-out',
        )}
      />
      <Dialog.Content
        className={cn(
          'zd:absolute zd:bottom-0 zd:left-0 zd:right-0 zd:z-20',
          'zd:bg-white zd:rounded-[32px] zd:overflow-hidden',
          'zd:outline-none',
          'zd:data-[state=open]:animate-sheet-in',
          'zd:data-[state=closed]:animate-sheet-out',
          className,
        )}
      >
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  )
}
