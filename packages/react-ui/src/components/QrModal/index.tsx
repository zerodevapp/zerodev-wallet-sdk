import { Button } from '../Button'
import { Text } from '../Text'
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
 * Passed to `<Screen overlay={...}>` so it renders at the outer card level —
 * the dim backdrop (`absolute inset-0`) covers the entire SRA card including
 * the TopNav, but stays clipped inside the card's rounded edges.
 */
export function QrModal({ address, onCopy, onClose }: QrModalProps) {
  return (
    <div className="zd:absolute zd:inset-0 zd:z-10">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="zd:absolute zd:inset-0 zd:bg-greyScale/20 zd:cursor-default"
      />
      <div className="zd:absolute zd:bottom-1.5 zd:left-1.5 zd:right-1.5 zd:bg-white zd:rounded-[32px] zd:overflow-hidden">
        {/* Bottom-half gradient — light blue at bottom-left fading into
            peach/orange at bottom-right — mirrors the "amorphic" image
            used in the Figma design. Colors echo `MultiRadialBackground`. */}
        <div
          aria-hidden
          className="zd:absolute zd:inset-0 zd:pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 78% 65% at 5% 105%, rgba(69,171,251,0.35) 0%, rgba(69,171,251,0) 72%), radial-gradient(ellipse 82% 65% at 100% 105%, rgba(250,200,172,0.65) 0%, rgba(250,200,172,0) 72%), radial-gradient(ellipse 58% 52% at 100% 100%, rgba(242,123,62,0.35) 0%, rgba(242,123,62,0) 72%)',
          }}
        />
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

          <div className="zd:relative zd:bg-white zd:w-[200px] zd:h-[200px] zd:p-3 zd:flex zd:items-center zd:justify-center">
            <QrCode value={address} size={176} eyeRadius={2} />
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
            <Button action="secondary" text="Cancel" onClick={onClose} />
          </div>
        </div>
      </div>
    </div>
  )
}
