import type { StorybookConfig } from '@storybook/react-vite'
import svgr from 'vite-plugin-svgr'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  framework: '@storybook/react-vite',
  viteFinal(config) {
    config.plugins?.push(
      svgr({
        svgrOptions: {
          exportType: 'default',
        },
      }),
    )
    return config
  },
}
export default config
