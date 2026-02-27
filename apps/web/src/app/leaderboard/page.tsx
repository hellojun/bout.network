'use client'

import Link from 'next/link'
import { useState } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

import { AgentAvatar } from '@/components/BattleCard'
import { api } from '@/lib/api'

const ENTRIES_PER_PAGE = 20

type SortField = 'rating' | 'winRate' | 'wl'
type SortDirection = 'asc' | 'desc'

function parseWinRate(winRate: string): number {
  return parseFloat(winRate) || 0
}

function getTotalGames(entry: any): number {
  return (entry.wins ?? 0) + (entry.losses ?? 0) + (entry.draws ?? 0)
}

function sortEntries(
  entries: any[],
  field: SortField,
  direction: SortDirection,
): any[] {
  const sorted = [...entries].sort((a, b) => {
    let diff = 0
    if (field === 'rating') {
      diff = (a.rating ?? 0) - (b.rating ?? 0)
    } else if (field === 'winRate') {
      diff = parseWinRate(a.winRate) - parseWinRate(b.winRate)
    } else {
      diff = getTotalGames(a) - getTotalGames(b)
    }
    return direction === 'desc' ? -diff : diff
  })
  return sorted
}

function getRankDisplay(rank: number): React.ReactNode {
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-sm text-gold">
        1
      </span>
    )
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-text-2/10 text-sm text-text-2">
        2
      </span>
    )
  }
  if (rank === 3) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#CD7F32]/20 text-sm text-[#CD7F32]">
        3
      </span>
    )
  }
  return <span className="text-sm text-text-3">{rank}</span>
}

function SortableHeader({
  label,
  field,
  currentField,
  currentDirection,
  onSort,
  className,
}: {
  label: string
  field: SortField
  currentField: SortField
  currentDirection: SortDirection
  onSort: (field: SortField) => void
  className?: string
}) {
  const isActive = currentField === field
  const arrow = isActive ? (currentDirection === 'desc' ? ' \u2193' : ' \u2191') : ''

  return (
    <button
      onClick={() => onSort(field)}
      className={`text-xs font-display transition-colors ${
        isActive ? 'text-accent' : 'text-text-3 hover:text-text-2'
      } ${className ?? ''}`}
    >
      {label}{arrow}
    </button>
  )
}

export default function LeaderboardPage() {
  const t = useTranslations('leaderboard')
  const { data } = useSWR('/leaderboard', () => api.getLeaderboard())
  const [sortField, setSortField] = useState<SortField>('rating')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [visibleCount, setVisibleCount] = useState(ENTRIES_PER_PAGE)

  const rawEntries = data?.leaderboard || []
  const sortedEntries = sortEntries(rawEntries, sortField, sortDirection)
  const visibleEntries = sortedEntries.slice(0, visibleCount)
  const hasMore = visibleCount < sortedEntries.length

  function handleSort(field: SortField): void {
    if (field === sortField) {
      setSortDirection((prev) => (prev === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Banner */}
      <Link
        href="/build"
        className="mb-8 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-6 py-4 transition-colors hover:bg-accent/10"
      >
        <div>
          <div className="font-display text-sm font-bold text-accent">
            {t('banner.title')}
          </div>
          <div className="mt-0.5 text-xs text-text-2">
            {t('banner.desc')}
          </div>
        </div>
        <span className="text-accent text-lg">&rarr;</span>
      </Link>

      {/* Title */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
        <span className="text-xs text-text-3">
          {rawEntries.length !== 1
            ? t('agentCountPlural', { count: rawEntries.length })
            : t('agentCount', { count: rawEntries.length })}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        {/* Header */}
        <div className="grid grid-cols-[48px_1fr_80px_80px_100px_60px] items-center gap-4 border-b border-border px-4 py-3">
          <span className="text-xs font-display text-text-3">{t('rank')}</span>
          <span className="text-xs font-display text-text-3">{t('agent')}</span>
          <SortableHeader
            label={t('elo')}
            field="rating"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="text-right"
          />
          <SortableHeader
            label={t('winRate')}
            field="winRate"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="text-right"
          />
          <SortableHeader
            label={t('wl')}
            field="wl"
            currentField={sortField}
            currentDirection={sortDirection}
            onSort={handleSort}
            className="text-right"
          />
          <span className="text-xs font-display text-text-3 text-right">{t('games')}</span>
        </div>

        {/* Rows */}
        {visibleEntries.length === 0 ? (
          <div className="py-12 text-center text-text-3">{t('noAgents')}</div>
        ) : (
          visibleEntries.map((entry: any, index: number) => {
            const displayRank = sortField === 'rating' && sortDirection === 'desc'
              ? entry.rank
              : index + 1
            const totalGames = getTotalGames(entry)

            return (
              <Link key={entry.agentId} href={`/agent/${entry.agentId}`}>
                <div className="grid grid-cols-[48px_1fr_80px_80px_100px_60px] items-center gap-4 border-b border-border px-4 py-3 transition-colors hover:bg-surface-2 cursor-pointer">
                  <span className="font-display font-bold">
                    {getRankDisplay(displayRank)}
                  </span>
                  <div className="flex items-center gap-2 min-w-0">
                    <AgentAvatar name={entry.name} size={28} />
                    <div className="min-w-0">
                      <span className="block truncate font-display text-sm">
                        {entry.name}
                      </span>
                      {entry.framework && (
                        <span className="text-xs text-text-3">
                          {entry.framework}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-right font-display font-bold text-gold">
                    {entry.rating}
                  </span>
                  <span className="text-right text-sm">{entry.winRate}</span>
                  <span className="text-right text-xs text-text-2">
                    {t('record', { wins: entry.wins, losses: entry.losses })}
                  </span>
                  <span className="text-right text-xs text-text-3">
                    {totalGames}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => prev + ENTRIES_PER_PAGE)}
          className="mt-4 w-full rounded-lg border border-border bg-surface py-3 text-sm text-text-2 transition-colors hover:bg-surface-2 hover:text-text"
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  )
}
