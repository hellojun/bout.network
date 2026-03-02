import Link from 'next/link'
import { useTranslations } from 'next-intl'

type Battle = {
  id: string
  gameId: string
  agentA: string
  agentB: string
  agentAName?: string
  agentBName?: string
  status: string
  winnerId?: string | null
  wager: string | bigint
  startedAt: string
  replayData?: any[]
}

const AVATAR_COLORS = ['#7B61FF', '#37D56D', '#FA825D', '#FFD700', '#4A9EFF', '#E44AFF']

function AgentAvatar({ name, size = 32 }: { name: string; size?: number }) {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const bg = AVATAR_COLORS[hash % AVATAR_COLORS.length]
  const letter = name.charAt(0).toUpperCase()

  return (
    <div
      className="flex items-center justify-center rounded-full font-display font-bold text-white shrink-0"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: size * 0.4 }}
    >
      {letter}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations('common.battleCard')
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-[rgba(250,130,93,0.12)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-orange">
        <span className="w-1.5 h-1.5 rounded-full bg-orange animate-pulse" />
        {t('live')}
      </span>
    )
  }
  if (status === 'finished') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-[rgba(55,213,109,0.12)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent-2">
        {t('finished')}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-[rgba(255,215,0,0.12)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-gold">
      {t('waiting')}
    </span>
  )
}

function AgentName({ name, isWinner }: { name: string; isWinner: boolean }) {
  return (
    <span className={`text-[13px] font-semibold truncate ${isWinner ? 'text-accent-2' : 'text-text'}`}>
      {name}
    </span>
  )
}

function useTimeAgo() {
  const t = useTranslations('common.time')
  return function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return t('justNow')
    if (mins < 60) return t('minutesAgo', { n: mins })
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return t('hoursAgo', { n: hrs })
    return t('daysAgo', { n: Math.floor(hrs / 24) })
  }
}

export function BattleCard({ battle, disableLink }: { battle: Battle; disableLink?: boolean }) {
  const t = useTranslations('common.battleCard')
  const timeAgo = useTimeAgo()

  const nameA = battle.agentAName || battle.agentA
  const nameB = battle.agentBName || battle.agentB
  const rounds = battle.replayData?.length

  const card = (
    <div className="rounded-md bg-surface-2 border border-border p-5 hover:border-[rgba(123,97,255,0.3)] hover:-translate-y-0.5 hover:shadow-lg transition-all cursor-pointer">
      {/* Meta row */}
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={battle.status} />
        <span className="text-xs text-text-3 capitalize">{battle.gameId}</span>
      </div>

      {/* Players row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentAvatar name={nameA} size={32} />
          <AgentName name={nameA} isWinner={battle.winnerId === battle.agentA} />
        </div>
        <span className="text-xs text-text-3 font-display px-3 shrink-0">{t('vs')}</span>
        <div className="flex items-center gap-2.5 min-w-0">
          <AgentName name={nameB} isWinner={battle.winnerId === battle.agentB} />
          <AgentAvatar name={nameB} size={32} />
        </div>
      </div>

      {/* Footer row */}
      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-text-3">
        <span>{t('usdcEach', { amount: Number(battle.wager) / 1000 })}</span>
        <div className="flex items-center gap-2">
          {rounds !== undefined && <span>{t('rounds', { count: rounds })}</span>}
          <span>{timeAgo(battle.startedAt)}</span>
        </div>
      </div>
    </div>
  )

  if (disableLink) return card
  return <Link href={`/battle/${battle.id}`}>{card}</Link>
}

export { AgentAvatar }
