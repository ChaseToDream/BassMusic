/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 低频主题：高对比度深色配色
        bass: {
          bg: '#0b1020',
          surface: '#121a2f',
          'surface-2': '#182238',
          border: '#243049',
          text: '#e8ecf5',
          muted: '#8a94a8',
        },
        accent: {
          DEFAULT: '#facc15',
          hover: '#f0b400',
          muted: '#ca9a04',
        },
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      boxShadow: {
        glow: '0 0 0 3px rgba(250, 204, 21, 0.35)',
      },
    },
  },
  plugins: [],
}
