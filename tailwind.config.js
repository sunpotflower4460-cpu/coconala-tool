/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', '"Noto Sans JP"', 'sans-serif'],
        sans: ['Inter', '"Noto Sans JP"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        control: '12px',
        card: '16px',
        panel: '20px',
      },
      colors: {
        // CSS 変数へブリッジするので、テーマ切替（body.theme-*）はそのまま生きる。
        surface: 'var(--color-bg)',
        'surface-card': 'var(--color-bg-card-solid)',
        ink: 'var(--color-text)',
        accent: {
          // RGB channel vars (e.g. "99 102 241") so opacity modifiers
          // like bg-accent/80 and text-accent/70 work natively.
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          hover: 'rgb(var(--color-accent-hover) / <alpha-value>)',
        },
      },
      boxShadow: {
        'glass-1': '0 4px 24px -8px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.12)',
        'glass-2': '0 12px 40px -12px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.18)',
        'glass-3': '0 24px 64px -16px rgba(0,0,0,.65), inset 0 1px 0 rgba(255,255,255,.22)',
      },
      backdropBlur: {
        glass: '20px',
        'glass-strong': '32px',
      },
    },
  },
  plugins: [],
};
