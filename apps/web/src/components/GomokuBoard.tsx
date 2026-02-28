'use client'

const BOARD_SIZE = 15
const CELL = 36
const MARGIN = 28
const TOTAL = CELL * (BOARD_SIZE - 1) + MARGIN * 2
const STONE_R = 15

const STAR_POINTS = [
  [3, 3], [3, 7], [3, 11],
  [7, 3], [7, 7], [7, 11],
  [11, 3], [11, 7], [11, 11],
]

type Props = {
  board: number[][]
  lastMove?: { row: number; col: number; color: number } | null
  currentStep?: number
  showCoordinates?: boolean
  size?: number
}

function toX(col: number): number {
  return MARGIN + col * CELL
}

function toY(row: number): number {
  return MARGIN + row * CELL
}

export function GomokuBoard({ board, lastMove, showCoordinates = false, size }: Props) {
  const viewBox = `0 0 ${TOTAL} ${TOTAL}`

  return (
    <svg
      viewBox={viewBox}
      width={size || TOTAL}
      height={size || TOTAL}
      className="select-none"
    >
      {/* Board background — wood texture */}
      <defs>
        <pattern id="wood-grain" patternUnits="userSpaceOnUse" width={TOTAL} height={TOTAL}>
          <rect width={TOTAL} height={TOTAL} fill="#DCB468" />
          {/* Horizontal wood grain lines */}
          {Array.from({ length: 40 }).map((_, i) => {
            const y = i * (TOTAL / 40) + (i % 3) * 2
            const opacity = 0.06 + (i % 5) * 0.02
            return (
              <line
                key={`grain-${i}`}
                x1={0} y1={y} x2={TOTAL} y2={y + (i % 2 ? 3 : -2)}
                stroke="#B8943E" strokeWidth={i % 7 === 0 ? 2.5 : 1} opacity={opacity}
              />
            )
          })}
          {/* Subtle knot accents */}
          <ellipse cx={TOTAL * 0.2} cy={TOTAL * 0.35} rx={18} ry={6} fill="#C9A44A" opacity={0.15} />
          <ellipse cx={TOTAL * 0.75} cy={TOTAL * 0.7} rx={22} ry={5} fill="#C9A44A" opacity={0.12} />
        </pattern>
      </defs>
      <rect width={TOTAL} height={TOTAL} fill="url(#wood-grain)" rx="4" />
      {/* Subtle varnish overlay */}
      <rect width={TOTAL} height={TOTAL} fill="url(#varnish)" rx="4" opacity="0.3" />

      {/* Grid lines */}
      {Array.from({ length: BOARD_SIZE }).map((_, i) => (
        <g key={`line-${i}`}>
          <line
            x1={toX(0)} y1={toY(i)} x2={toX(14)} y2={toY(i)}
            stroke="#5C4A28" strokeWidth={0.8}
          />
          <line
            x1={toX(i)} y1={toY(0)} x2={toX(i)} y2={toY(14)}
            stroke="#5C4A28" strokeWidth={0.8}
          />
        </g>
      ))}

      {/* Board edge (thicker border) */}
      <rect
        x={toX(0)} y={toY(0)}
        width={toX(14) - toX(0)} height={toY(14) - toY(0)}
        fill="none" stroke="#5C4A28" strokeWidth={1.5}
      />

      {/* Star points */}
      {STAR_POINTS.map(([r, c]) => (
        <circle key={`star-${r}-${c}`} cx={toX(c)} cy={toY(r)} r={3.5} fill="#5C4A28" />
      ))}

      {/* Coordinates */}
      {showCoordinates && (
        <>
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <g key={`coord-${i}`}>
              <text
                x={toX(i)} y={MARGIN - 12}
                textAnchor="middle" fill="#7A6535" fontSize={11}
                fontFamily="JetBrains Mono"
              >
                {String.fromCharCode(65 + i)}
              </text>
              <text
                x={MARGIN - 14} y={toY(i) + 4}
                textAnchor="middle" fill="#7A6535" fontSize={11}
                fontFamily="JetBrains Mono"
              >
                {i + 1}
              </text>
            </g>
          ))}
        </>
      )}

      {/* Stones */}
      {board.map((row, r) =>
        row.map((cell, c) => {
          if (cell === 0) return null
          const isLast = lastMove?.row === r && lastMove?.col === c
          const gradientId = cell === 1 ? 'black-gradient' : 'white-gradient'
          const strokeColor = cell === 1 ? '#111' : '#999'

          return (
            <g key={`stone-${r}-${c}`}>
              <circle
                cx={toX(c)} cy={toY(r)} r={STONE_R}
                fill={`url(#${gradientId})`} stroke={strokeColor} strokeWidth={1}
              >
                <animate attributeName="r" from="0" to={String(STONE_R)} dur="0.15s" fill="freeze" />
              </circle>
              {isLast && (
                <circle cx={toX(c)} cy={toY(r)} r={4} fill="#FF4444">
                  <animate
                    attributeName="opacity"
                    values="1;0.4;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
            </g>
          )
        })
      )}

      {/* Gradients */}
      <defs>
        <radialGradient id="black-gradient" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#555555" />
          <stop offset="100%" stopColor="#111111" />
        </radialGradient>
        <radialGradient id="white-gradient" cx="35%" cy="35%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#C8C8C8" />
        </radialGradient>
        <radialGradient id="varnish" cx="30%" cy="25%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
    </svg>
  )
}
