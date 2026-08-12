import { encode } from 'uqr'

export interface QrCodeProps {
  /** Data to encode. */
  value: string
  /** Pixel size of the rendered SVG square. */
  size: number
  /** Error correction level. Defaults to `'M'`. */
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
  /** Corner radius (in modules, scaled to px internally) for finder patterns. */
  eyeRadius?: number
}

const FINDER_SIZE = 7 // every QR has three 7×7 finder patterns
const MODULE_COLOR = '#000'
const BG_COLOR = '#fff'
/** Vertical shrink applied to data-module pills so rows read as distinct
 * without introducing white slivers wide enough to look like transitions
 * to a scanner. Kept small (5%) so total black area stays close to spec. */
const PILL_PAD_RATIO = 0.05

/**
 * Custom QR renderer that draws runs of horizontally-adjacent data modules as
 * a single rounded pill. Finder patterns stay as sharp concentric squares
 * (rounding them breaks the 1:1:3:1:1 corner ratio scanners use to locate the
 * code). Isolated data modules render as pill-ish rects — visually close to
 * circles at very small `PILL_PAD_RATIO`, still square-adjacent for scanners.
 *
 * Default `errorCorrectionLevel` is `'H'` (30% recovery) so the decorative
 * rounding + shrinkage has plenty of headroom before scans fail.
 *
 * Quiet zone (spec: ≥4 modules of white around the code) is expected to be
 * provided by the caller — e.g. via a white-background padded wrapper. This
 * component fills the given `size` with the QR data area itself so the
 * consumer controls the visual footprint.
 */
export function QrCode({
  value,
  size,
  errorCorrectionLevel = 'H',
  eyeRadius = 0,
}: QrCodeProps) {
  // `uqr` returns a 2D boolean matrix (`data[row][col]`) and the module count
  // per side. Same information as `qrcode`, just shaped differently — the
  // pill/finder rendering below is unchanged.
  const qr = encode(value, { ecc: errorCorrectionLevel, border: 0 })
  const matrix = qr.data
  const moduleCount = qr.size
  const cellSize = size / moduleCount
  const eyeRadiusPx = eyeRadius * cellSize

  const finders = [
    { row: 0, col: 0 },
    { row: 0, col: moduleCount - FINDER_SIZE },
    { row: moduleCount - FINDER_SIZE, col: 0 },
  ]

  const inFinder = (row: number, col: number) =>
    finders.some(
      (f) =>
        row >= f.row &&
        row < f.row + FINDER_SIZE &&
        col >= f.col &&
        col < f.col + FINDER_SIZE,
    )

  // Collect maximal horizontal runs of `on` modules, skipping finder regions.
  const runs: { row: number; col: number; length: number }[] = []
  for (let row = 0; row < moduleCount; row++) {
    let col = 0
    while (col < moduleCount) {
      if (inFinder(row, col)) {
        col++
        continue
      }
      if (matrix[row]?.[col]) {
        let length = 1
        while (
          col + length < moduleCount &&
          !inFinder(row, col + length) &&
          matrix[row]?.[col + length]
        ) {
          length++
        }
        runs.push({ row, col, length })
        col += length
      } else {
        col++
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`QR code for ${value}`}
    >
      <rect width={size} height={size} fill={BG_COLOR} />
      {runs.map(({ row, col, length }) => {
        // Shrink each pill vertically so rows read as distinct without
        // creating scanner-confusing white gaps mid-run. Isolated modules
        // (length === 1) also shrink horizontally so they render close to a
        // circle instead of an oval.
        const pad = cellSize * PILL_PAD_RATIO
        const pillHeight = cellSize - 2 * pad
        const isSingle = length === 1
        return (
          <rect
            key={`r${row}-${col}`}
            x={col * cellSize + (isSingle ? pad : 0)}
            y={row * cellSize + pad}
            width={length * cellSize - (isSingle ? 2 * pad : 0)}
            height={pillHeight}
            rx={pillHeight / 2}
            ry={pillHeight / 2}
            fill={MODULE_COLOR}
          />
        )
      })}
      {finders.map(({ row, col }) => {
        const x = col * cellSize
        const y = row * cellSize
        const outerSize = FINDER_SIZE * cellSize
        const innerSize = 3 * cellSize
        return (
          <g key={`f${row}-${col}`}>
            <rect
              x={x}
              y={y}
              width={outerSize}
              height={outerSize}
              rx={eyeRadiusPx}
              ry={eyeRadiusPx}
              fill={MODULE_COLOR}
            />
            <rect
              x={x + cellSize}
              y={y + cellSize}
              width={outerSize - 2 * cellSize}
              height={outerSize - 2 * cellSize}
              rx={Math.max(eyeRadiusPx - cellSize, 0)}
              ry={Math.max(eyeRadiusPx - cellSize, 0)}
              fill={BG_COLOR}
            />
            <rect
              x={x + 2 * cellSize}
              y={y + 2 * cellSize}
              width={innerSize}
              height={innerSize}
              rx={Math.max(eyeRadiusPx - 2 * cellSize, 0)}
              ry={Math.max(eyeRadiusPx - 2 * cellSize, 0)}
              fill={MODULE_COLOR}
            />
          </g>
        )
      })}
    </svg>
  )
}
