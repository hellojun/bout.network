'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BuildPage() {
  const t = useTranslations('build')
  const [showModal, setShowModal] = useState(false)

  const SUBMISSION_STEPS = [
    { step: '1', title: t('step1Title'), desc: t('step1Desc'), code: 'npm install @boutnetwork/game-sdk' },
    { step: '2', title: t('step2Title'), desc: t('step2Desc'), code: null },
    { step: '3', title: t('step3Title'), desc: t('step3Desc'), code: null },
  ]

  const REVIEW_STANDARDS = [
    { label: t('reviewDeterministic'), detail: t('reviewDeterministicDesc') },
    { label: t('reviewBounded'), detail: t('reviewBoundedDesc') },
    { label: t('reviewFair'), detail: t('reviewFairDesc') },
    { label: t('reviewIsolated'), detail: t('reviewIsolatedDesc') },
  ]

  const IGAME_METHODS = [
    { name: 'initialState()', desc: t('igameMethods.initialState') },
    { name: 'applyAction(state, action)', desc: t('igameMethods.applyAction') },
    { name: 'isTerminal(state)', desc: t('igameMethods.isTerminal') },
    { name: 'settle(state)', desc: t('igameMethods.settle') },
  ]

  const FAQ_ITEMS = [
    { q: t('faqReviewTime'), a: t('faqReviewTimeA') },
    { q: t('faqEarnings'), a: t('faqEarningsA') },
    { q: t('faqLanguages'), a: t('faqLanguagesA') },
    { q: t('faqMultiple'), a: t('faqMultipleA') },
  ]

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      {/* Hero */}
      <section className="text-center mb-16">
        <p className="text-xs font-display tracking-widest text-text-3 uppercase mb-4">
          {t('eyebrow')}
        </p>
        <h1 className="font-display text-5xl md:text-6xl font-bold tracking-tight mb-4">
          {t('title')}
        </h1>
        <p className="text-lg text-text-2 max-w-2xl mx-auto mb-2">
          {t('desc', { percent: '30%' })}
        </p>
        <p className="text-sm text-text-3 mb-8">
          {t('noApplication')}
        </p>

        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/docs"
            className="bg-accent hover:bg-accent/90 text-white font-display font-bold px-6 py-3 rounded-lg transition-colors"
          >
            {t('viewDocs')}
          </Link>
          <button
            onClick={() => navigator.clipboard.writeText('npm install @boutnetwork/game-sdk')}
            className="border border-border text-text font-mono text-sm px-6 py-3 rounded-lg hover:bg-surface transition-colors"
          >
            npm install @boutnetwork/game-sdk
          </button>
        </div>
      </section>

      {/* Main grid */}
      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left: Submission Flow */}
        <div className="lg:col-span-3">
          <h2 className="font-display text-xl font-bold mb-6">{t('submissionProcess')}</h2>
          <div className="space-y-6">
            {SUBMISSION_STEPS.map(({ step, title, desc, code }) => (
              <div key={step} className="flex gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center font-display font-bold text-accent text-sm">
                    {step}
                  </div>
                  {step !== '3' && <div className="w-px flex-1 bg-border mt-2" />}
                </div>
                <div className="pb-6">
                  <h3 className="font-display font-bold mb-1">{title}</h3>
                  <p className="text-sm text-text-2 mb-2">{desc}</p>
                  {code && (
                    <code className="text-xs font-mono bg-surface px-3 py-1.5 rounded border border-border text-text-2">
                      {code}
                    </code>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="mt-8 bg-accent text-white font-display font-bold px-6 py-3 rounded-lg hover:bg-accent/90 transition-colors"
          >
            {t('submitGame')} &rarr;
          </button>
        </div>

        {/* Right: Live Games + Top Builders */}
        <div className="lg:col-span-2 space-y-6">
          <LiveGamesCard />

          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-display font-bold text-sm mb-4">{t('topBuilders')}</h3>
            <div className="text-xs text-text-3">
              {t('beFirstBuilder')}
            </div>
          </div>
        </div>
      </div>

      {/* Accordion sections */}
      <section className="mt-20 space-y-4">
        <AccordionSection title={t('reviewStandards')}>
          <ul className="space-y-3">
            {REVIEW_STANDARDS.map(({ label, detail }) => (
              <li key={label} className="flex gap-3 text-sm">
                <span className="text-accent font-display font-bold shrink-0">{label}</span>
                <span className="text-text-2">{detail}</span>
              </li>
            ))}
          </ul>
        </AccordionSection>

        <AccordionSection title={t('techSpecs')}>
          <div className="space-y-4">
            <p className="text-sm text-text-2">
              {t('techSpecsIntro')}
            </p>
            <div className="bg-bg border border-border rounded-lg p-4 space-y-2">
              {IGAME_METHODS.map(({ name, desc }) => (
                <div key={name} className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <code className="font-mono text-xs text-accent-2 shrink-0">{name}</code>
                  <span className="text-xs text-text-3">{desc}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-text-3 mb-1">{t('installSdk')}</p>
              <code className="text-xs font-mono bg-surface px-3 py-1.5 rounded border border-border text-text-2">
                npm install @boutnetwork/game-sdk
              </code>
            </div>
            <Link href="/docs" className="text-xs text-accent hover:underline inline-block mt-1">
              {t('fullDocs')} &rarr;
            </Link>
          </div>
        </AccordionSection>

        <AccordionSection title={t('faq')}>
          <dl className="space-y-4">
            {FAQ_ITEMS.map(({ q, a }) => (
              <div key={q}>
                <dt className="text-sm font-display font-bold mb-1">{q}</dt>
                <dd className="text-sm text-text-2">{a}</dd>
              </div>
            ))}
          </dl>
        </AccordionSection>
      </section>

      {/* Modal */}
      {showModal && <SubmitGameModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live Games Card
// ---------------------------------------------------------------------------

const GOMOKU_STATS = {
  name: 'Gomoku',
  battles: 847,
  maxBattles: 1000,
  github: 'https://github.com/hellojun/bout-game-gomoku',
}

function LiveGamesCard() {
  const t = useTranslations('build')
  const progress = Math.round((GOMOKU_STATS.battles / GOMOKU_STATS.maxBattles) * 100)

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <h3 className="font-display font-bold text-sm mb-4">{t('liveGames')}</h3>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm">
            {GOMOKU_STATS.name}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={GOMOKU_STATS.github}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              GitHub
            </a>
            <span className="text-xs text-text-3">{t('builtIn')}</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-xs text-text-3 mb-1">
            <span>{t('battles', { count: GOMOKU_STATS.battles })}</span>
            <span>{t('max', { count: GOMOKU_STATS.maxBattles })}</span>
          </div>
          <div className="h-1.5 rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full bg-accent-2 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-text-3">{t('moreGamesSoon')}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accordion
// ---------------------------------------------------------------------------

type AccordionSectionProps = {
  title: string
  children: React.ReactNode
}

function AccordionSection({ title, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface transition-colors"
      >
        <span className="font-display font-bold">{title}</span>
        <span
          className={`text-text-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
        >
          &#9656;
        </span>
      </button>
      {open && <div className="px-5 pb-5 pt-1">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Submit Game Modal
// ---------------------------------------------------------------------------

type SubmitGameModalProps = {
  onClose: () => void
}

type FormErrors = {
  gameName?: string
  email?: string
  repoUrl?: string
}

function SubmitGameModal({ onClose }: SubmitGameModalProps) {
  const t = useTranslations('build')
  const [gameName, setGameName] = useState('')
  const [email, setEmail] = useState('')
  const [repoUrl, setRepoUrl] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function validate(): FormErrors {
    const next: FormErrors = {}
    if (!gameName.trim()) next.gameName = t('validation.gameNameRequired')
    if (!email.trim()) {
      next.email = t('validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t('validation.emailInvalid')
    }
    if (!repoUrl.trim()) {
      next.repoUrl = t('validation.repoRequired')
    } else if (!/^https?:\/\/.+/.test(repoUrl)) {
      next.repoUrl = t('validation.repoInvalid')
    }
    return next
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    setErrors({})
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4 text-center">
          <div className="text-accent-2 text-4xl mb-4">&#10003;</div>
          <h3 className="font-display text-lg font-bold mb-2">{t('modal.successTitle')}</h3>
          <p className="text-sm text-text-2 mb-6">
            {t('modal.successDesc', { name: gameName })}
          </p>
          <button
            onClick={onClose}
            className="bg-accent text-white px-5 py-2 rounded text-sm font-display hover:bg-accent/90 transition-colors"
          >
            {t('modal.close')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="font-display text-lg font-bold mb-4">{t('modal.title')}</h3>
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <FormField
            label={t('modal.gameName')}
            value={gameName}
            onChange={setGameName}
            placeholder={t('modal.gameNamePlaceholder')}
            error={errors.gameName}
          />
          <FormField
            label={t('modal.email')}
            type="email"
            value={email}
            onChange={setEmail}
            placeholder={t('modal.emailPlaceholder')}
            error={errors.email}
          />
          <FormField
            label={t('modal.repoUrl')}
            type="url"
            value={repoUrl}
            onChange={setRepoUrl}
            placeholder={t('modal.repoUrlPlaceholder')}
            error={errors.repoUrl}
          />

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-text-2 hover:text-text transition-colors"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              className="bg-accent text-white px-4 py-2 rounded text-sm font-display hover:bg-accent/90 transition-colors"
            >
              {t('modal.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Form Field
// ---------------------------------------------------------------------------

type FormFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  error?: string
}

function FormField({ label, value, onChange, placeholder, type = 'text', error }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs text-text-2 mb-1 font-display">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-bg border rounded px-3 py-2 text-sm text-text placeholder:text-text-3 ${
          error ? 'border-danger' : 'border-border'
        }`}
      />
      {error && <p className="text-xs text-danger mt-1">{error}</p>}
    </div>
  )
}
