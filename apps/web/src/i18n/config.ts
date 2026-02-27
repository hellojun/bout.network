export const locales = ['en', 'zh', 'ja'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'en'
export const LOCALE_COOKIE = 'BOUT_LOCALE'
export const localeLabels: Record<Locale, string> = {
  en: 'EN',
  zh: '中文',
  ja: '日本語',
}
