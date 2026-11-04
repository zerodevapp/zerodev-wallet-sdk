import type { Decorator, Preview } from '@storybook/react-vite'
import '../src/styles.css'
import {
  resolveTheme,
  type ThemeName,
  themeAttributes,
} from '../src/theme/theme'

const withCenteredContainer: Decorator = (Story, context) => (
  // Stories render outside a Screen, so this container carries the zd-scope
  // class the scoped reset applies to, and the theme attributes from the
  // toolbar.
  <div
    className="zd-scope zd:min-h-[300px] zd:min-w-[400px] zd:grid zd:place-items-center zd:p-6"
    {...themeAttributes(resolveTheme(context.globals.theme as ThemeName))}
  >
    {/* Wrapper insulates Story from grid alignment — some components
        (e.g. Badge) hard-code `self-start`, which would otherwise
        override `place-items-center`. */}
    <div>
      <Story />
    </div>
  </div>
)

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Theme preset (mode × brand)',
      defaultValue: 'branded-light',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'branded-light', title: 'Branded light' },
          { value: 'plain-light', title: 'Plain light' },
          { value: 'branded-dark', title: 'Branded dark' },
          { value: 'plain-dark', title: 'Plain dark' },
        ],
      },
    },
  },
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  decorators: [withCenteredContainer],
}

export default preview
