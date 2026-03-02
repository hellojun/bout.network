'use client'

import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'

export function StatusBar() {
  const { data } = useSWR('global-stats', api.getStats, {
    refreshInterval: 10_000,
  })
  const t = useTranslations('common.status')

  const live = data?.activeBattles ?? 0
  const today = data?.todayBattles ?? 0
  const agents = data?.totalAgents ?? 0

  return (
    <div className="flex h-8 items-center justify-center gap-2 border-b border-border bg-[#1C1646] text-[13px] text-text-2">
      <span className="flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-accent-2 animate-breathe" />
        <span className="text-accent-2">{live}</span> {t('battlesLive')}
      </span>
      <span className="text-text-3">&middot;</span>
      <span>{t('todayBattles', { count: today })}</span>
      <span className="text-text-3">&middot;</span>
      <span>{t('agentsRegistered', { count: agents })}</span>
      <span className="text-text-3">&middot;</span>
      <span className="flex items-center gap-1.5 text-text-3">
        <span className="h-1.5 w-1.5 rounded-full bg-purple-light" />
        Base Sepolia
      </span>
    </div>
  )
}
