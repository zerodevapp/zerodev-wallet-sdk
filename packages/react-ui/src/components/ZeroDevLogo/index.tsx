import type { FC, SVGProps } from 'react'

import LockupBlack from '../../../assets/brand/zerodev-lockup-black.svg?react'
import LockupOffwhite from '../../../assets/brand/zerodev-lockup-offwhite.svg?react'
import MarkBlack from '../../../assets/brand/zerodev-mark-black.svg?react'
import MarkColor from '../../../assets/brand/zerodev-mark-color.svg?react'
import MarkOffwhite from '../../../assets/brand/zerodev-mark-offwhite.svg?react'
import MarkOrange from '../../../assets/brand/zerodev-mark-orange.svg?react'

// The `mark` (icon only) ships in four tones; the `lockup` (mark + wordmark)
// only in black/offwhite — there is no colorful lockup asset. The union keeps
// invalid combinations (e.g. lockup + color) from type-checking.
export type MarkTone = 'black' | 'offwhite' | 'color' | 'orange'
export type LockupTone = 'black' | 'offwhite'

export type ZeroDevLogoProps = SVGProps<SVGSVGElement> &
  (
    | { variant?: 'mark'; tone?: MarkTone }
    | { variant: 'lockup'; tone?: LockupTone }
  )

export function ZeroDevLogo({
  variant = 'mark',
  tone = 'black',
  ...props
}: ZeroDevLogoProps) {
  // Brand SVGs carry literal fills (the tone IS the color), so no text-color
  // class is applied — unlike Icon, currentColor would have no effect here.
  let Svg: FC<SVGProps<SVGSVGElement>>
  if (variant === 'lockup') {
    switch (tone) {
      case 'offwhite':
        Svg = LockupOffwhite
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
      default:
        Svg = MarkBlack
    }
  }

  return <Svg {...props} />
}
