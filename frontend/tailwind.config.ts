/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page:       'var(--color-page)',
        container:  'var(--color-container)',
        card:       'var(--color-card)',
        border:     'var(--color-border)',
        accent:     'var(--color-accent)',
        'accent-fg': 'var(--color-accent-text)',
        tx:         'var(--color-text)',
        'tx-2':     'var(--color-text-secondary)',
        'tx-muted': 'var(--color-text-muted)',
        success:    '#4ADE80',
        warning:    '#F5B83D',
        danger:     '#F0524F',
        info:       '#60A5FA',
      },
      fontFamily: {
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        card:    '16px',
        control: '10px',
        pill:    '999px',
      },
      borderColor: {
        DEFAULT: 'var(--color-border)',
      },
    },
  },
  plugins: [],
}
