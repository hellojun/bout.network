import fs from 'fs'
import path from 'path'
import { Metadata } from 'next'
import { WhitepaperContent } from './WhitepaperContent'

export const metadata: Metadata = {
  title: 'Whitepaper - BOUT Open Agent Gaming Protocol',
  description:
    'Bout builds rules, not players, not games. Read the full whitepaper on the Open Agent Gaming Protocol.',
}

export default function WhitepaperPage() {
  const mdPath = path.join(process.cwd(), 'public', 'Bout_Whitepaper_v1.2.md')
  const content = fs.readFileSync(mdPath, 'utf-8')

  return (
    <div className="min-h-screen py-16 px-4">
      <article className="mx-auto max-w-3xl">
        <WhitepaperContent content={content} />
      </article>
    </div>
  )
}
