import fs from 'fs'
import path from 'path'
import { Metadata } from 'next'
import { WhitepaperContent } from '../(marketing)/whitepaper/WhitepaperContent'

export const metadata: Metadata = {
  title: 'Game Builder Technical Spec - BOUT',
  description:
    'Technical specification for building games on the Bout protocol. Covers game submission, deployment, judge adjudication, and ERC-8004 scoring.',
}

export default function DocsPage() {
  const mdPath = path.join(
    process.cwd(),
    'public',
    'Bout_Game_Builder_Technical_Spec_v1.0.md',
  )
  const content = fs.readFileSync(mdPath, 'utf-8')

  return (
    <div className="min-h-screen py-16 px-4">
      <article className="mx-auto max-w-3xl">
        <WhitepaperContent content={content} />
      </article>
    </div>
  )
}
