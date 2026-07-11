import { encode } from 'uqr'

/**
 * Renders `value` as a QR code. ECC level Q so ~25% of the modules are
 * recoverable — leaves room to overlay a center logo.
 */
export function QrCode({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  const qr = encode(value, { ecc: 'Q', border: 2 })

  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className={className}
      role="img"
      aria-label="WalletConnect QR code"
    >
      {qr.data.flatMap((row, y) =>
        row.map((dark, x) =>
          dark ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: grid cells are positional
            <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} />
          ) : null,
        ),
      )}
    </svg>
  )
}
