import * as Popover from '@radix-ui/react-popover'

import { cn } from '../../utils/common'
import type { IconName } from '../Icon'
import { PillItem } from '../PillItem'
import { TokenListItem, type TokenListItemIconVariant } from '../TokenListItem'
import { Wrapper } from '../Wrapper'

export interface SelectDropdownItem {
  /** Stable id used for `value` / `onChange`. */
  id: string
  /** Primary label — rendered in both the PillItem trigger and the
   * TokenListItem row (e.g. "USDC"). */
  symbol: string
  /** Subtitle text under the symbol in the dropdown row (e.g. "13 networks"). */
  subtitle?: string
  /** react-ui `Icon` name for the dropdown row's icon well. */
  iconName?: IconName
  /** Image URL for the dropdown row's icon well (used when `iconName` is
   * absent). */
  imageSource?: string
  /** Shape of the dropdown row icon. Defaults to `'token'`. */
  iconVariant?: TokenListItemIconVariant
  /** Image URL used by the PillItem trigger's logo well. */
  logoUri?: string
  /** Fallback bg color for the PillItem trigger's placeholder circle. */
  logoBg?: string
  /** Optional badge (e.g. "Recommended") pinned to the right of the row. */
  badge?: string
}

export interface SelectDropdownProps {
  /** Items rendered inside the dropdown panel. */
  items: SelectDropdownItem[]
  /** id of the currently selected item; drives the PillItem trigger. */
  value: string
  /** Called with the id of the newly selected item. */
  onChange: (id: string) => void
  /** When true, the trigger renders as a non-interactive display pill and
   * the dropdown never opens. */
  disabled?: boolean
  /** Label shown on the trigger when `items` is empty (e.g. while the
   * routable set is loading). Defaults to `'—'`. */
  placeholderLabel?: string
  /** Horizontal alignment of the panel relative to the trigger. `start`
   * aligns panel-left to trigger-left; `end` aligns panel-right to
   * trigger-right. Useful when a wider panel needs to hug either side
   * of a narrow trigger. Defaults to `start`. */
  align?: 'start' | 'center' | 'end'
  className?: string
  /** Extra classes applied to the dropdown panel. Does NOT set width —
   * see `panelWidth` for that. */
  panelClassName?: string
  /** CSS `width` value for the panel. Defaults to
   * `var(--radix-popover-trigger-width)` (matches the trigger). Set to e.g.
   * `'calc(var(--radix-popover-trigger-width) * 2 + 4px)'` to span two pills
   * in a row. Applied inline so it wins over any class-based width. */
  panelWidth?: string
}

export function SelectDropdown({
  items,
  value,
  onChange,
  disabled,
  placeholderLabel = '—',
  align = 'start',
  className,
  panelClassName,
  panelWidth = 'var(--radix-popover-trigger-width)',
}: SelectDropdownProps) {
  const selected = items.find((item) => item.id === value) ?? items[0]

  // No items yet (e.g. the routable set is still loading). Render a
  // non-interactive placeholder pill so the row keeps its layout instead of
  // collapsing.
  if (!selected) {
    return (
      <div className={cn('zd:relative', className)}>
        <PillItem label={placeholderLabel} disabled />
      </div>
    )
  }

  const trigger = (
    <PillItem
      label={selected.symbol}
      {...(selected.logoUri && { logoUri: selected.logoUri })}
      {...(selected.logoBg && { logoBg: selected.logoBg })}
      {...(disabled && { disabled: true })}
    />
  )

  return (
    <Popover.Root>
      <Popover.Trigger asChild disabled={disabled} className={className}>
        {trigger}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align={align}
          sideOffset={8}
          className={cn('zd:z-50 zd:outline-none', panelClassName)}
          // Inline style — beats any class-based width, so callers control
          // panel width via `panelWidth` prop without fighting CSS cascade.
          style={{ width: panelWidth }}
        >
          <Wrapper
            variant="solid"
            role="listbox"
            className={cn(
              'zd:flex zd:flex-col zd:rounded-2xl zd:overflow-hidden',
              'zd:max-h-80 zd:overflow-y-auto',
            )}
          >
            {items.map((item) => {
              const isSelected = item.id === value
              return (
                <div key={item.id} className="zd:relative">
                  <Popover.Close asChild>
                    <TokenListItem
                      symbol={item.symbol}
                      {...(item.subtitle && { subtitle: item.subtitle })}
                      {...(item.iconName && { iconName: item.iconName })}
                      {...(item.imageSource && {
                        imageSource: item.imageSource,
                      })}
                      {...(item.iconVariant && {
                        iconVariant: item.iconVariant,
                      })}
                      className={cn(isSelected && 'zd:bg-offWhite/60')}
                      onClick={() => onChange(item.id)}
                      role="option"
                      aria-selected={isSelected}
                    />
                  </Popover.Close>
                  {item.badge && (
                    // Absolute + pointer-events-none so the whole row is still
                    // clickable through the badge. The row itself supplies the
                    // hover state — the badge just floats on top.
                    <span
                      className={cn(
                        'zd:absolute zd:top-1/2 zd:right-3 zd:-translate-y-1/2',
                        'zd:inline-flex zd:items-center zd:rounded-full',
                        'zd:bg-positive/15 zd:px-2 zd:py-1',
                        'zd:text-body3 zd:text-positive zd:pointer-events-none',
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )
            })}
          </Wrapper>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
