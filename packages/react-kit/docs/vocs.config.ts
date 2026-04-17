import tailwindcss from '@tailwindcss/vite'
import svgr from 'vite-plugin-svgr'
import { defineConfig } from 'vocs'

export default defineConfig({
  rootDir: '.',
  vite: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plugins: [
      tailwindcss(),
      svgr({ svgrOptions: { exportType: 'default' } }) as any,
    ],
    resolve: {
      alias: {
        '@zerodev/wallet-react-kit': new URL('../src/index.ts', import.meta.url)
          .pathname,
        '@zerodev/wallet-react': new URL(
          '../../react/src/index.ts',
          import.meta.url,
        ).pathname,
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
      text: 'React',
      link: '/react/getting-started',
      collapsed: false,
      items: [
        {
          text: 'Getting Started',
          link: '/react/getting-started',
        },
        {
          text: 'Configuration',
          link: '/react/configuration',
        },
        {
          text: 'Features',
          items: [
            {
              text: 'Authentication',
              link: '/react/features/authentication',
            },
            {
              text: 'Transaction Signing',
              link: '/react/features/transaction-signing',
            },
          ],
        },
        {
          text: 'Components',
          items: [
            { text: 'Button', link: '/react/components/button' },
            { text: 'CodeInput', link: '/react/components/code-input' },
            { text: 'Icon', link: '/react/components/icon' },
            { text: 'IconButton', link: '/react/components/icon-button' },
            { text: 'Input', link: '/react/components/input' },
            { text: 'StatusView', link: '/react/components/status-view' },
            { text: 'Text', link: '/react/components/text' },
          ],
        },
        {
          text: 'Hooks',
          items: [
            {
              text: 'useAuth',
              link: '/react/hooks/use-auth',
            },
            {
              text: 'usePendingRequest',
              link: '/react/hooks/use-pending-request',
            },
          ],
        },
      ],
    },
  ],
})
