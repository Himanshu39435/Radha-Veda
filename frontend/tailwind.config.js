export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FAF6EE', beige: { DEFAULT: '#EBDFC9', light: '#F3EBDB', dark: '#D9C8A8' },
        earth: { DEFAULT: '#5B4636', light: '#8A7160', dark: '#3E2F24' },
        sage: { DEFAULT: '#7D8B6A', light: '#DDE4D2', dark: '#4E5D42' },
      },
      fontFamily: { display: ['"Cormorant Garamond"', 'Georgia', 'serif'], sans: ['Figtree', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
