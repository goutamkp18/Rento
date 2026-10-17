/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: 'rgb(var(--color-bg-app) / <alpha-value>)',
          900: 'rgb(var(--color-bg-card) / <alpha-value>)',
          850: 'rgb(var(--color-bg-elevated) / <alpha-value>)',
          800: 'rgb(var(--color-bg-subtle) / <alpha-value>)',
          750: 'rgb(var(--color-bg-muted) / <alpha-value>)',
          700: 'rgb(var(--color-border-rgb) / <alpha-value>)',
          600: 'rgb(var(--color-text-muted) / <alpha-value>)',
          500: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          400: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          300: 'rgb(var(--color-text-primary) / <alpha-value>)',
          200: 'rgb(var(--color-text-primary) / <alpha-value>)',
          100: 'rgb(var(--color-text-primary) / <alpha-value>)',
          50: 'rgb(var(--color-text-primary) / <alpha-value>)',
        },
        brand: {
          50: 'rgb(var(--color-accent-muted))',
          100: 'rgb(var(--color-accent-muted))',
          200: 'rgb(var(--color-accent-light) / <alpha-value>)',
          300: 'rgb(var(--color-accent-light) / <alpha-value>)',
          400: 'rgb(var(--color-accent) / <alpha-value>)',
          500: 'rgb(var(--color-accent) / <alpha-value>)',
          600: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          700: 'rgb(var(--color-accent-dark) / <alpha-value>)',
          800: 'rgb(var(--color-accent-dark) / <alpha-value>)',
          900: 'rgb(var(--color-bg-card) / <alpha-value>)',
          950: 'rgb(var(--color-bg-app) / <alpha-value>)',
        },
        violet: {
          300: 'rgb(var(--color-accent-light) / <alpha-value>)',
          400: 'rgb(var(--color-accent-light) / <alpha-value>)',
          500: 'rgb(var(--color-accent) / <alpha-value>)',
          600: 'rgb(var(--color-accent-hover) / <alpha-value>)',
          700: 'rgb(var(--color-accent-dark) / <alpha-value>)',
          950: 'rgb(var(--color-bg-card) / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--color-text-primary) / <alpha-value>)',
          100: 'rgb(var(--color-text-primary) / <alpha-value>)',
          200: 'rgb(var(--color-text-primary) / <alpha-value>)',
          300: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          400: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          500: 'rgb(var(--color-text-muted) / <alpha-value>)',
          600: 'rgb(var(--color-text-muted) / <alpha-value>)',
          700: 'rgb(var(--color-border-rgb) / <alpha-value>)',
          800: 'rgb(var(--color-bg-subtle) / <alpha-value>)',
          900: 'rgb(var(--color-bg-card) / <alpha-value>)',
          950: 'rgb(var(--color-bg-app) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-brand': 'var(--shadow-glow)',
        'glow-violet': 'var(--shadow-glow)',
        'subtle': 'var(--shadow-subtle)',
        'card': 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
      },
      backgroundImage: {
        'hero-radial': 'radial-gradient(circle at 50% 0%, rgb(var(--color-accent) / 0.15) 0%, transparent 70%)',
        'card-gradient': 'linear-gradient(180deg, rgb(var(--color-bg-card) / 0.95) 0%, rgb(var(--color-bg-card) / 0.98) 100%)',
        'dark-card-gradient': 'linear-gradient(180deg, rgba(24, 24, 24, 0.9) 0%, rgba(20, 20, 20, 0.98) 100%)',
      }
    },
  },
  plugins: [],
}
