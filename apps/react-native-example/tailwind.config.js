const path = require('path')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.resolve(__dirname, './App.tsx'),
    path.resolve(__dirname, './index.ts'),
    path.resolve(
      __dirname,
      '../../packages/react-native-kit/src/**/*.{ts,tsx}',
    ),
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
}
