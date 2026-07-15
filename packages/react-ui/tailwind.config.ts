import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // Custom steps derive from the spacing base (var(--zd-spacing), default
      // 0.25rem) so density variants rescale them like every other spacing
      // utility. 13 = 52px, 17 = 68px, 4.5 = 18px at the default base.
      spacing: {
        13: 'calc(var(--zd-spacing) * 13)',
        17: 'calc(var(--zd-spacing) * 17)',
        4.5: 'calc(var(--zd-spacing) * 4.5)',
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
        // Font sizes multiply by --zd-density (default 1) so text scales with
        // the density variants like spacing does. Line-heights are percentages,
        // which already track the scaled font-size.
        xs: 'calc(10px * var(--zd-density))',
        sm: 'calc(12px * var(--zd-density))',
        base: 'calc(14px * var(--zd-density))',
        lg: 'calc(16px * var(--zd-density))',
        xl: 'calc(18px * var(--zd-density))',
        '2xl': 'calc(20px * var(--zd-density))',
        '3xl': 'calc(24px * var(--zd-density))',
        '4xl': 'calc(30px * var(--zd-density))',
        '5xl': 'calc(36px * var(--zd-density))',
        '6xl': 'calc(48px * var(--zd-density))',
        // Design typography START
        h1: ['calc(42px * var(--zd-density))', '110%'],
        h2: ['calc(28px * var(--zd-density))', '110%'],
        h3: ['calc(18px * var(--zd-density))', '130%'],
        body1: ['calc(16px * var(--zd-density))', '130%'],
        body2: ['calc(14px * var(--zd-density))', '130%'],
        body3: ['calc(12px * var(--zd-density))', '130%'],
        body4: ['calc(10px * var(--zd-density))', '130%'],
        // Design typography END
      },
      fontFamily: {
        sans: ['sans-serif'],
        heading: ['sans-serif'],
        body: ['sans-serif'],
        mono: undefined,
        roboto: ['Roboto', 'sans-serif'],
      },
      // Modal slide-up / slide-down animations. Defined in the config (not
      // the CSS) so consumers who @config this file (e.g.
      // smart-routing-address-react-ui) inherit them automatically. CSS
      // animations restart deterministically when animation-name changes,
      // which is what Modal relies on for open→close→open interrupts.
      keyframes: {
        'modal-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'modal-out': {
          from: { transform: 'translateY(0)' },
          to: { transform: 'translateY(100%)' },
        },
        'backdrop-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'backdrop-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
      },
      animation: {
        'modal-in': 'modal-in 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'modal-out': 'modal-out 250ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'backdrop-in': 'backdrop-in 200ms ease-out forwards',
        'backdrop-out': 'backdrop-out 200ms ease-out forwards',
      },
    },
  },
  plugins: [],
}

export default config
