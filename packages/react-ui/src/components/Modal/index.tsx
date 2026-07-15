import { type ReactNode, useEffect, useState } from 'react'

import { cn } from '../../utils/common'

// Keep in sync with the `--animate-modal-out` duration in styles.css. Used to
// schedule unmount so the sheet finishes sliding down before it disappears.
const EXIT_DURATION_MS = 250

export interface ModalProps {
  /** Whether the modal is open. Toggling this drives the slide-in/out
   * animation; the caller flips it via `onClose` (backdrop / ESC / a close
   * button inside `children`). */
  open: boolean
  /** Fires when the user dismisses the modal (dim backdrop click or ESC).
   * The caller is responsible for setting `open` back to false. */
  onClose: () => void
  children: ReactNode
  /** Classes applied to the sheet — override colour/padding/etc. Positioning
   * (`absolute bottom-1.5 left-1.5 right-1.5`), radius, and the slide
   * animation are owned by Modal and not overridable via this prop. */
  className?: string
}

/**
 * Animated bottom-sheet modal. Passed to `<Screen overlay={…}>` so it renders
 * at the outer card level — the dim backdrop covers the entire Screen
 * (including the TopNav band) and the sheet is anchored to the bottom of the
 * outer frame, respecting the 6px gradient border ring.
 *
 * Animation: CSS keyframe animations (not transitions). Switching the
 * animation-name between `modal-in` and `modal-out` forces the browser to
 * restart the animation from its `from` keyframe every time — so a rapid
 * open → close → open still plays the full slide-up, instead of a tiny
 * interpolation from a barely-moved position (which is what CSS transitions
 * do when interrupted mid-way).
 */
export function Modal({ open, onClose, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(open)
  // `null` = haven't picked a phase yet; used only for the initial mount
  // when open starts false (nothing rendered) so we don't play `modal-out`
  // by default.
  const [phase, setPhase] = useState<'in' | 'out' | null>(open ? 'in' : null)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setPhase('in')
      return
    }
    // Only run the exit animation if we've been shown at least once — no
    // pointless `modal-out` on the very first render with open=false.
    setPhase((prev) => (prev === null ? null : 'out'))
    const timeout = window.setTimeout(() => setMounted(false), EXIT_DURATION_MS)
    return () => window.clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!mounted) return null

  const isIn = phase === 'in'

  return (
    <div className="zd:absolute zd:inset-0 zd:z-10">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={cn(
          'zd:absolute zd:inset-0 zd:bg-greyScale/20 zd:cursor-default',
          isIn ? 'zd:animate-backdrop-in' : 'zd:animate-backdrop-out',
        )}
      />
      <div
        className={cn(
          'zd:absolute zd:bottom-1.5 zd:left-1.5 zd:right-1.5',
          'zd:bg-white zd:rounded-[32px] zd:overflow-hidden',
          isIn ? 'zd:animate-modal-in' : 'zd:animate-modal-out',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
