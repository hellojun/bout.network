'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { AgentAvatar } from '@/components/BattleCard'
import { api } from '@/lib/api'

const BATTLES_PER_PAGE = 20

function computeWinRate(wins: number, losses: number): string {
  const total = wins + losses
  if (total === 0) return '0.0'
  return ((wins / total) * 100).toFixed(1)
}

function useTimeAgo() {
  const t = useTranslations('common.time')
  return function formatTimeAgo(dateString: string): string {
    const now = Date.now()
    const then = new Date(dateString).getTime()
    const diffMs = now - then

    const minutes = Math.floor(diffMs / 60_000)
    if (minutes < 1) return t('justNow')
    if (minutes < 60) return t('minutesAgo', { n: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('hoursAgo', { n: hours })

    const days = Math.floor(hours / 24)
    if (days < 30) return t('daysAgo', { n: days })

    return new Date(dateString).toLocaleDateString()
  }
}

function OnlineStatus({ lastSeenAt }: { lastSeenAt: string | null }) {
  const t = useTranslations('agent')

  if (!lastSeenAt) {
    return <span className="text-xs text-text-3">{t('offline')}</span>
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime()
  const minutesAgo = Math.floor(diffMs / 60_000)
  const isOnline = minutesAgo < 10

  if (isOnline) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-accent-2">
        <span className="h-2 w-2 rounded-full bg-accent-2 animate-pulse" />
        {minutesAgo < 1 ? t('activeNow') : t('activeAgo', { n: minutesAgo })}
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-3">
      <span className="h-2 w-2 rounded-full bg-text-3" />
      {t('offline')}
    </span>
  )
}

function BattleResultIcon({ result }: { result: 'win' | 'loss' | 'draw' | 'active' }) {
  const t = useTranslations('agent')
  if (result === 'win') {
    return <span className="text-accent-2 text-sm font-bold">{t('resultWin')}</span>
  }
  if (result === 'loss') {
    return <span className="text-danger text-sm font-bold">{t('resultLoss')}</span>
  }
  if (result === 'draw') {
    return <span className="text-text-3 text-sm font-bold">{t('resultDraw')}</span>
  }
  return (
    <span className="flex items-center gap-1 text-xs text-gold">
      <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse" />
      {t('resultLive')}
    </span>
  )
}

function getBattleResult(
  battle: any,
  agentId: string,
): 'win' | 'loss' | 'draw' | 'active' {
  if (battle.status === 'active') return 'active'
  if (!battle.winnerId) return 'draw'
  if (battle.winnerId === agentId) return 'win'
  return 'loss'
}

function getBorderColor(result: 'win' | 'loss' | 'draw' | 'active'): string {
  if (result === 'win') return 'border-l-accent-2'
  if (result === 'loss') return 'border-l-danger'
  if (result === 'active') return 'border-l-gold'
  return 'border-l-text-3'
}

function getOpponentName(battle: any, agentId: string): string {
  if (battle.agentA === agentId) return battle.agentB
  return battle.agentA
}

function BattleHistoryRow({
  battle,
  agentId,
}: {
  battle: any
  agentId: string
}) {
  const t = useTranslations('agent')
  const timeAgo = useTimeAgo()
  const result = getBattleResult(battle, agentId)
  const borderColor = getBorderColor(result)
  const opponent = getOpponentName(battle, agentId)
  const wagerUsdc = Number(battle.wager) / 1000

  return (
    <Link href={`/battle/${battle.id}`}>
      <div
        className={`flex items-center gap-4 rounded-lg border border-border ${borderColor} border-l-[3px] bg-surface px-4 py-3 hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer`}
      >
        {/* Result icon */}
        <div className="w-8 shrink-0 text-center">
          <BattleResultIcon result={result} />
        </div>

        {/* Game type */}
        <div className="w-20 shrink-0">
          <span className="text-xs text-text-2 font-mono">{battle.gameId}</span>
        </div>

        {/* Opponent */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs text-text-3">{t('vs')}</span>
          <AgentAvatar name={opponent} size={22} />
          <span className="text-sm font-display truncate">{opponent}</span>
        </div>

        {/* ELO change */}
        <div className="w-16 shrink-0 text-right">
          <span className="text-xs text-text-3">--</span>
        </div>

        {/* P&L */}
        <div className="w-20 shrink-0 text-right">
          {result === 'active' ? (
            <span className="text-xs text-text-3">{wagerUsdc} USDC</span>
          ) : result === 'win' ? (
            <span className="text-xs text-accent-2">+{wagerUsdc} USDC</span>
          ) : result === 'loss' ? (
            <span className="text-xs text-danger">-{wagerUsdc} USDC</span>
          ) : (
            <span className="text-xs text-text-3">0 USDC</span>
          )}
        </div>

        {/* Time ago */}
        <div className="w-16 shrink-0 text-right">
          <span className="text-xs text-text-3">{timeAgo(battle.startedAt)}</span>
        </div>

        {/* View Replay */}
        <div className="w-20 shrink-0 text-right">
          <span className="text-xs text-accent hover:underline">{t('viewReplay')}</span>
        </div>
      </div>
    </Link>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-1 text-xs text-text-2">{label}</div>
      <div className="font-display text-xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-text-3">{sub}</div>}
    </div>
  )
}

export default function AgentPage({ params }: { params: { id: string } }) {
  const t = useTranslations('agent')
  const tc = useTranslations('common')
  const { data: agent } = useSWR(`/agent/${params.id}`, () =>
    api.getAgent(params.id),
  )
  const { data: battlesData } = useSWR(`/agent/${params.id}/battles`, () =>
    api.getAgentBattles(params.id),
  )
  const [visibleCount, setVisibleCount] = useState(BATTLES_PER_PAGE)

  if (!agent) {
    return (
      <div className="flex justify-center py-20 text-text-3">{tc('loading')}</div>
    )
  }
  if (agent.error) {
    return (
      <div className="flex justify-center py-20 text-danger">{agent.error}</div>
    )
  }

  const battles = battlesData?.battles || []
  const visibleBattles = battles.slice(0, visibleCount)
  const hasMore = visibleCount < battles.length
  const winRate = computeWinRate(agent.wins, agent.losses)
  const totalGames = agent.wins + agent.losses + (agent.draws ?? 0)

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <AgentAvatar name={agent.name} size={64} />
        <div>
          <h1 className="font-display text-2xl font-bold">{agent.name}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-text-2">
            {agent.framework && <span>{agent.framework}</span>}
            <span>
              {t('joined', { date: new Date(agent.createdAt).toLocaleDateString() })}
            </span>
          </div>
          <div className="mt-1">
            <OnlineStatus lastSeenAt={agent.lastSeenAt ?? null} />
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="font-display text-3xl font-bold">{agent.rating}</div>
          <div className="text-xs text-text-2">{t('eloRating')}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label={t('statWinRate')}
          value={`${winRate}%`}
          sub={t('record', { wins: agent.wins, losses: agent.losses, draws: agent.draws ?? 0 })}
        />
        <StatCard label={t('statPnl')} value="--" sub="USDC" />
        <StatCard label={t('statStreak')} value="--" />
        <StatCard
          label={t('statGames')}
          value={String(totalGames)}
          sub={totalGames === 0 ? t('noGamesPlayed') : undefined}
        />
      </div>

      {/* Battle History Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold">
          {t('battleHistory', { count: battles.length })}
        </h2>
        {battles.length > 0 && (
          <div className="hidden items-center gap-6 text-xs text-text-3 md:flex">
            <span className="w-8 text-center">{t('colWL')}</span>
            <span className="w-20">{t('colGame')}</span>
            <span className="flex-1">{t('colOpponent')}</span>
            <span className="w-16 text-right">{t('colElo')}</span>
            <span className="w-20 text-right">{t('colPnl')}</span>
            <span className="w-16 text-right">{t('colTime')}</span>
            <span className="w-20 text-right">{t('colReplay')}</span>
          </div>
        )}
      </div>

      {/* Battle History List */}
      <div className="space-y-2">
        {battles.length === 0 ? (
          <div className="py-8 text-center text-text-3">{t('noBattles')}</div>
        ) : (
          <>
            {visibleBattles.map((battle: any) => (
              <BattleHistoryRow
                key={battle.id}
                battle={battle}
                agentId={params.id}
              />
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((prev) => prev + BATTLES_PER_PAGE)}
                className="mt-4 w-full rounded-lg border border-border bg-surface py-3 text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
              >
                {t('loadMore')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
