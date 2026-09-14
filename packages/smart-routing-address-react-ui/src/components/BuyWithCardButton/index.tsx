import { Button, Icon, type IconName, Text } from '@zerodev/react-ui'

/** Accepted card / wallet payment methods, in design order. Each renders as
 * a small white chip holding the brand mark. */
const PAYMENT_METHODS: { icon: IconName; label: string }[] = [
  { icon: 'visa', label: 'Visa' },
  { icon: 'mastercard', label: 'Mastercard' },
  { icon: 'googlePay', label: 'Google Pay' },
  { icon: 'applePay', label: 'Apple Pay' },
]

export interface BuyWithCardButtonProps {
  /** Starts the card-purchase (onramp) flow. */
  onClick?: () => void
  disabled?: boolean
}

/**
 * "Buy with card" entry button (Figma `20400:2514`, "s-button-text"):
 * react-ui's small secondary `Button` with the label left and the accepted
 * payment-method chips (Visa / Mastercard / Google Pay / Apple Pay) right.
 */
export function BuyWithCardButton({
  onClick,
  disabled,
}: BuyWithCardButtonProps) {
  return (
    <Button
      size="sm"
      action="secondary"
      // shrink-0: the deposit page is a flex column that overflows once the
      // route loads — without it the button gets flex-squashed to ~0 height.
      className="zd:w-full zd:shrink-0"
      {...(onClick && { onClick })}
      {...(disabled !== undefined && { disabled })}
    >
      <span className="zd:flex zd:w-full zd:items-center zd:justify-between zd:gap-2">
        <Text className="zd:text-body1 zd:text-greyScale/80 zd:whitespace-nowrap">
          Buy with card
        </Text>
        {/* -mr-2.5: the design insets the chips 10px from the button edge,
            not the 20px the button's own padding provides — and at the
            widget's real 356px width the row only fits with that inset. */}
        <span className="zd:flex zd:items-center zd:gap-0.5 zd:-mr-2.5">
          {PAYMENT_METHODS.map(({ icon, label }) => (
            <span
              key={icon}
              title={label}
              className="zd:flex zd:h-8 zd:w-[53.33px] zd:shrink-0 zd:items-center zd:justify-center zd:rounded-[8.53px] zd:bg-white"
            >
              {/* Brand marks are exported on a 42.67px frame whose glyph
                  sits in the middle band, so the icon deliberately exceeds
                  the 32px chip — the visible mark stays inside it. */}
              <Icon
                name={icon}
                className="zd:size-[42.67px] zd:shrink-0"
                aria-hidden
              />
            </span>
          ))}
        </span>
      </span>
    </Button>
  )
}
