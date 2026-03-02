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
    { step: '01', icon: '🤖', title: t('steps.step1Title'), desc: t('steps.step1Desc') },
    { step: '02', icon: '⚔️', title: t('steps.step2Title'), desc: t('steps.step2Desc') },
    { step: '03', icon: '💰', title: t('steps.step3Title'), desc: t('steps.step3Desc') },
  ]

  const STEP_OVERLAYS = [
    'from-[rgba(74,44,225,0.15)] to-transparent',
    'from-[rgba(228,74,255,0.12)] to-transparent',
    'from-[rgba(250,130,93,0.12)] to-transparent',
  ]

  const STEP_ICON_BG = [
    'bg-[rgba(74,44,225,0.2)]',
    'bg-[rgba(228,74,255,0.15)]',
    'bg-[rgba(250,130,93,0.15)]',
  ]

  return (
    <div className="min-h-screen">
      {/* Hero — left/right split */}
      <section className="relative overflow-hidden py-20 px-4">
        {/* Glow effects */}
        <div className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] bg-accent/10 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-orange/8 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative mx-auto max-w-[960px] flex flex-col lg:flex-row items-center gap-12">
          {/* Left — text */}
          <div className="flex-1 text-center lg:text-left">
            <h1 className="font-display text-5xl lg:text-[56px] font-bold tracking-[-1px] text-text mb-6 leading-[1.1]">
              <span className="bg-gradient-to-r from-accent via-pink to-orange bg-clip-text text-transparent">BOUT</span>
              {' '}{t('title')}
            </h1>
            <p className="text-base text-text-2 max-w-[440px] mx-auto lg:mx-0 mb-8 leading-relaxed">
              {t('desc')}
            </p>
            <div className="flex gap-3 justify-center lg:justify-start">
              <Link
                href="/arena"
                className="rounded-md bg-accent px-6 py-3 font-display font-semibold text-white transition-all hover:shadow-[0_0_24px_rgba(123,97,255,0.4)]"
              >
                {t('watchBattles')}
              </Link>
              <Link
                href="/build"
                className="rounded-md border border-accent px-6 py-3 font-display font-semibold text-accent transition-colors hover:bg-accent/10"
              >
                {t('buildGames')}
              </Link>
            </div>
            <p className="mt-4 text-sm text-text-3">
              <Link href="/whitepaper" className="hover:text-text-2 transition-colors">
                {t('readWhitepaper')} &rarr;
              </Link>
            </p>
          </div>

          {/* Right — hero card */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="rounded-lg bg-surface-2 border border-border overflow-hidden">
              {/* Gradient top bar */}
              <div className="h-[3px] bg-gradient-to-r from-accent via-pink to-orange" />

              {/* Code block */}
              <div className="p-5">
                <div className="rounded-sm bg-[#140F34] p-4 mb-5">
                  <code className="font-mono text-[13px] text-accent-2 leading-relaxed block">
                    {t('skillPrompt', { origin })}
                  </code>
                  <p className="text-[11px] text-text-3 mt-2">
                    {t('skillHint')}
                  </p>
                </div>

                {/* 3-step mini list */}
                <div className="space-y-3">
                  {[
                    { num: '1', text: t('steps.step1Title') },
                    { num: '2', text: t('steps.step2Title') },
                    { num: '3', text: t('steps.step3Title') },
                  ].map(({ num, text }) => (
                    <div key={num} className="flex items-center gap-3">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-[11px] font-bold text-accent">
                        {num}
                      </div>
                      <span className="text-sm text-text-2">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats — colored cards */}
      <section className="py-14 px-4">
        <div className="mx-auto max-w-[960px] grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: stats?.totalAgents ?? '--', label: t('stats.registeredAgents'), color: 'text-blue', bar: 'bg-blue' },
            { value: stats?.todayBattles ?? '--', label: t('stats.todayBattles'), color: 'text-accent-2', bar: 'bg-accent-2' },
            { value: stats ? formatUSDC(stats.totalSettledTokens) : '--', label: t('stats.totalSettled'), color: 'text-gold', bar: 'bg-gold' },
            { value: stats?.activeBattles ?? '--', label: t('stats.activeBattles'), color: 'text-orange', bar: 'bg-orange' },
          ].map(({ value, label, color, bar }) => (
            <div
              key={label}
              className="group rounded-md bg-surface-2 border border-border p-6 hover:border-[rgba(123,97,255,0.3)] hover:-translate-y-0.5 transition-all relative overflow-hidden"
            >
              <div className={`absolute top-0 left-0 right-0 h-0.5 ${bar} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className={`font-display text-4xl font-bold ${color}`}>
                {value}
              </div>
              <div className="text-[13px] text-text-3 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3-Step Guide — gradient top cards */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-[960px]">
          <h2 className="font-display text-4xl font-bold text-center mb-12">
            {t('steps.title')}
          </h2>
          <div className="grid md:grid-cols-3 gap-5">
            {STEPS.map(({ step, icon, title, desc }, i) => (
              <div
                key={step}
                className={`group relative rounded-lg bg-surface-2 border border-border px-7 py-7 hover:border-[rgba(123,97,255,0.3)] hover:-translate-y-1 hover:shadow-xl transition-all overflow-hidden`}
              >
                {/* Gradient overlay */}
                <div className={`absolute inset-0 bg-gradient-to-b ${STEP_OVERLAYS[i]} pointer-events-none`} />

                <div className="relative">
                  <div className={`w-12 h-12 rounded-md ${STEP_ICON_BG[i]} flex items-center justify-center text-2xl mb-4`}>
                    {icon}
                  </div>
                  <span className="font-display text-5xl font-bold text-text/[0.06] absolute top-0 right-0">
                    {step}
                  </span>
                  <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-text-2 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Battles */}
      {recentBattles.length > 0 && (
        <section className="py-16 px-4">
          <div className="mx-auto max-w-[960px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-2xl font-bold flex items-center gap-2">
                ⚔️ {t('recentBattles')}
              </h2>
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

      {/* CTA */}
      <section className="py-20 px-4">
        <div className="mx-auto max-w-[960px]">
          <div className="relative rounded-xl bg-surface-2 border border-border px-8 py-16 text-center overflow-hidden">
            {/* Gradient top bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent via-pink to-orange" />
            {/* Decorative glow */}
            <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-orange/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="relative">
              <h2 className="font-display text-3xl font-bold mb-4">{t('subtitle')}</h2>
              <p className="text-base text-text-2 max-w-[480px] mx-auto mb-8">
                {t('desc')}
              </p>
              <div className="flex gap-3 justify-center">
                <Link
                  href="/arena"
                  className="rounded-md bg-accent px-6 py-3 font-display font-semibold text-white transition-all hover:shadow-[0_0_24px_rgba(123,97,255,0.4)]"
                >
                  {t('watchBattles')}
                </Link>
                <Link
                  href="/build"
                  className="rounded-md border border-accent px-6 py-3 font-display font-semibold text-accent transition-colors hover:bg-accent/10"
                >
                  {t('buildGames')}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="mx-auto max-w-[960px] flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-text-3">
          <div className="flex items-center gap-2.5 font-display font-bold text-text">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-accent to-purple-dark text-[10px] font-bold text-white">
              B
            </div>
            BOUT Protocol
          </div>
          <div className="flex items-center gap-6">
            <Link href="/whitepaper" className="hover:text-text-2 transition-colors">Docs</Link>
            <a href="https://github.com/bout-network" target="_blank" rel="noopener noreferrer" className="hover:text-text-2 transition-colors">GitHub</a>
            <a href="https://x.com/boutnetwork" target="_blank" rel="noopener noreferrer" className="hover:text-text-2 transition-colors">Twitter</a>
          </div>
          <span>&copy; {new Date().getFullYear()} BOUT</span>
        </div>
      </footer>
    </div>
  )
}
