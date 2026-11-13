import { Tooltip as TooltipPrimitive } from 'radix-ui'
import type { ComponentProps, ReactNode, Ref } from 'react'

import { cn } from '../../utils/common'
import { useZdPortalContainer } from '../../utils/portal'

/**
 * Floating tooltip wrapping the Radix primitive with our token palette.
 *
 * The primitive is unopinionated about presentation — this file adds:
 *   - default styling (dark ink bg, white text, 8px offset, subtle shadow)
 *   - a bundled `Provider` so the common case (a single tooltip in a row)
 *     doesn't require the consumer to remember to wrap the tree
 *   - a Portal render so tooltips escape overflow-hidden ancestors
 *
 * For dense trees where mount overhead matters, use `TooltipProvider` at
 * the app root and drop the internal Provider by importing `TooltipRoot`
 * / `TooltipTrigger` / `TooltipContent` directly.
 */

export const TooltipProvider = TooltipPrimitive.Provider
export const TooltipRoot = TooltipPrimitive.Root
export const TooltipTrigger = TooltipPrimitive.Trigger

export function TooltipPortal({
  container,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Portal>) {
  const defaultContainer = useZdPortalContainer()
  return (
    <TooltipPrimitive.Portal
      container={container ?? defaultContainer}
      {...props}
    />
  )
}

export interface TooltipContentProps
  extends ComponentProps<typeof TooltipPrimitive.Content> {
  ref?: Ref<HTMLDivElement>
}

/** Styled content surface — dark chip, ~11.5px semibold copy, arrow-less. */
export function TooltipContent({
  ref,
  className,
  sideOffset = 8,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'zd:z-50 zd:max-w-[220px] zd:rounded-lg zd:px-2 zd:py-1.5',
        'zd:bg-inverse-primary zd:text-body3 zd:font-semibold zd:text-inverse-primary zd:text-center',
        'zd:shadow-[0_8px_22px_-10px_rgba(25,17,11,0.45)]',
        // Match the popper-in animation used by Select so all our floating
        // surfaces share one motion vocabulary.
        'zd:data-[state=delayed-open]:animate-popper-in',
        className,
      )}
      {...props}
    />
  )
}

export interface TooltipProps {
  /** Trigger element — receives Radix's ref + event handlers via `asChild`. */
  children: ReactNode
  /** Tooltip copy. When omitted, the trigger renders without a tooltip. */
  content?: ReactNode
  /** Delay before the tooltip appears on hover. Defaults to 200ms. */
  delayDuration?: number
  /** Side to render on. Defaults to `top`. */
  side?: ComponentProps<typeof TooltipPrimitive.Content>['side']
  /** Alignment along `side`. Defaults to `center`. */
  align?: ComponentProps<typeof TooltipPrimitive.Content>['align']
}

/**
 * Opinionated one-shot tooltip. Wraps its child in a Radix Trigger and mounts
 * a portalled content surface; no-op when `content` is empty so callers can
 * pass an optional string without conditional rendering.
 */
export function Tooltip({
  children,
  content,
  delayDuration = 200,
  side = 'top',
  align = 'center',
}: TooltipProps) {
  if (!content) return <>{children}</>
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipRoot>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side={side} align={align}>
            {content}
          </TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}
