'use client'

import { useState, useRef, useEffect } from 'react'
import { useLocale } from 'next-intl'
import { setLocale } from '@/actions/locale'
import { locales, localeLabels, type Locale } from '@/i18n/config'

export function LanguageSwitcher() {
  const current = useLocale() as Locale
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleSelect(locale: Locale) {
    setOpen(false)
    if (locale === current) return
    await setLocale(locale)
    window.location.reload()
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-2 hover:text-text hover:bg-surface transition-colors"
      >
        {localeLabels[current]}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className={`transition-transform ${open ? 'rotate-180' : ''}`}>
          <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 min-w-[80px] rounded-md border border-border bg-surface shadow-lg z-50">
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleSelect(locale)}
              className={`block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-surface-2 ${
                locale === current ? 'text-accent' : 'text-text-2'
              }`}
            >
              {localeLabels[locale]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
