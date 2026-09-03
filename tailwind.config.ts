import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
        '4xl': '28px',
      },
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          elevated: 'var(--bg-elevated)',
          hover: 'var(--bg-hover)',
          active: 'var(--bg-active)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          DEFAULT: 'var(--border-default)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        gold: {
          DEFAULT: 'var(--gold)',
          soft: 'var(--gold-soft)',
          dim: 'var(--gold-dim)',
          bg: 'var(--gold-bg)',
          border: 'var(--gold-border)',
        },
        success: {
          DEFAULT: 'var(--success)',
          bg: 'var(--success-bg)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          bg: 'var(--warning-bg)',
        },
        error: {
          DEFAULT: 'var(--error)',
          bg: 'var(--error-bg)',
        },
        info: {
          DEFAULT: 'var(--info)',
          bg: 'var(--info-bg)',
        },
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      transitionTimingFunction: {
        'lux': 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'shimmer': {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
      },
      boxShadow: {
        'soft': 'var(--shadow-sm)',
        'elevated': 'var(--shadow-md)',
        'modal': 'var(--shadow-lg)',
        'gold': 'var(--shadow-gold)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
