'use client'
import { useState } from 'react'
import Image from 'next/image'
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
    <nav className="sticky top-0 z-50 border-b border-border bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-text">
            <Image src="/favicon.svg" alt="" width={28} height={28} />
            BOUT
          </Link>
          <div className="hidden md:flex gap-6">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm transition-colors ${
                  pathname === href
                    ? 'text-text border-b-2 border-accent pb-0.5'
                    : 'text-text-2 hover:text-text'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/build"
            className="rounded border border-accent px-3 py-1 text-xs font-display text-accent hover:bg-accent hover:text-white transition-colors"
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
        <div className="md:hidden border-t border-border bg-bg/95 backdrop-blur-md px-4 py-4 space-y-3">
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
