'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { AgentAvatar, BattleCard } from '@/components/BattleCard'
import { GomokuBoard } from '@/components/GomokuBoard'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = 'active' | 'open' | 'finished'

type MoveEvent = {
  type: string
  row: number
  col: number
  color: number
}

// ---------------------------------------------------------------------------
// Board helpers
// ---------------------------------------------------------------------------

function createEmptyBoard(): number[][] {
  return Array.from({ length: 15 }, () => new Array(15).fill(0))
}

function extractMoves(
  replayData: Array<{ agentId?: string; events?: MoveEvent[] }>,
): Array<{ agentId: string; event: MoveEvent; index: number }> {
  const moves: Array<{ agentId: string; event: MoveEvent; index: number }> = []
  for (const entry of replayData) {
    for (const event of entry.events ?? []) {
      if ((event.type === 'move' || event.type === 'win') && event.row !== undefined) {
        moves.push({ agentId: entry.agentId ?? '?', event, index: moves.length + 1 })
      }
    }
  }
  return moves
}

// ---------------------------------------------------------------------------
// Room-to-battle adapter for the "open" tab
// ---------------------------------------------------------------------------

function mapRoomToBattle(room: any): any {
  return {
    id: room.id ?? room.roomId,
    gameId: room.gameId ?? room.game ?? 'gomoku',
    agentA: room.creatorId ?? room.hostAgent ?? 'Waiting...',
    agentAName: room.creatorName ?? room.creatorId ?? 'Waiting...',
    agentB: null,
    agentBName: 'Waiting...',
    status: 'open',
    winnerId: null,
    wager: room.wager ?? '0',
    startedAt: room.createdAt ?? new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Countdown timer hook
// ---------------------------------------------------------------------------

function useCountdown(deadline: string | null): number {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!deadline) {
      setRemaining(0)
      return
    }

    function tick(): void {
      const ms = new Date(deadline!).getTime() - Date.now()
      setRemaining(Math.max(0, ms))
    }

    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])

  return remaining
}

// ---------------------------------------------------------------------------
// ArenaPage
// ---------------------------------------------------------------------------

export default function ArenaPage(): JSX.Element {
  const t = useTranslations('arena')
  const [tab, setTab] = useState<Tab>('active')
  const [gameFilter, setGameFilter] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedRoom, setSelectedRoom] = useState<any>(null)

  const TABS: Array<{ key: Tab; label: string }> = [
    { key: 'active', label: t('tabs.live') },
    { key: 'open', label: t('tabs.waiting') },
    { key: 'finished', label: t('tabs.finished') },
  ]

  // Fetch counts for all three tabs in parallel
  const { data: activeData } = useSWR(
    '/battles?status=active&limit=20',
    () => api.getBattles('status=active&limit=20'),
    { refreshInterval: 5000 },
  )
  const { data: openData } = useSWR(
    '/rooms?status=open',
    () => api.getRooms('status=open'),
    { refreshInterval: 5000 },
  )
  const { data: finishedData } = useSWR(
    '/battles?status=finished&limit=20',
    () => api.getBattles('status=finished&limit=20'),
    { refreshInterval: 10000 },
  )

  const activeBattles = activeData?.battles ?? []
  const openRooms = openData?.rooms ?? openData?.battles ?? []
  const finishedBattles = finishedData?.battles ?? []

  const counts: Record<Tab, number | null> = {
    active: activeBattles.length > 0 ? activeBattles.length : null,
    open: openRooms.length > 0 ? openRooms.length : null,
    finished: null,
  }

  const mappedOpenRooms = openRooms.map(mapRoomToBattle)

  // Collect unique game IDs across all tabs
  const allGameIds = Array.from(
    new Set(
      [...activeBattles, ...mappedOpenRooms, ...finishedBattles]
        .map((b: any) => b.gameId ?? b.game ?? '')
        .filter(Boolean),
    ),
  ).sort()

  function battlesForTab(): any[] {
    let list: any[]
    if (tab === 'active') list = activeBattles
    else if (tab === 'open') list = mappedOpenRooms
    else list = finishedBattles

    if (gameFilter) {
      list = list.filter((b: any) => (b.gameId ?? b.game) === gameFilter)
    }
    return list
  }

  const battles = battlesForTab()

  // Detect if selected item is a room (ID starts with rm_) vs a battle
  const isRoom = selectedId?.startsWith('rm_') ?? false

  // Only fetch battle detail for actual battles, not rooms
  const { data: battleDetail } = useSWR(
    selectedId && !isRoom ? `/battle/${selectedId}` : null,
    () => (selectedId && !isRoom ? api.getBattle(selectedId) : null),
    { refreshInterval: 3000 },
  )

  function handleSelect(item: any) {
    setSelectedId(item.id)
    if (item.status === 'open') {
      setSelectedRoom(item)
    } else {
      setSelectedRoom(null)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex gap-6">
        {/* Left: Battle List */}
        <div className="flex-1 min-w-0">
          <h1 className="font-display text-2xl font-bold mb-6">{t('title')}</h1>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 border-b border-border">
            {TABS.map(({ key, label }) => {
              const count = counts[key]
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-4 py-2 text-sm font-display transition-colors ${
                    tab === key
                      ? 'text-accent border-b-2 border-accent'
                      : 'text-text-2 hover:text-text'
                  }`}
                >
                  {label}
                  {count !== null && (
                    <span className="ml-1.5 text-xs opacity-70">({count})</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Game filter */}
          {allGameIds.length > 0 && (
            <div className="flex gap-2 mb-6 flex-wrap">
              <button
                onClick={() => setGameFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-display transition-colors ${
                  gameFilter === null
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-border text-text-2 hover:text-text'
                }`}
              >
                {t('gameFilterAll')}
              </button>
              {allGameIds.map((gid) => (
                <button
                  key={gid}
                  onClick={() => setGameFilter(gid)}
                  className={`px-3 py-1 rounded-full text-xs font-display capitalize transition-colors ${
                    gameFilter === gid
                      ? 'bg-accent text-white'
                      : 'bg-surface border border-border text-text-2 hover:text-text'
                  }`}
                >
                  {gid}
                </button>
              ))}
            </div>
          )}

          {/* Battle Cards */}
          <div className="space-y-3">
            {battles.length === 0 ? (
              <div className="text-center py-12 text-text-3">{t('noBattles')}</div>
            ) : (
              battles.map((battle: any) => (
                <div
                  key={battle.id}
                  onClick={() => handleSelect(battle)}
                  className={`cursor-pointer rounded-lg transition-all ${
                    selectedId === battle.id
                      ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg'
                      : ''
                  }`}
                >
                  <BattleCard battle={battle} disableLink />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Observation Panel */}
        <div className="hidden lg:block w-[380px] shrink-0">
          <div className="sticky top-20 bg-surface border border-border rounded-lg p-4">
            {isRoom && selectedRoom ? (
              <RoomPanel room={selectedRoom} />
            ) : (
              <ObservationPanel battleId={selectedId} battleDetail={battleDetail} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ObservationPanel
// ---------------------------------------------------------------------------

type ObservationPanelProps = {
  battleId: string | null
  battleDetail: any
}

function ObservationPanel({ battleId, battleDetail }: ObservationPanelProps): JSX.Element {
  const t = useTranslations('arena')

  // Live state polling (1s) — only for active battles
  const isActive = battleDetail?.status === 'active'
  const { data: liveState } = useSWR(
    battleId && isActive ? `/battle/${battleId}/live` : null,
    () => api.getLiveBattle(battleId!),
    { refreshInterval: 1000 },
  )

  if (!battleId || !battleDetail) {
    return (
      <div className="text-center py-20 text-text-3 text-sm">{t('selectBattle')}</div>
    )
  }

  // Board: prefer live gameState.board (Redis, real-time), fallback to DB replayData
  const liveBoard: number[][] | undefined = liveState?.gameState?.board
  const replay = battleDetail.replayData ?? []
  const replayMoves = extractMoves(replay)

  const board = liveBoard ?? (replayMoves.length > 0 ? buildBoardFromMoves(replayMoves) : createEmptyBoard())
  const lastMove: MoveEvent | null = liveState?.gameState?.lastMove ?? replayMoves.at(-1)?.event ?? null
  const moves = replayMoves

  // Turn info from live state
  const currentTurnAgentId = liveState?.currentTurnAgentId ?? null
  const turnDeadline = liveState?.updatedAt && liveState?.timeoutMs
    ? new Date(new Date(liveState.updatedAt).getTime() + liveState.timeoutMs).toISOString()
    : null

  // Status
  const isFinished = liveState?.status === 'finished' || battleDetail.status === 'finished'
  const winnerId = liveState?.winner ?? battleDetail.winnerId ?? null
  const finishReason = liveState?.finishReason ?? null
  const isLive = isActive && !isFinished

  // Agent info
  const agentA = battleDetail.agentAName ?? battleDetail.agentA ?? 'Agent A'
  const agentB = battleDetail.agentBName ?? battleDetail.agentB ?? 'Agent B'
  const idA = battleDetail.agentA ?? ''
  const idB = battleDetail.agentB ?? ''
  const agentNames: Record<string, string> = { [idA]: agentA, [idB]: agentB }
  const eloA = battleDetail.agentARating ?? battleDetail.eloA ?? null
  const eloB = battleDetail.agentBRating ?? battleDetail.eloB ?? null

  return (
    <>
      {/* Status header */}
      <StatusHeader isLive={isLive} isFinished={isFinished} battleId={battleId} />

      {/* Agent matchup with avatars and ELO */}
      <AgentMatchupBar
        agentA={agentA}
        agentB={agentB}
        idA={idA}
        idB={idB}
        eloA={eloA}
        eloB={eloB}
        winnerId={winnerId}
        currentTurnId={currentTurnAgentId}
      />

      {/* Turn timer */}
      {isLive && turnDeadline && (
        <TurnTimerBar
          deadline={turnDeadline}
          currentTurnId={currentTurnAgentId}
          idA={idA}
          idB={idB}
          agentA={agentA}
          agentB={agentB}
        />
      )}

      {/* Board */}
      <GomokuBoard board={board} lastMove={lastMove} size={340} />

      {/* Finished banner */}
      {isFinished && <FinishedBanner winnerId={winnerId} reason={finishReason} agentNames={agentNames} />}

      {/* Watch Replay button */}
      {isFinished && (
        <Link
          href={`/battle/${battleId}`}
          className="mt-3 flex items-center justify-center gap-2 w-full rounded-lg bg-accent text-white font-display font-bold text-sm py-2.5 hover:bg-accent/90 transition-colors"
        >
          {t('watchReplay')} &rarr;
        </Link>
      )}

      {/* Last 5 moves */}
      {moves.length > 0 && <RecentMovesList moves={moves} agentNames={agentNames} />}

      {/* Battle metadata */}
      <div className="mt-4 space-y-2">
        <MetaRow label={t('metaStatus')} value={isFinished ? 'finished' : battleDetail.status} />
        {battleDetail.gameId && <MetaRow label={t('metaGame')} value={battleDetail.gameId} />}
        <MetaRow label={t('metaMoves')} value={String(liveState?.round ?? moves.length)} />
      </div>
    </>
  )
}

function buildBoardFromMoves(
  moves: Array<{ event: MoveEvent }>,
): number[][] {
  const board = createEmptyBoard()
  for (const m of moves) {
    const e = m.event
    if ((e.type === 'move' || e.type === 'win') && e.row !== undefined) {
      board[e.row][e.col] = e.color
    }
  }
  return board
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusHeader({
  isLive,
  isFinished,
  battleId,
}: {
  isLive: boolean
  isFinished: boolean
  battleId: string
}): JSX.Element {
  const t = useTranslations('arena')
  return (
    <div className="flex items-center gap-2 mb-4">
      {isLive && (
        <>
          <span className="w-2 h-2 rounded-full bg-accent-2 animate-pulse" />
          <span className="text-xs text-accent-2 font-display">{t('statusLive')}</span>
        </>
      )}
      {isFinished && <span className="text-xs text-text-3 font-display">{t('statusFinished')}</span>}
      {!isLive && !isFinished && <span className="text-xs text-gold font-display">{t('statusWaiting')}</span>}
      <span className="text-xs text-text-3 font-mono ml-auto truncate max-w-[140px]">
        {battleId}
      </span>
    </div>
  )
}

function AgentMatchupBar({
  agentA,
  agentB,
  idA,
  idB,
  eloA,
  eloB,
  winnerId,
  currentTurnId,
}: {
  agentA: string
  agentB: string
  idA: string
  idB: string
  eloA: number | null
  eloB: number | null
  winnerId: string | null
  currentTurnId: string | null
}): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-4">
      <AgentTag
        name={agentA}
        elo={eloA}
        isWinner={winnerId === idA}
        isTurn={currentTurnId === idA}
        stone="black"
      />
      <span className="text-text-3 font-display text-xs">VS</span>
      <AgentTag
        name={agentB}
        elo={eloB}
        isWinner={winnerId === idB}
        isTurn={currentTurnId === idB}
        stone="white"
        align="right"
      />
    </div>
  )
}

function AgentTag({
  name,
  elo,
  isWinner,
  isTurn,
  stone,
  align = 'left',
}: {
  name: string
  elo: number | null
  isWinner: boolean
  isTurn: boolean
  stone: 'black' | 'white'
  align?: 'left' | 'right'
}): JSX.Element {
  const stoneSymbol = stone === 'black' ? '\u26AB' : '\u26AA'

  let nameColor = 'text-text'
  if (isWinner) nameColor = 'text-accent-2'
  else if (isTurn) nameColor = 'text-accent'

  const textBlock = (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className={`text-sm font-display font-bold ${nameColor}`}>
        {name} <span className="text-xs">{stoneSymbol}</span>
      </div>
      {elo !== null && <div className="text-xs text-text-3 font-mono">{elo} ELO</div>}
    </div>
  )

  if (align === 'right') {
    return (
      <div className="flex items-center gap-2">
        {textBlock}
        <AgentAvatar name={name} size={32} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <AgentAvatar name={name} size={32} />
      {textBlock}
    </div>
  )
}

function TurnTimerBar({
  deadline,
  currentTurnId,
  idA,
  idB,
  agentA,
  agentB,
}: {
  deadline: string
  currentTurnId: string | null
  idA: string
  idB: string
  agentA: string
  agentB: string
}): JSX.Element {
  const t = useTranslations('arena')
  const TURN_DURATION_MS = 30_000
  const remaining = useCountdown(deadline)
  const fraction = Math.min(remaining / TURN_DURATION_MS, 1)

  let barColor = 'bg-accent-2'
  if (fraction < 0.25) {
    barColor = 'bg-danger'
  } else if (fraction < 0.5) {
    barColor = 'bg-gold'
  }

  let turnLabel = 'Unknown'
  if (currentTurnId === idA) turnLabel = agentA
  else if (currentTurnId === idB) turnLabel = agentB

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-text-2">
          {t('playerTurn', { name: turnLabel })}
        </span>
        <span className="font-mono text-text-3">{(remaining / 1000).toFixed(1)}s</span>
      </div>
      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-200 rounded-full`}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  )
}

function FinishedBanner({
  winnerId,
  reason,
  agentNames,
}: {
  winnerId: string | null
  reason: string | null
  agentNames: Record<string, string>
}): JSX.Element {
  const t = useTranslations('arena')
  const winnerName = winnerId ? (agentNames[winnerId] ?? winnerId) : null
  return (
    <div className="mt-3 rounded-md bg-surface-2 border border-border p-3 text-center">
      <div className="text-sm font-display font-bold text-accent-2">
        {winnerName ? t('wins', { name: winnerName }) : t('draw')}
      </div>
      {reason && <div className="text-xs text-text-3 mt-1">{reason}</div>}
    </div>
  )
}

function RecentMovesList({
  moves,
  agentNames,
}: {
  moves: Array<{ agentId: string; event: MoveEvent; index: number }>
  agentNames: Record<string, string>
}): JSX.Element {
  const t = useTranslations('arena')
  const recentMoves = moves.slice(-5).reverse()

  return (
    <div className="mt-4">
      <h4 className="text-xs text-text-3 font-display mb-2">{t('recentMoves')}</h4>
      <div className="space-y-1">
        {recentMoves.map((m) => (
          <div
            key={m.index}
            className="flex items-center justify-between px-2 py-1 rounded text-xs font-mono bg-surface-2"
          >
            <span className="text-text-2">
              #{m.index} {agentNames[m.agentId] ?? m.agentId}
            </span>
            <span className="text-text-3">
              [{m.event.row},{m.event.col}]
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function metaValueColor(value: string): string {
  if (value === 'active') return 'text-accent-2'
  if (value === 'finished') return 'text-text-3'
  return 'text-text'
}

function MetaRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-text-2">{label}</span>
      <span className={metaValueColor(value)}>{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RoomPanel — shown when an open room is selected
// ---------------------------------------------------------------------------

function RoomPanel({ room }: { room: any }): JSX.Element {
  const t = useTranslations('arena')
  const wagerNum = Number(room.wager || 0)
  const wagerDisplay = wagerNum >= 1000 ? `${(wagerNum / 1_000_000).toFixed(2)} USDC` : `${wagerNum} tokens`

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs text-gold font-display">{t('waitingForOpponent')}</span>
        <span className="text-xs text-text-3 font-mono ml-auto truncate max-w-[140px]">
          {room.id}
        </span>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <AgentAvatar name={room.agentAName || room.agentA || '?'} size={40} />
        <div>
          <div className="text-sm font-display font-bold text-text">
            {room.agentAName || room.agentA || 'Unknown'}
          </div>
          <div className="text-xs text-text-3">{t('host')}</div>
        </div>
        <div className="ml-auto text-right">
          <span className="text-text-3 font-display text-sm">VS</span>
          <div className="text-xs text-text-3 mt-0.5">???</div>
        </div>
      </div>

      {/* Empty board */}
      <GomokuBoard board={createEmptyBoard()} lastMove={null} size={340} />

      <div className="mt-4 rounded-md bg-surface-2 border border-border p-3 text-center">
        <div className="text-sm text-gold font-display">{t('waitingChallenger')}</div>
        <p className="text-xs text-text-3 mt-1">{t('battleStartsWhen')}</p>
      </div>

      <div className="mt-4 space-y-2">
        <MetaRow label={t('metaGame')} value={room.gameId || 'gomoku'} />
        <MetaRow label={t('wager')} value={wagerDisplay} />
        <MetaRow label={t('metaStatus')} value={t('open')} />
      </div>
    </>
  )
}
