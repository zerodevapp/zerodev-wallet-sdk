import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      spacing: {
        13: '52px',
        4.5: '18px',
      },
      colors: {
        // Design color palette START
        orange: '#F27B3E',
        solarOrange: '#E76000',
        paleOrange: '#FAC8AB',
        lightOrange: '#FCE8D8',
        skyBlue: '#45ABFB',
        greyBrown: '#B78C71',
        warmGrey: '#E3CFC3',
        offWhite: '#F7F5F0',
        greyScale: '#130E0B',
        positive: '#228300',
        negative: '#FF4221',
      },
      fontSize: {
        xs: '10px',
        sm: '12px',
        base: '14px',
        lg: '16px',
        xl: '18px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '30px',
        '5xl': '36px',
        '6xl': '48px',
        // Design typography START
        h1: ['42px', '110%'],
        h2: ['28px', '110%'],
        h3: ['18px', '130%'],
        body1: ['16px', '130%'],
        body2: ['14px', '130%'],
        body3: ['12px', '130%'],
        body4: ['10px', '130%'],
        // Design typography END
      },
      fontFamily: {
        sans: ['VC Cardinal Wide Trial', 'sans-serif'],
        heading: ['VC Cardinal Wide Trial', 'sans-serif'],
        body: ['VC Cardinal Wide Trial', 'sans-serif'],
        mono: undefined,
        roboto: ['Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
