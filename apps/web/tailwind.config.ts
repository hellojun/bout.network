import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        'surface-2': 'var(--color-surface-2)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-2': 'var(--color-accent-2)',
        danger: 'var(--color-danger)',
        gold: 'var(--color-gold)',
        text: 'var(--color-text)',
        'text-2': 'var(--color-text-2)',
        'text-3': 'var(--color-text-3)',
        orange: 'var(--color-orange)',
        blue: 'var(--color-blue)',
        pink: 'var(--color-pink)',
        'purple-light': 'var(--color-purple-light)',
        'purple-dark': 'var(--color-purple-dark)',
        'card-hover': 'var(--color-card-hover)',
        elevated: 'var(--color-elevated)',
      },
      fontFamily: {
        display: ['"Poppins"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"SF Mono"', '"Fira Code"', '"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '24px',
        xl: '32px',
        pill: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
export default config
