/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Nunito',
          'ui-sans-serif',
          'system-ui',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
          'Noto Color Emoji'
        ],
      },
      colors: {
        orange: {
          500: '#E67E22', // muted orange for better readability
        },
        darkgreen: {
          50: '#f5fbf6',
          100: '#e6f6ea',
          200: '#ccecd2',
          300: '#99dca5',
          400: '#66cc78',
          500: '#2f8f4a',
          600: '#276f3c',
          700: '#1f532f',
          800: '#173a22',
          900: '#0e2416'
        }
      }
    },
  },
  plugins: [],
};
