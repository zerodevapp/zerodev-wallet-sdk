import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vocs'

export default defineConfig({
  rootDir: '.',
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@zerodev/wallet-react-kit': new URL(
          '../packages/react-kit/src/index.ts',
          import.meta.url,
        ).pathname,
        '@zerodev/wallet-react': new URL(
          '../packages/react/src/index.ts',
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
          ],
        },
        {
          text: 'Hooks',
          items: [
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
