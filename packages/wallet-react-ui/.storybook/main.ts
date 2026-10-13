import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  // Component-level stories only. No stories for components wired to wagmi or
  // the Data API hook (ConnectWallet, SignatureRequest, TxHistory).
  // Story-only fixtures and decorators live in a `__stories__` folder next to
  // the stories; the build, type emit, and tarball all exclude that folder.
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
}
export default config
