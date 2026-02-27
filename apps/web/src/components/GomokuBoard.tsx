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
      {/* Board background */}
      <rect width={TOTAL} height={TOTAL} fill="#4A4A52" rx="4" />

      {/* Grid lines */}
      {Array.from({ length: BOARD_SIZE }).map((_, i) => (
        <g key={`line-${i}`}>
          <line
            x1={toX(0)} y1={toY(i)} x2={toX(14)} y2={toY(i)}
            stroke="#636370" strokeWidth={1}
          />
          <line
            x1={toX(i)} y1={toY(0)} x2={toX(i)} y2={toY(14)}
            stroke="#636370" strokeWidth={1}
          />
        </g>
      ))}

      {/* Star points */}
      {STAR_POINTS.map(([r, c]) => (
        <circle key={`star-${r}-${c}`} cx={toX(c)} cy={toY(r)} r={4} fill="#73737F" />
      ))}

      {/* Coordinates */}
      {showCoordinates && (
        <>
          {Array.from({ length: BOARD_SIZE }).map((_, i) => (
            <g key={`coord-${i}`}>
              <text
                x={toX(i)} y={MARGIN - 12}
                textAnchor="middle" fill="#8A8A9A" fontSize={11}
                fontFamily="JetBrains Mono"
              >
                {String.fromCharCode(65 + i)}
              </text>
              <text
                x={MARGIN - 14} y={toY(i) + 4}
                textAnchor="middle" fill="#8A8A9A" fontSize={11}
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
          const strokeColor = cell === 1 ? '#000' : '#AAAAAA'

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
        <radialGradient id="black-gradient">
          <stop offset="0%" stopColor="#484848" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </radialGradient>
        <radialGradient id="white-gradient">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#D0D0D0" />
        </radialGradient>
      </defs>
    </svg>
  )
}
