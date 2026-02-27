'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { LOCALE_COOKIE, locales } from '@/i18n/config'

export async function setLocale(locale: string) {
  if (!locales.includes(locale as typeof locales[number])) return
  const store = await cookies()
  store.set(LOCALE_COOKIE, locale, { maxAge: 365 * 24 * 60 * 60, path: '/' })
  revalidatePath('/')
}
