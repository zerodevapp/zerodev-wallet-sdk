import type { FC, SVGProps } from 'react'

import LockupBlack from '../../../assets/brand/zerodev-lockup-black.svg?react'
import LockupCurrent from '../../../assets/brand/zerodev-lockup-current.svg?react'
import LockupOffwhite from '../../../assets/brand/zerodev-lockup-offwhite.svg?react'
import MarkBlack from '../../../assets/brand/zerodev-mark-black.svg?react'
import MarkColor from '../../../assets/brand/zerodev-mark-color.svg?react'
import MarkCurrent from '../../../assets/brand/zerodev-mark-current.svg?react'
import MarkOffwhite from '../../../assets/brand/zerodev-mark-offwhite.svg?react'
import MarkOrange from '../../../assets/brand/zerodev-mark-orange.svg?react'
import { cn } from '../../utils/common'

// The `mark` (icon only) ships in four tones; the `lockup` (mark + wordmark)
// only in black/offwhite — there is no colorful lockup asset. The union keeps
// invalid combinations (e.g. lockup + color) from type-checking. `auto`
// follows the theme: the glyph draws in the neutral icon colour and its
// backdrop in the inverse text colour, so it reads as black-on-white in a
// light theme and off-white-on-ink in a dark one.
export type MarkTone = 'black' | 'offwhite' | 'color' | 'orange' | 'auto'
export type LockupTone = 'black' | 'offwhite' | 'auto'

export type ZeroDevLogoProps = SVGProps<SVGSVGElement> &
  (
    | { variant?: 'mark'; tone?: MarkTone }
    | { variant: 'lockup'; tone?: LockupTone }
  )

export function ZeroDevLogo({
  variant = 'mark',
  tone = 'black',
  className,
  ...props
}: ZeroDevLogoProps) {
  // The fixed tones carry literal fills (the tone IS the color), so no
  // text-color class is applied — unlike Icon, currentColor would have no
  // effect there. Only `auto` draws in currentColor.
  let Svg: FC<SVGProps<SVGSVGElement>>
  if (variant === 'lockup') {
    switch (tone) {
      case 'offwhite':
        Svg = LockupOffwhite
        break
      case 'auto':
        Svg = LockupCurrent
        break
      default:
        Svg = LockupBlack
    }
  } else {
    switch (tone) {
      case 'offwhite':
        Svg = MarkOffwhite
        break
      case 'color':
        Svg = MarkColor
        break
      case 'orange':
        Svg = MarkOrange
        break
      case 'auto':
        Svg = MarkCurrent
        break
      default:
        Svg = MarkBlack
    }
  }

  return (
    <Svg
      className={
        tone === 'auto' ? cn('zd:icon-neutral-primary', className) : className
      }
      {...props}
    />
  )
}
