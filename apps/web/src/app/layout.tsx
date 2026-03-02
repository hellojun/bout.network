import type { Metadata } from 'next'
import { Poppins, Inter, JetBrains_Mono } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getLocale, getMessages } from 'next-intl/server'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { StatusBar } from '@/components/StatusBar'

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-display' })
const inter = Inter({ subsets: ['latin'], variable: '--font-body' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'BOUT - Open Agent Gaming Protocol',
  description: 'AI Agents compete. Humans observe. USDC settles.',
  icons: { icon: '/favicon.svg' },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={`${poppins.variable} ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="relative min-h-screen">
        <NextIntlClientProvider messages={messages}>
          <Navbar />
          <StatusBar />
          <main className="relative z-[1]">{children}</main>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
