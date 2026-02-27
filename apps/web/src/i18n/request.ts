import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

import { defaultLocale, LOCALE_COOKIE } from './config'

export default getRequestConfig(async () => {
  const store = await cookies()
  const locale = store.get(LOCALE_COOKIE)?.value || defaultLocale

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  }
})
