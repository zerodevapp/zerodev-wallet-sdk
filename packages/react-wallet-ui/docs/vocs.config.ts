import { nodePolyfills } from 'vite-plugin-node-polyfills'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'vocs'

export default defineConfig({
  rootDir: '.',
  vite: {
    plugins: [
      svgr({ svgrOptions: { exportType: 'default' } }),
      nodePolyfills({ include: ['buffer'], globals: { Buffer: true } }),
    ],
    resolve: {
      alias: {
        '@zerodev/react-wallet-ui': new URL('../src/index.ts', import.meta.url)
          .pathname,
      },
    },
  },
  title: 'ZeroDev Wallet SDK',
  description: 'Wallet SDK for ZeroDev',
  sidebar: [
    {
      text: 'Getting Started',
      link: '/getting-started',
    },
    {
      text: 'React Kit',
      link: '/react-kit/getting-started',
      collapsed: false,
      items: [
        {
          text: 'Getting Started',
          link: '/react-kit/getting-started',
        },
        {
          text: 'Configuration',
          link: '/react-kit/configuration',
        },
        {
          text: 'Features',
          items: [
            {
              text: 'Authentication',
              link: '/react-kit/features/authentication',
            },
            {
              text: 'Transaction Signing',
              link: '/react-kit/features/transaction-signing',
            },
          ],
        },
        {
          text: 'Hooks',
          items: [
            {
              text: 'useAuth',
              link: '/react-kit/hooks/use-auth',
            },
            {
              text: 'usePendingRequest',
              link: '/react-kit/hooks/use-pending-request',
            },
            {
              text: 'usePendingRequests',
              link: '/react-kit/hooks/use-pending-requests',
            },
          ],
        },
      ],
    },
  ],
})
