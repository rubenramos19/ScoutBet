import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ScoutBet design system — from spec
        surface: {
          DEFAULT: '#0A0E1A',
          card:    '#0D1220',
          raised:  '#131929',
          border:  '#1E2A3A',
        },
        brand: {
          DEFAULT: '#3B82F6',
          dark:    '#1E3A5F',
          light:   '#DBEAFE',
        },
        accent: {
          win:    '#22C55E',
          winBg:  '#052e16',
          loss:   '#EF4444',
          lossBg: '#450a0a',
          draw:   '#F59E0B',
          drawBg: '#451a03',
          void:   '#64748B',
          voidBg: '#0f172a',
        },
        text: {
          primary:   '#E2E8F0',
          secondary: '#94A3B8',
          muted:     '#475569',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fill-bar': 'fillBar 0.6s ease-out forwards',
        'fade-in':  'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fillBar: {
          from: { width: '0%' },
          to:   { width: 'var(--target-width)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
