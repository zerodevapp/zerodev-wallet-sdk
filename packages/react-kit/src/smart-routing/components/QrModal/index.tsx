import { Button } from '../../../shared/components/Button'
import { Text } from '../../../shared/components/Text'
import { QrCode } from './QrCode'

export interface QrModalProps {
  /** Address to encode in the QR code and display below it. */
  address: string
  /** Called when the user taps "Copy address". */
  onCopy: () => void
  /** Called when the user taps "Cancel" or the dim backdrop. */
  onClose: () => void
}

/**
 * Bottom-anchored modal showing the deposit address as a QR code.
 *
 * Passed to `<ScreenWrapper overlay={...}>` so it renders at the outer card
 * level — the dim backdrop (`absolute inset-0`) covers the entire SRA card
 * including the TopNav, but stays clipped inside the card's rounded edges.
 */
export function QrModal({ address, onCopy, onClose }: QrModalProps) {
  return (
    <div className="absolute inset-0 z-10">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-greyScale/20 cursor-default"
      />
      <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-white rounded-[32px] overflow-hidden">
        {/* Bottom-half gradient — light blue at bottom-left fading into
            peach/orange at bottom-right — mirrors the "amorphic" image
            used in the Figma design. Colors echo `MultiRadialBackground`. */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 78% 65% at 5% 105%, rgba(69,171,251,0.35) 0%, rgba(69,171,251,0) 72%), radial-gradient(ellipse 82% 65% at 100% 105%, rgba(250,200,172,0.65) 0%, rgba(250,200,172,0) 72%), radial-gradient(ellipse 58% 52% at 100% 100%, rgba(242,123,62,0.35) 0%, rgba(242,123,62,0) 72%)',
          }}
        />
        <div className="relative flex flex-col gap-6 items-center pt-6 px-4 pb-3">
          <div className="flex flex-col gap-3 items-center">
            <Text className="text-h2 text-center">Your deposit address</Text>
            <Text className="text-body2 text-center max-w-[300px]">
              Send funds to this address to automatically bridge and swap
              desired assets.
            </Text>
          </div>

          <div className="relative bg-white size-[200px] p-3 flex items-center justify-center">
            <QrCode value={address} size={176} eyeRadius={2} />
            {/* Corner brackets — viewfinder-style framing. Color/thickness
                match the Figma's `rgba(19,14,11,0.1)` 1px outline. */}
            <div className="absolute top-0 left-0 size-5 border-t border-l border-greyScale/10 rounded-tl-lg pointer-events-none" />
            <div className="absolute top-0 right-0 size-5 border-t border-r border-greyScale/10 rounded-tr-lg pointer-events-none" />
            <div className="absolute bottom-0 left-0 size-5 border-b border-l border-greyScale/10 rounded-bl-lg pointer-events-none" />
            <div className="absolute bottom-0 right-0 size-5 border-b border-r border-greyScale/10 rounded-br-lg pointer-events-none" />
          </div>

          <Text className="text-body2 text-center break-all max-w-[230px]">
            {address}
          </Text>

          <div className="flex flex-col gap-1 w-full">
            <Button
              action="primary"
              text="Copy address"
              onClick={onCopy}
              className="h-13"
            />
            <Button
              action="secondary"
              text="Cancel"
              onClick={onClose}
              className="h-13"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
