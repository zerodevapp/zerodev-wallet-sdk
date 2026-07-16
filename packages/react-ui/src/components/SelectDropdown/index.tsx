import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'

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
  className?: string
  /** Extra classes applied to the dropdown panel — e.g. a max-height override
   * or a background tweak. Width/position come from the anchor, not from
   * classes. */
  panelClassName?: string
  /** Element the panel's width and left edge are pinned to. Defaults to the
   * SelectDropdown's own root (the trigger). Point at a wider ancestor
   * (e.g. a row containing multiple pickers) to make the panel span it. */
  anchorRef?: RefObject<HTMLElement | null>
}

export function SelectDropdown({
  items,
  value,
  onChange,
  disabled,
  placeholderLabel = '—',
  className,
  panelClassName,
  anchorRef,
}: SelectDropdownProps) {
  const [open, setOpen] = useState(false)
  // `mounted` gates the portal so we don't touch `document` during SSR.
  const [mounted, setMounted] = useState(false)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const selected = items.find((item) => item.id === value) ?? items[0]

  // Measure the anchor (defaults to the trigger) and pin the panel just below
  // it. Position: fixed + portal-to-body escapes any clipping ancestor (e.g.
  // ArrowCardPair's clip-path on the top card), which absolute positioning
  // cannot. Width matches the anchor exactly — the caller widens the panel by
  // pointing `anchorRef` at a wider ancestor, not by adding a width class.
  const positionPanel = useCallback(() => {
    const anchor = anchorRef?.current ?? rootRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: rect.left,
      width: rect.width,
    })
  }, [anchorRef])

  useLayoutEffect(() => {
    if (!open) return
    positionPanel()
  }, [open, positionPanel])

  // Reposition on scroll / resize so the panel tracks the trigger.
  useEffect(() => {
    if (!open) return
    const handle = () => positionPanel()
    window.addEventListener('resize', handle)
    window.addEventListener('scroll', handle, true)
    return () => {
      window.removeEventListener('resize', handle)
      window.removeEventListener('scroll', handle, true)
    }
  }, [open, positionPanel])

  // Close on outside click + Escape while the panel is open. Because the panel
  // is portaled, "outside" means outside both the trigger AND the panel.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  // If the caller flips `disabled` on while the panel is open, force-close it.
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

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

  const panel = open ? (
    // The extra wrapping div carries the ref (Wrapper doesn't forward refs)
    // and the panel's fixed positioning. Wrapper handles the surface styling
    // — gradient/border/blur — while width/height/scroll live on the outer.
    <div ref={panelRef} style={panelStyle} className="zd:z-50">
      <Wrapper
        variant="solid"
        role="listbox"
        className={cn(
          'zd:flex zd:flex-col zd:rounded-2xl zd:overflow-hidden',
          'zd:max-h-80 zd:overflow-y-auto',
          panelClassName,
        )}
      >
        {items.map((item) => {
          const isSelected = item.id === value
          return (
            <div key={item.id} className="zd:relative">
              <TokenListItem
                symbol={item.symbol}
                {...(item.subtitle && { subtitle: item.subtitle })}
                {...(item.iconName && { iconName: item.iconName })}
                {...(item.imageSource && { imageSource: item.imageSource })}
                {...(item.iconVariant && { iconVariant: item.iconVariant })}
                className={cn(isSelected && 'zd:bg-offWhite/60')}
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
                role="option"
                aria-selected={isSelected}
              />
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
    </div>
  ) : null

  return (
    <div ref={rootRef} className={cn('zd:relative', className)}>
      <PillItem
        label={selected.symbol}
        {...(selected.logoUri && { logoUri: selected.logoUri })}
        {...(selected.logoBg && { logoBg: selected.logoBg })}
        {...(disabled
          ? { disabled: true }
          : { onClick: () => setOpen((v) => !v) })}
      />
      {mounted && panel && createPortal(panel, document.body)}
    </div>
  )
}
