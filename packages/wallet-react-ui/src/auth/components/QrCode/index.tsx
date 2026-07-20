import { encode } from 'uqr'

/**
 * Renders `value` as a QR code. ECC level Q so ~25% of the modules are
 * recoverable — that error budget is what lets `logo` cover the center.
 */
export function QrCode({
  value,
  logo,
  className,
}: {
  value: string
  /** Image URI drawn over the center (~22% of the code, inside ECC Q's budget). */
  logo?: string
  className?: string
}) {
  const qr = encode(value, { ecc: 'Q', border: 2 })

  // Center knockout: dark modules under the logo are dropped so the logo sits
  // on a clean tile instead of noise. ~22% of the width stays safely within
  // the ~25% ECC Q recovery budget.
  const logoSize = logo ? Math.floor(qr.size * 0.22) : 0
  const logoStart = Math.floor((qr.size - logoSize) / 2)
  const logoEnd = logoStart + logoSize
  const inLogoArea = (x: number, y: number) =>
    x >= logoStart && x < logoEnd && y >= logoStart && y < logoEnd

  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      className={className}
      role="img"
      aria-label="WalletConnect QR code"
    >
      {qr.data.flatMap((row, y) =>
        row.map((dark, x) =>
          dark && !(logo && inLogoArea(x, y)) ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: grid cells are positional
            <rect key={`${x}:${y}`} x={x} y={y} width={1} height={1} />
          ) : null,
        ),
      )}
      {logo && (
        <>
          <rect
            x={logoStart}
            y={logoStart}
            width={logoSize}
            height={logoSize}
            fill="#fff"
          />
          <image
            href={logo}
            x={logoStart + 1}
            y={logoStart + 1}
            width={logoSize - 2}
            height={logoSize - 2}
            preserveAspectRatio="xMidYMid meet"
          />
        </>
      )}
    </svg>
  )
}
