import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetTitle,
  Icon,
  Text,
  WrappedPressable,
} from '@zerodev/react-ui'

export type OnrampSheetState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  | { status: 'error' }

export interface OnrampSheetProps {
  /** Whether the sheet is open. Controlled. */
  open: boolean
  /** Called when the sheet requests to close (backdrop click, ESC). */
  onOpenChange: (open: boolean) => void
  /** Widget-URL fetch state — the URL is minted per open (single-use). */
  state: OnrampSheetState
  /** Re-runs the widget-URL fetch after an error. */
  onRetry: () => void
}

/**
 * Bottom-anchored sheet hosting the Transak on-ramp in an iframe (the MVP
 * fiat→crypto flow). The URL is fetched when the sheet opens — Transak
 * session URLs are single-use with a 5-minute expiry, so each open mints a
 * fresh one — and the iframe only mounts while open (Radix unmounts dialog
 * content on close, so Transak's session isn't kept warm in the background).
 */
export function OnrampSheet({
  open,
  onOpenChange,
  state,
  onRetry,
}: OnrampSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetTitle>Buy crypto</BottomSheetTitle>
        {state.status === 'ready' ? (
          <iframe
            src={state.url}
            title="Buy crypto with Transak"
            // Transak's KYC flow needs camera/microphone (liveness + document
            // capture) and payment; matches the allow-list Transak's own SDK
            // sets on its iframe.
            allow="camera;microphone;fullscreen;payment"
            // Transak validates the browser's Referer header against the
            // session's referrerDomain. This is the browser default, but set
            // it explicitly so a host page's stricter Referrer-Policy (e.g.
            // no-referrer) can't break that validation.
            referrerPolicy="strict-origin-when-cross-origin"
            className="zd:h-140 zd:max-h-full zd:w-full zd:rounded-2xl zd:border-0 zd:bg-white"
          />
        ) : (
          <div className="zd:flex zd:h-60 zd:w-full zd:flex-col zd:items-center zd:justify-center zd:gap-3">
            {state.status === 'loading' ? (
              <Icon
                name="loading"
                className="zd:size-6 zd:animate-spin zd:text-orange"
                aria-label="Preparing checkout"
              />
            ) : (
              <>
                <Text className="zd:text-center zd:text-greyScale/70">
                  Couldn't start the checkout. Please try again.
                </Text>
                <WrappedPressable
                  onClick={onRetry}
                  className="zd:rounded-xl zd:px-4 zd:py-2"
                >
                  <Text className="zd:font-medium">Try again</Text>
                </WrappedPressable>
              </>
            )}
          </div>
        )}
      </BottomSheetContent>
    </BottomSheet>
  )
}
