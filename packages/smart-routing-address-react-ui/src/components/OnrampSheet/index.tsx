import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
} from '@zerodev/react-ui'

export interface OnrampSheetProps {
  /** Whether the sheet is open. Controlled. */
  open: boolean
  /** Called when the sheet requests to close (backdrop click, ESC). */
  onOpenChange: (open: boolean) => void
  /** Transak widget URL (see `buildTransakUrl`). */
  src: string
}

/**
 * Bottom-anchored sheet hosting the Transak on-ramp in an iframe (the MVP
 * fiat→crypto flow). The iframe only mounts while open — Radix unmounts the
 * dialog content on close, so Transak's session isn't kept warm in the
 * background.
 */
export function OnrampSheet({ open, onOpenChange, src }: OnrampSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetTitle>Buy crypto</BottomSheetTitle>
        <iframe
          src={src}
          title="Buy crypto with Transak"
          // Transak's KYC flow needs camera/microphone (liveness + document
          // capture) and payment; matches the allow-list Transak's own SDK
          // sets on its iframe.
          allow="camera;microphone;fullscreen;payment"
          className="zd:h-140 zd:max-h-full zd:w-full zd:rounded-2xl zd:border-0 zd:bg-white"
        />
      </BottomSheetContent>
    </BottomSheet>
  )
}
