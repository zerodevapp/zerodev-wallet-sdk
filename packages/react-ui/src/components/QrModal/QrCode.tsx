import { encode } from 'uqr'

interface QrCodeProps {
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

/**
 * Custom QR renderer that draws runs of horizontally-adjacent modules as a
 * single rounded pill, and the three finder patterns as rounded squares.
 * Isolated modules naturally fall out as circles (a 1×1 pill is a circle).
 */
export function QrCode({
  value,
  size,
  errorCorrectionLevel = 'M',
  eyeRadius = 2,
}: QrCodeProps) {
  // `uqr` returns a 2D boolean matrix (`data[row][col]`) and the module count
  // per side. Same information as `qrcode`, just shaped differently — the
  // pill/finder rendering below is unchanged.
  const qr = encode(value, { ecc: errorCorrectionLevel })
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
        // Shrink each pill vertically so rows have a visible gap between
        // them. For a single isolated module (length === 1) also shrink
        // horizontally so it renders as a circle, not an oval.
        const pad = cellSize * 0.1
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
