'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { GomokuBoard } from '@/components/GomokuBoard'
import { AgentAvatar } from '@/components/BattleCard'

type PlaybackSpeed = 1 | 2 | 4

type ReplayEntry = {
  round: number
  agentId: string
  action: string
  events: Array<{
    type: 'move' | 'win'
    row: number
    col: number
    color: number
  }>
}

type BoardState = {
  board: number[][]
  lastMove: { row: number; col: number; color: number } | null
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BattlePage({ params }: { params: { id: string } }) {
  const t = useTranslations('battle')
  const tc = useTranslations('common')
  const { data: battle } = useSWR(`/battle/${params.id}`, () => api.getBattle(params.id))
  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)

  const replay: ReplayEntry[] = battle?.replayData ?? []
  const maxStep = replay.length

  // Auto-play logic
  const currentStepRef = useRef(currentStep)
  currentStepRef.current = currentStep

  const advance = useCallback(() => {
    setCurrentStep((prev) => {
      if (prev >= maxStep) {
        setIsPlaying(false)
        return prev
      }
      return prev + 1
    })
  }, [maxStep])

  useEffect(() => {
    if (!isPlaying) return

    const intervalMs = 1000 / speed
    const id = setInterval(advance, intervalMs)
    return () => clearInterval(id)
  }, [isPlaying, speed, advance])

  // Pause when reaching the end
  useEffect(() => {
    if (currentStep >= maxStep) {
      setIsPlaying(false)
    }
  }, [currentStep, maxStep])

  function handleStepChange(step: number): void {
    setCurrentStep(step)
    setIsPlaying(false)
  }

  function handleTogglePlay(): void {
    if (currentStep >= maxStep) {
      setCurrentStep(0)
      setIsPlaying(true)
      return
    }
    setIsPlaying((prev) => !prev)
  }

  if (!battle) {
    return <div className="flex justify-center py-20 text-text-3">{tc('loading')}</div>
  }
  if (battle.error) {
    return <div className="flex justify-center py-20 text-danger">{battle.error}</div>
  }

  const { board, lastMove } = reconstructBoardAtStep(replay, currentStep, maxStep)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left: Board + Controls */}
        <div className="flex-1">
          <AgentMatchup
            agentA={battle.agentAName ?? battle.agentA ?? 'A'}
            agentB={battle.agentBName ?? battle.agentB ?? 'B'}
            eloA={battle.agentARating}
            eloB={battle.agentBRating}
            winnerId={battle.winnerId}
          />

          <GomokuBoard board={board} lastMove={lastMove} showCoordinates size={540} />

          <ReplayControls
            currentStep={currentStep}
            maxStep={maxStep}
            isPlaying={isPlaying}
            speed={speed}
            onStepChange={handleStepChange}
            onTogglePlay={handleTogglePlay}
            onSpeedChange={setSpeed}
          />
        </div>

        {/* Right: Battle Info + Move History */}
        <div className="lg:w-72 space-y-4">
          <BattleInfoPanel battle={battle} replay={replay} />
          <MoveHistory
            replay={replay}
            currentStep={currentStep}
            onStepSelect={handleStepChange}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Board reconstruction
// ---------------------------------------------------------------------------

function reconstructBoardAtStep(
  replay: ReplayEntry[],
  currentStep: number,
  maxStep: number,
): BoardState {
  const board = Array.from({ length: 15 }, () => new Array(15).fill(0))
  let lastMove: BoardState['lastMove'] = null

  for (let i = 0; i < Math.min(currentStep, maxStep); i++) {
    const entry = replay[i]
    for (const event of entry.events ?? []) {
      if ((event.type === 'move' || event.type === 'win') && event.row !== undefined) {
        board[event.row][event.col] = event.color
        lastMove = event
      }
    }
  }

  return { board, lastMove }
}

// ---------------------------------------------------------------------------
// Agent matchup header
// ---------------------------------------------------------------------------

type AgentMatchupProps = {
  agentA: string
  agentB: string
  eloA?: number
  eloB?: number
  winnerId?: string | null
}

function AgentMatchup({ agentA, agentB, eloA, eloB, winnerId }: AgentMatchupProps) {
  const t = useTranslations('battle')
  const aIsWinner = winnerId === agentA
  const bIsWinner = winnerId === agentB

  return (
    <div className="flex items-center justify-between mb-6">
      {/* Agent A (Black) */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <AgentAvatar name={agentA} size={44} />
          {aIsWinner && <TrophyBadge />}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-display font-bold ${aIsWinner ? 'text-accent-2' : ''}`}>
              {agentA}
            </span>
            <StoneIndicator color={1} />
          </div>
          {eloA != null && (
            <span className="text-xs text-text-3 font-mono">{eloA} ELO</span>
          )}
        </div>
      </div>

      <span className="text-text-3 font-display text-sm">{t('vs')}</span>

      {/* Agent B (White) */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-1.5">
            <StoneIndicator color={2} />
            <span className={`font-display font-bold ${bIsWinner ? 'text-accent-2' : ''}`}>
              {agentB}
            </span>
          </div>
          {eloB != null && (
            <span className="text-xs text-text-3 font-mono">{eloB} ELO</span>
          )}
        </div>
        <div className="relative">
          <AgentAvatar name={agentB} size={44} />
          {bIsWinner && <TrophyBadge />}
        </div>
      </div>
    </div>
  )
}

function TrophyBadge(): JSX.Element {
  const t = useTranslations('battle')
  return (
    <span
      className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center rounded-full bg-gold text-[10px]"
      title={t('winner')}
    >
      {'\uD83C\uDFC6'}
    </span>
  )
}

function StoneIndicator({ color }: { color: number }): JSX.Element {
  const t = useTranslations('battle.stone')
  if (color === 1) {
    return (
      <span
        className="inline-block w-3.5 h-3.5 rounded-full border border-border"
        style={{ background: 'radial-gradient(circle at 35% 35%, #484848, #1A1A1A)' }}
        title={t('black')}
      />
    )
  }

  return (
    <span
      className="inline-block w-3.5 h-3.5 rounded-full border border-border"
      style={{ background: 'radial-gradient(circle at 35% 35%, #FFFFFF, #D0D0D0)' }}
      title={t('white')}
    />
  )
}

// ---------------------------------------------------------------------------
// Replay controls (play/pause, speed, step buttons, progress bar)
// ---------------------------------------------------------------------------

type ReplayControlsProps = {
  currentStep: number
  maxStep: number
  isPlaying: boolean
  speed: PlaybackSpeed
  onStepChange: (step: number) => void
  onTogglePlay: () => void
  onSpeedChange: (speed: PlaybackSpeed) => void
}

const SPEED_OPTIONS: PlaybackSpeed[] = [1, 2, 4]

function ReplayControls({
  currentStep,
  maxStep,
  isPlaying,
  speed,
  onStepChange,
  onTogglePlay,
  onSpeedChange,
}: ReplayControlsProps) {
  const t = useTranslations('battle')
  const progressPercent = maxStep > 0 ? (currentStep / maxStep) * 100 : 0

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>): void {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const fraction = Math.max(0, Math.min(1, x / rect.width))
    const step = Math.round(fraction * maxStep)
    onStepChange(step)
  }

  function cycleSpeed(): void {
    const currentIndex = SPEED_OPTIONS.indexOf(speed)
    const nextIndex = (currentIndex + 1) % SPEED_OPTIONS.length
    onSpeedChange(SPEED_OPTIONS[nextIndex])
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Clickable progress bar */}
      <div
        className="h-2 bg-surface-2 rounded-full overflow-hidden cursor-pointer group"
        onClick={handleProgressClick}
        title={t('step', { current: currentStep, total: maxStep })}
      >
        <div
          className="h-full bg-accent rounded-full transition-all duration-150 group-hover:brightness-125"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Control buttons row */}
      <div className="flex items-center justify-center gap-2">
        <ControlButton onClick={() => onStepChange(0)} label={t('controls.goToStart')}>
          {'\u23EE'}
        </ControlButton>
        <ControlButton onClick={() => onStepChange(Math.max(0, currentStep - 1))} label={t('controls.stepBack')}>
          {'\u25C0'}
        </ControlButton>

        {/* Play / Pause */}
        <button
          onClick={onTogglePlay}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-accent text-white hover:brightness-110 transition-all"
          title={isPlaying ? t('controls.pause') : t('controls.play')}
        >
          <span className="text-base">{isPlaying ? '\u23F8' : '\u25B6'}</span>
        </button>

        <ControlButton
          onClick={() => onStepChange(Math.min(maxStep, currentStep + 1))}
          label={t('controls.stepForward')}
        >
          {'\u25B6'}
        </ControlButton>
        <ControlButton onClick={() => onStepChange(maxStep)} label={t('controls.goToEnd')}>
          {'\u23ED'}
        </ControlButton>

        {/* Speed toggle */}
        <button
          onClick={cycleSpeed}
          className="ml-3 px-2 py-1 rounded text-xs font-mono text-text-2 bg-surface-2 hover:text-text transition-colors"
          title={t('controls.speed')}
        >
          {speed}x
        </button>
      </div>

      {/* Step counter */}
      <div className="text-center font-mono text-xs text-text-3">
        {t('step', { current: currentStep, total: maxStep })}
      </div>
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void
  label: string
  children: React.ReactNode
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-sm text-text-2 hover:text-text transition-colors"
      title={label}
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Battle info panel
// ---------------------------------------------------------------------------

function BattleInfoPanel({ battle, replay }: { battle: any; replay: ReplayEntry[] }): JSX.Element {
  const t = useTranslations('battle')
  const startTime = battle.startedAt
    ? new Date(battle.startedAt).toLocaleString()
    : '--'

  const endTime = battle.endedAt
    ? new Date(battle.endedAt).toLocaleString()
    : null

  const durationText = formatDuration(battle.startedAt, battle.endedAt)

  const totalRounds = replay.length > 0
    ? replay[replay.length - 1].round
    : 0

  const wagerUsdc = Number(battle.wager) / 1000
  const totalPool = wagerUsdc * 2
  const fee = battle.feePercent != null ? `${battle.feePercent}%` : '5%'

  return (
    <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
      <h3 className="font-display font-bold text-sm">{t('battleInfo')}</h3>
      <div className="space-y-2 text-sm">
        <InfoRow label={t('game')} value={battle.gameId} />
        <InfoRow label={t('started')} value={startTime} />
        {endTime && <InfoRow label={t('ended')} value={endTime} />}
        {durationText && <InfoRow label={t('duration')} value={durationText} />}
        <InfoRow label={t('rounds')} value={String(totalRounds)} />
        <InfoRow label={t('moves')} value={String(replay.length)} />

        <div className="border-t border-border my-2" />

        <InfoRow label={t('wager')} value={t('usdcEach', { amount: wagerUsdc })} />
        <InfoRow label={t('pool')} value={t('usdcAmount', { amount: totalPool })} />
        <InfoRow label={t('fee')} value={fee} />

        <div className="flex justify-between">
          <span className="text-text-2">{t('status')}</span>
          <StatusLabel status={battle.status} />
        </div>

        {battle.winnerId && (
          <div className="flex justify-between">
            <span className="text-text-2">{t('winner')}</span>
            <span className="text-accent-2 font-display">
              {'\uD83C\uDFC6'} {battle.winnerId}
            </span>
          </div>
        )}

        {battle.settlementTx && (
          <div className="flex justify-between">
            <span className="text-text-2">{t('tx')}</span>
            <a
              href={`https://sepolia.basescan.org/tx/${battle.settlementTx}`}
              target="_blank"
              rel="noopener"
              className="text-accent font-mono text-xs truncate max-w-[120px]"
            >
              {battle.settlementTx.slice(0, 10)}...
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

function StatusLabel({ status }: { status: string }): JSX.Element {
  const t = useTranslations('battle')
  if (status === 'finished') {
    return <span className="text-accent-2">{t('finished')}</span>
  }
  if (status === 'active') {
    return (
      <span className="flex items-center gap-1 text-accent-2">
        <span className="w-2 h-2 rounded-full bg-accent-2 animate-pulse" />
        {t('live')}
      </span>
    )
  }
  return <span className="text-gold capitalize">{status}</span>
}

function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between">
      <span className="text-text-2">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

function formatDuration(startedAt?: string, endedAt?: string): string | null {
  if (!startedAt || !endedAt) return null

  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 0) return null

  const totalSec = Math.floor(ms / 1000)
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60

  if (min === 0) return `${sec}s`
  return `${min}m ${sec}s`
}

// ---------------------------------------------------------------------------
// Move history
// ---------------------------------------------------------------------------

type MoveHistoryProps = {
  replay: ReplayEntry[]
  currentStep: number
  onStepSelect: (step: number) => void
}

function MoveHistory({ replay, currentStep, onStepSelect }: MoveHistoryProps): JSX.Element {
  const t = useTranslations('battle')
  const activeRef = useRef<HTMLButtonElement>(null)

  // Auto-scroll to the active move
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [currentStep])

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="font-display font-bold text-sm mb-3">{t('moves')}</h3>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {replay.map((entry, i) => {
          const moveIndex = i + 1
          const isActive = moveIndex === currentStep
          const event = entry.events?.[0]
          const isWinMove = event?.type === 'win'
          const coords = event?.row !== undefined ? `${event.row},${event.col}` : ''

          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              onClick={() => onStepSelect(moveIndex)}
              className={buildMoveClassName(isActive, isWinMove)}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-text-3 w-6 text-right shrink-0">#{moveIndex}</span>
                {event?.color != null && <StoneIndicator color={event.color} />}
                <span className="truncate">{entry.agentId?.slice(0, 8)}</span>
              </span>
              <span className="flex items-center gap-1.5">
                {coords && (
                  <span className="text-text-3">[{coords}]</span>
                )}
                {isWinMove && (
                  <span className="text-gold text-[10px]" title={t('winningMove')}>
                    {'\u2605'}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function buildMoveClassName(isActive: boolean, isWinMove: boolean): string {
  const base = 'w-full flex items-center justify-between px-2 py-1 rounded text-xs font-mono transition-colors'

  if (isWinMove && isActive) {
    return `${base} bg-gold/10 text-gold ring-1 ring-gold/30`
  }
  if (isWinMove) {
    return `${base} bg-gold/5 text-gold hover:bg-gold/10`
  }
  if (isActive) {
    return `${base} bg-surface-2 text-accent`
  }
  return `${base} text-text-2 hover:bg-surface-2`
}
