/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Jua', 'sans-serif'],
        sans: ['"Noto Sans KR"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: { 50: '#FBF8F3', 100: '#F4EEE5', 200: '#E9DFD0', 300: '#D9CBB6' },
        cocoa: { 400: '#9A7B66', 600: '#6B4F3E', 800: '#3E2C22' },
        peach: { 300: '#FFC2B0', 400: '#FF9F86', 500: '#FF7F66', 600: '#EE6450' },
      },
      boxShadow: {
        sticker: '0 6px 14px -4px rgba(62,44,34,.25), 0 2px 4px rgba(62,44,34,.08)',
      },
    },
  },
  plugins: [],
};
