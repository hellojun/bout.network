'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Navbar() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useTranslations('common.nav')

  const NAV_LINKS = [
    { href: '/arena', label: t('arena') },
    { href: '/leaderboard', label: t('leaderboard') },
  ]

  return (
    <nav className="sticky top-0 z-50 bg-bg/60 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[960px] items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-text">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-purple-dark font-display text-sm font-bold text-white">
            B
          </div>
          BOUT
        </Link>

        {/* Desktop pill nav */}
        <div className="hidden md:flex items-center rounded-pill bg-surface-2 p-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                pathname === href
                  ? 'bg-elevated text-text'
                  : 'text-text-2 hover:bg-elevated hover:text-text'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA + lang */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/build"
            className="rounded-pill bg-accent px-5 py-1.5 text-sm font-display font-semibold text-white transition-all hover:shadow-[0_0_20px_rgba(123,97,255,0.4)]"
          >
            {t('buildGames')}
          </Link>
          <LanguageSwitcher />
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-text-2 hover:text-text"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M3 12h18M3 6h18M3 18h18" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-surface/95 backdrop-blur-xl px-4 py-4 space-y-3 border-t border-border">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={`block text-sm py-2 ${
                pathname === href ? 'text-accent' : 'text-text-2'
              }`}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/build"
            onClick={() => setMenuOpen(false)}
            className="block text-sm py-2 text-accent"
          >
            {t('buildGames')}
          </Link>
          <div className="pt-2">
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </nav>
  )
}
