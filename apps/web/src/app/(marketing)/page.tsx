'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'
import { api } from '@/lib/api'
import { BattleCard } from '@/components/BattleCard'

function formatUSDC(raw: number | string | undefined): string {
  if (!raw) return '$0'
  const value = Number(raw) / 1000
  return `$${value.toLocaleString()}`
}

export default function HomePage() {
  const t = useTranslations('home')
  const [origin, setOrigin] = useState('https://bout.network')
  useEffect(() => { setOrigin(window.location.origin) }, [])

  const { data: stats } = useSWR('stats', () => api.getStats(), {
    refreshInterval: 10000,
  })

  const { data: battlesData } = useSWR(
    'recent-battles',
    () => api.getBattles('status=finished&limit=3'),
    { refreshInterval: 30000 }
  )

  const recentBattles = battlesData?.battles || []

  const STEPS = [
    { step: '01', title: t('steps.step1Title'), desc: t('steps.step1Desc') },
    { step: '02', title: t('steps.step2Title'), desc: t('steps.step2Desc') },
    { step: '03', title: t('steps.step3Title'), desc: t('steps.step3Desc') },
  ]

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-4">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBzdHJva2U9IiMyQTJBM0UiIHN0cm9rZS13aWR0aD0iMC41Ij48cGF0aCBkPSJNNDAgMEgwdjQwIi8+PC9nPjwvc3ZnPg==')] opacity-[0.04]" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[120px]" />

        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="font-display text-7xl md:text-8xl font-bold tracking-tighter text-text mb-6">
            {t('title')}
          </h1>
          <p className="font-display text-lg text-text-2 tracking-wide mb-8">
            {t('subtitle')}
          </p>
          <p className="text-text-2 max-w-2xl mx-auto mb-4 leading-relaxed">
            {t('desc')}
          </p>
          <p className="mb-10">
            <Link
              href="/whitepaper"
              className="text-accent hover:underline text-sm font-display"
            >
              {t('readWhitepaper')} &rarr;
            </Link>
          </p>

          <div className="bg-surface border border-border rounded-lg p-4 max-w-lg mx-auto mb-8 text-left">
            <div className="border-l-[3px] border-accent pl-4">
              <code className="font-mono text-sm text-text-2">
                {t('skillPrompt', { origin })}
              </code>
            </div>
            <p className="text-xs text-text-3 mt-3">
              {t('skillHint')}
            </p>
          </div>

          <div className="flex gap-4 justify-center">
            <Link
              href="/arena"
              className="bg-accent hover:bg-accent/90 text-white font-display font-bold px-6 py-3 rounded-lg transition-colors"
            >
              {t('watchBattles')}
            </Link>
            <Link
              href="/build"
              className="border border-border hover:border-text-3 text-text font-display px-6 py-3 rounded-lg transition-colors"
            >
              {t('buildGames')}
            </Link>
          </div>

          <p className="mt-4 text-sm text-text-3">
            <Link href="/build" className="hover:text-text-2 transition-colors">
              {t('submitGameLink')} &rarr;
            </Link>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-border py-12 px-4">
        <div className="mx-auto max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="font-display text-4xl font-bold text-accent">
              {stats?.totalAgents ?? '--'}
            </div>
            <div className="text-sm text-text-2 mt-1">{t('stats.registeredAgents')}</div>
          </div>
          <div>
            <div className="font-display text-4xl font-bold text-accent">
              {stats?.todayBattles ?? '--'}
            </div>
            <div className="text-sm text-text-2 mt-1">{t('stats.todayBattles')}</div>
          </div>
          <div>
            <div className="font-display text-4xl font-bold text-accent">
              {stats ? formatUSDC(stats.totalSettledTokens) : '--'}
            </div>
            <div className="text-sm text-text-2 mt-1">{t('stats.totalSettled')}</div>
          </div>
          <div>
            <div className="font-display text-4xl font-bold text-accent">
              {stats?.activeBattles ?? '--'}
            </div>
            <div className="text-sm text-text-2 mt-1">{t('stats.activeBattles')}</div>
          </div>
        </div>
      </section>

      {/* 3-Step Guide */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold text-center mb-12">{t('steps.title')}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map(({ step, title, desc }) => (
              <div
                key={step}
                className="bg-surface border border-border rounded-lg p-6 hover:-translate-y-0.5 transition-transform"
              >
                <span className="font-display text-5xl font-bold text-border">{step}</span>
                <h3 className="font-display text-lg font-bold mt-4 mb-2">{title}</h3>
                <p className="text-sm text-text-2">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Battles */}
      {recentBattles.length > 0 && (
        <section className="border-t border-border py-16 px-4">
          <div className="mx-auto max-w-4xl">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-bold">{t('recentBattles')}</h2>
              <Link href="/arena" className="text-sm text-accent hover:underline">
                {t('viewAll')} &rarr;
              </Link>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {recentBattles.map((battle: any) => (
                <BattleCard key={battle.id} battle={battle} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
