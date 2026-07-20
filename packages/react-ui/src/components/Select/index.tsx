import { Select as SelectPrimitive } from 'radix-ui'
import type { ComponentProps, Ref } from 'react'

import { cn } from '../../utils/common'
import { Icon } from '../Icon'
import { Wrapper } from '../Wrapper'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value
export const SelectItemText = SelectPrimitive.ItemText

/** Bare styled trigger. Use `asChild` to wrap a custom trigger like `Pill`. */
export function SelectTrigger({
  ref,
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & {
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        'zd:inline-flex zd:items-center zd:justify-between zd:gap-2',
        'zd:outline-none zd:cursor-pointer',
        // Radix Select sets `pointer-events: none` on the body while the
        // panel is open (part of its scroll-lock/dismiss-layer behavior),
        // which falls back the cursor to `default` even over the trigger.
        // Re-enable pointer events + cursor when the trigger is open so
        // the hover cue stays consistent.
        'zd:data-[state=open]:pointer-events-auto zd:data-[state=open]:cursor-pointer',
        'zd:disabled:cursor-not-allowed zd:disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Trigger>
  )
}

/** Trigger affordance slot. Defaults to a chevronDown icon. */
export function SelectIcon({
  ref,
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Icon> & {
  ref?: Ref<HTMLSpanElement>
}) {
  return (
    <SelectPrimitive.Icon
      ref={ref}
      className={cn('zd:shrink-0', className)}
      {...props}
    >
      {children ?? (
        <Icon name="chevronDown" className="zd:size-4 zd:text-greyScale" />
      )}
    </SelectPrimitive.Icon>
  )
}

/** Portaled popper panel. Width defaults to `--radix-select-trigger-width`;
 * override via inline `style={{ width }}`. */
export function SelectContent({
  ref,
  className,
  children,
  position = 'popper',
  sideOffset = 8,
  style,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content> & {
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        position={position}
        sideOffset={sideOffset}
        className={cn(
          'zd:z-50 zd:max-h-80 zd:outline-none',
          // Subtle scale + translate on open/close (see `popper-in` /
          // `popper-out`). Radix keeps Content mounted through the exit
          // animation via `data-state="closed"`. Radix provides
          // `--radix-select-content-transform-origin` which anchors the
          // scale to the trigger's corner based on `align` (top-left for
          // `align="start"`, top-right for `align="end"`).
          'zd:data-[state=open]:animate-popper-in',
          'zd:data-[state=closed]:animate-popper-out',
          className,
        )}
        {...props}
        style={{
          width: 'var(--radix-select-trigger-width)',
          transformOrigin: 'var(--radix-select-content-transform-origin)',
          ...style,
        }}
      >
        <Wrapper
          variant="solid"
          // Override Wrapper's 80% white translucency — a dropdown over
          // content shouldn't let the content bleed through.
          style={{ backgroundColor: '#fff' }}
          className="zd:flex zd:flex-col zd:rounded-2xl zd:overflow-hidden"
        >
          <SelectPrimitive.Viewport className="zd:overflow-y-auto zd:max-h-80">
            {children}
          </SelectPrimitive.Viewport>
        </Wrapper>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

/** Option row. Children render as-is; set `textValue` for typeahead when
 * children aren't plain text. */
export function SelectItem({
  ref,
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item> & {
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        // Default padding for plain-text items. Complex children with their
        // own padding (e.g. `<TokenListItem>`) opt out via `className="zd:p-0"`.
        'zd:relative zd:outline-none zd:cursor-pointer zd:px-3 zd:py-2',
        'zd:data-[highlighted]:bg-offWhite/40',
        'zd:data-[state=checked]:bg-offWhite/60',
        className,
      )}
      {...props}
    >
      {children}
    </SelectPrimitive.Item>
  )
}

export function SelectSeparator({
  ref,
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator> & {
  ref?: Ref<HTMLDivElement>
}) {
  return (
    <SelectPrimitive.Separator
      ref={ref}
      className={cn('zd:h-px zd:bg-offWhite/50 zd:mx-2 zd:my-1', className)}
      {...props}
    />
  )
}
