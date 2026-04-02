import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  // All packages except react-native-kit
  'vitest.config.ts',
  // react-native-kit needs its own resolve/environment settings
  {
    resolve: {
      alias: {
        'react-native': 'react-native-web',
      },
      extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.js'],
    },
    test: {
      name: 'react-native-kit',
      globals: true,
      environment: 'happy-dom',
      root: 'packages/react-native-kit',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      setupFiles: ['./vitest.setup.ts'],
    },
  },
])
