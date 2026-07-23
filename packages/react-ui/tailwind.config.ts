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
      // Sheet / overlay animations bound to Radix's `data-state=open|closed`
      // attributes. Defined here (not in the CSS) so downstream packages that
      // `@config` this file inherit them without duplication.
      keyframes: {
        'sheet-in': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'sheet-out': {
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
        // Gentle opacity pulse for loading skeletons — softer than Tailwind's
        // default `pulse` (which dips to 50% and looks jittery on greys).
        'skel-pulse': {
          '0%, 100%': { opacity: '0.65' },
          '50%': { opacity: '1' },
        },
        'popper-in': {
          from: { opacity: '0', transform: 'scale(0.97) translateY(-3px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        // Fresh-value flash for live-updating fee estimates: fades and lifts
        // in when the underlying quote changes, so a route swap visibly
        // recalculates rather than silently snapping.
        'fee-flash': {
          from: { opacity: '0', transform: 'translateY(-3px) scale(0.96)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'sheet-in': 'sheet-in 300ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'sheet-out': 'sheet-out 250ms cubic-bezier(0.32, 0.72, 0, 1) forwards',
        'backdrop-in': 'backdrop-in 200ms ease-out forwards',
        'backdrop-out': 'backdrop-out 200ms ease-out forwards',
        'skel-pulse': 'skel-pulse 1.1s ease-in-out infinite',
        'popper-in': 'popper-in 160ms ease-out both',
        'fee-flash': 'fee-flash 420ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
      },
    },
  },
  plugins: [],
}

export default config
