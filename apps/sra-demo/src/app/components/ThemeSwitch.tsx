'use client'

import { cn } from '@zerodev/react-ui'
import {
  type ComponentType,
  type SVGProps,
  useEffect,
  useRef,
  useState,
} from 'react'

/** The four presets, `<brand>-<mode>`, as the kit reads them from <html>. */
export type ThemeMode = 'light' | 'dark'
export type ThemeBrand = 'branded' | 'plain'
export type ThemeName = `${ThemeBrand}-${ThemeMode}`
export const THEME_NAMES: readonly ThemeName[] = [
  'branded-light',
  'plain-light',
  'branded-dark',
  'plain-dark',
]

type IconProps = SVGProps<SVGSVGElement> & { strokeWidth?: number }
type IconComponent = ComponentType<IconProps>

/** The outline icons the switches carry, drawn inline so the demo takes no
 * icon dependency. The same four glyphs the signer demo uses. */
function icon(paths: string[]): IconComponent {
  return function Glyph({ strokeWidth = 2, ...props }: IconProps) {
    // Decorative: the switch carries the accessible name.
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {paths.map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    )
  }
}

const Sun = icon([
  'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  'M12 2v2',
  'M12 20v2',
  'm4.93 4.93 1.41 1.41',
  'm17.66 17.66 1.41 1.41',
  'M2 12h2',
  'M20 12h2',
  'm6.34 17.66-1.41 1.41',
  'm19.07 4.93-1.41 1.41',
])
const Moon = icon(['M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z'])
const Sparkles = icon([
  'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z',
  'M20 3v4',
  'M22 5h-4',
  'M4 17v2',
  'M5 18H3',
])
const CircleDashed = icon([
  'M10.1 2.182a10 10 0 0 1 3.8 0',
  'M13.9 21.818a10 10 0 0 1-3.8 0',
  'M17.609 3.721a10 10 0 0 1 2.69 2.7',
  'M2.182 13.9a10 10 0 0 1 0-3.8',
  'M20.279 17.609a10 10 0 0 1-2.7 2.69',
  'M21.818 10.1a10 10 0 0 1 0 3.8',
  'M3.721 6.391a10 10 0 0 1 2.7-2.69',
  'M6.391 20.279a10 10 0 0 1-2.69-2.7',
])

/**
 * The two switches above the card: mode (light / dark) and brand (branded /
 * non-branded). They write the kit's two attributes on <html>, as a host
 * would; the page's own chrome stays as it is.
 */
export function ThemeSwitches({
  theme,
  onChange,
}: {
  theme: ThemeName
  onChange: (next: ThemeName) => void
}) {
  const [brand, mode] = theme.split('-') as [ThemeBrand, ThemeMode]
  useEffect(() => {
    document.documentElement.dataset.zdBrand = brand
    document.documentElement.dataset.zdMode = mode
  }, [brand, mode])

  return (
    <div className="mb-4 flex items-center justify-center gap-2">
      <PillSwitch
        checked={mode === 'dark'}
        onToggle={() =>
          onChange(`${brand}-${mode === 'dark' ? 'light' : 'dark'}`)
        }
        label="Dark mode"
        offTitle="Light mode"
        onTitle="Dark mode"
        dark={mode === 'dark'}
        offIcon={Sun}
        onIcon={Moon}
      />
      <PillSwitch
        checked={brand === 'plain'}
        onToggle={() =>
          onChange(`${brand === 'plain' ? 'branded' : 'plain'}-${mode}`)
        }
        label="Non-branded"
        offTitle="Branded"
        onTitle="Non-branded"
        dark={mode === 'dark'}
        offIcon={Sparkles}
        onIcon={CircleDashed}
      />
    </div>
  )
}

/**
 * A two-state pill: a knob carrying the active icon slides between two
 * ghosted icons on the track. The tooltip over the track names the option
 * under the pointer and glides between the two halves as the pointer
 * crosses; keyboard focus names the active one. The same switch the signer
 * demo carries.
 */
function PillSwitch({
  checked,
  onToggle,
  label,
  offTitle,
  onTitle,
  dark,
  offIcon: OffIcon,
  onIcon: OnIcon,
}: {
  checked: boolean
  onToggle: () => void
  label: string
  offTitle: string
  onTitle: string
  dark: boolean
  offIcon: IconComponent
  onIcon: IconComponent
}) {
  // The half under the pointer, or the active half under keyboard focus;
  // null hides the tooltip. `side` keeps the last half so the label stays
  // put while the tooltip fades out.
  const [pointerSide, setPointerSide] = useState<'off' | 'on' | null>(null)
  const [focusVisible, setFocusVisible] = useState(false)
  const shownSide =
    pointerSide ?? (focusVisible ? (checked ? 'on' : 'off') : null)
  const [side, setSide] = useState<'off' | 'on'>(checked ? 'on' : 'off')
  if (shownSide && shownSide !== side) setSide(shownSide)
  const shown = shownSide !== null
  // Showing takes two commits: the position lands while the tooltip is
  // still hidden, that style is flushed, and only then does it fade in. A
  // transition runs from the last committed style, so the label appears
  // where it belongs instead of sliding over from where it last was.
  const tipRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!shown) {
      setVisible(false)
      return
    }
    // Reading layout flushes the hidden position before the fade-in.
    tipRef.current?.getBoundingClientRect()
    setVisible(true)
  }, [shown])

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      onPointerMove={(e) => {
        // Over the tooltip itself the side stays: the label is hoverable
        // (so it can be read under a magnifier) without gliding away.
        if (tipRef.current?.contains(e.target as Node)) return
        const r = e.currentTarget.getBoundingClientRect()
        setPointerSide(e.clientX - r.left < r.width / 2 ? 'off' : 'on')
      }}
      onPointerLeave={() => setPointerSide(null)}
      onFocus={(e) =>
        setFocusVisible(e.currentTarget.matches(':focus-visible'))
      }
      onBlur={() => setFocusVisible(false)}
      className={cn(
        'relative h-9 w-[68px] shrink-0 cursor-pointer rounded-full border transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        dark ? 'border-[#2a2420] bg-[#19110b]' : 'border-border-warm bg-white',
      )}
    >
      {/* Ghosted icons on the track, one per side. */}
      <OffIcon
        aria-hidden
        className={cn(
          'absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-opacity duration-300',
          checked
            ? dark
              ? 'text-[#f7f5f0] opacity-40'
              : 'text-muted opacity-50'
            : 'opacity-0',
        )}
      />
      <OnIcon
        aria-hidden
        className={cn(
          'absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 transition-opacity duration-300',
          checked
            ? 'opacity-0'
            : dark
              ? 'text-[#f7f5f0] opacity-40'
              : 'text-muted opacity-50',
        )}
      />
      {/* The knob, carrying the active icon. */}
      <span
        aria-hidden
        className={cn(
          'absolute top-[3px] left-[3px] grid h-7 w-7 place-items-center rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(.2,.8,.2,1)]',
          checked ? 'translate-x-[34px]' : 'translate-x-0',
          dark ? 'bg-[#f7f5f0]' : 'bg-background',
        )}
      >
        {checked ? (
          <OnIcon
            className={cn('h-4 w-4', dark ? 'text-[#19110b]' : 'text-primary')}
            strokeWidth={2.25}
          />
        ) : (
          <OffIcon
            className={cn('h-4 w-4', dark ? 'text-[#19110b]' : 'text-primary')}
            strokeWidth={2.25}
          />
        )}
      </span>
      {/* The tooltip, centred over the named half. Its left edge glides
        between the halves; opacity and a short rise handle show and hide. */}
      <span
        ref={tipRef}
        role="tooltip"
        aria-hidden={!visible}
        // Reading the label must not flip the switch.
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'absolute bottom-full z-10 mb-3 -translate-x-1/2 cursor-default whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium shadow-[0_4px_12px_rgba(0,0,0,0.18)] duration-250 ease-[cubic-bezier(.2,.8,.2,1)]',
          'after:absolute after:left-1/2 after:top-full after:-translate-x-1/2 after:border-[5px] after:border-transparent',
          // An invisible bridge over the gap to the track, so the pointer can
          // travel from the switch onto the label without leaving the pill.
          "before:absolute before:inset-x-0 before:top-full before:h-3 before:content-['']",
          side === 'off' ? 'left-[17px]' : 'left-[51px]',
          // The position glides only while the tooltip shows; hidden, it
          // snaps, so the next show starts in place.
          visible
            ? 'pointer-events-auto translate-y-0 opacity-100 transition-[left,opacity,transform]'
            : 'pointer-events-none translate-y-1 opacity-0 transition-[opacity,transform]',
          // A page element, so it keeps the page's ink in both modes.
          'bg-ink text-white after:border-t-ink',
        )}
      >
        {side === 'off' ? offTitle : onTitle}
      </span>
    </button>
  )
}
