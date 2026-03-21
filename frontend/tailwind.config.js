/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4ff',
          100: '#dde6ff',
          200: '#c3d1ff',
          300: '#9ab3ff',
          400: '#6b8aff',
          500: '#3d5afe',
          600: '#1e3a8a',
          700: '#1a3270',
          800: '#152a5c',
          900: '#0f1f45',
          950: '#080f22',
        },
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        accent: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px 0 rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07)',
        'card-lg': '0 4px 16px 0 rgba(0,0,0,0.08), 0 2px 6px -2px rgba(0,0,0,0.06)',
        'nav': '0 2px 20px 0 rgba(15,31,69,0.12)',
      },
    },
  },
  plugins: [],
}
