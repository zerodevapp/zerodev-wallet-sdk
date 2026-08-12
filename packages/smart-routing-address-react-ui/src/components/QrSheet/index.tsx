import {
  BottomSheet,
  BottomSheetClose,
  BottomSheetContent,
  BottomSheetTitle,
  Button,
  QrCode,
  Text,
} from '@zerodev/react-ui'

export interface QrSheetProps {
  /** Whether the modal is open. Controlled. */
  open: boolean
  /** Called when the modal requests to close (backdrop click, ESC,
   * Cancel button). */
  onOpenChange: (open: boolean) => void
  /** Address to encode in the QR code and display below it. */
  address: string
  /** Called when the user taps "Copy address". */
  onCopy: () => void
}

/** Bottom-anchored modal showing the deposit address as a QR code. Composes
 * `<BottomSheet>` (state) + `<BottomSheetContent>` (chrome); this file owns the
 * QR / address / copy-cancel layout inside it. */
export function QrSheet({ open, onOpenChange, address, onCopy }: QrSheetProps) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheetContent>
        <BottomSheetTitle>Your deposit address</BottomSheetTitle>
        {/* Accent gradient is baked into `BottomSheetContent`; content sits
            above it via `zd:relative`. */}
        <div className="zd:relative zd:flex zd:flex-col zd:gap-6 zd:items-center zd:pt-6 zd:px-4 zd:pb-3">
          <div className="zd:flex zd:flex-col zd:gap-3 zd:items-center">
            <Text className="zd:text-h2 zd:text-center">
              Your deposit address
            </Text>
            <Text className="zd:text-body2 zd:text-center zd:max-w-[300px]">
              Send funds to this address to automatically bridge and swap
              desired assets.
            </Text>
          </div>

          {/* The white bg + `p-5` (20px) padding around the QR doubles as
              the required 4-module quiet zone — QrCode itself no longer
              reserves one internally so the code fills its declared size. */}
          <div className="zd:relative zd:bg-white zd:w-[240px] zd:h-[240px] zd:p-5 zd:flex zd:items-center zd:justify-center">
            <QrCode value={address} size={200} eyeRadius={2} />
            {/* Corner brackets — viewfinder-style framing. Color/thickness
                match the Figma's `rgba(19,14,11,0.1)` 1px outline. */}
            <div className="zd:absolute zd:top-0 zd:left-0 zd:w-5 zd:h-5 zd:border-t zd:border-l zd:border-greyScale/10 zd:rounded-tl-lg zd:pointer-events-none" />
            <div className="zd:absolute zd:top-0 zd:right-0 zd:w-5 zd:h-5 zd:border-t zd:border-r zd:border-greyScale/10 zd:rounded-tr-lg zd:pointer-events-none" />
            <div className="zd:absolute zd:bottom-0 zd:left-0 zd:w-5 zd:h-5 zd:border-b zd:border-l zd:border-greyScale/10 zd:rounded-bl-lg zd:pointer-events-none" />
            <div className="zd:absolute zd:bottom-0 zd:right-0 zd:w-5 zd:h-5 zd:border-b zd:border-r zd:border-greyScale/10 zd:rounded-br-lg zd:pointer-events-none" />
          </div>

          <Text className="zd:text-body2 zd:text-center zd:break-all zd:max-w-[230px]">
            {address}
          </Text>

          <div className="zd:flex zd:flex-col zd:gap-1 zd:w-full">
            <Button action="primary" text="Copy address" onClick={onCopy} />
            <BottomSheetClose asChild>
              <Button action="secondary" text="Cancel" />
            </BottomSheetClose>
          </div>
        </div>
      </BottomSheetContent>
    </BottomSheet>
  )
}
