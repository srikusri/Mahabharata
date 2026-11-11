/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0E1A33', 2: '#1B2F5E' },
        gold: { DEFAULT: '#BF9A45', light: '#E9D091' },
        ivory: '#FBF7EC',
        paper: '#F2EBD7',
        rub: '#8E1F2A',
        grp: {
          brown: '#8A5A44', lblue: '#8FC1D4', pink: '#C97B9B', orange: '#D98A3D',
          red: '#B5313A', yellow: '#E6C45A', green: '#3E7D5B', dblue: '#2C3F8F',
        },
      },
      fontFamily: { serif: ['Georgia', '"Times New Roman"', 'serif'] },
    },
  },
  plugins: [],
};
