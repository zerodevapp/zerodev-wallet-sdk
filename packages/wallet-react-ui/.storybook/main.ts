import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  // Component-level stories only — no stories exist (or should be added) for
  // AuthFlow, SignatureRequest, or the */pages/* screens.
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
}
export default config
