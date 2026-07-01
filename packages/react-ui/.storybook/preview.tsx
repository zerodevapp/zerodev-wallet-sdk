import type { Decorator, Preview } from '@storybook/react-vite'
import '../src/styles.css'

const withCenteredContainer: Decorator = (Story) => (
  <div className="min-h-[300px] min-w-[400px] grid place-items-center p-6">
    {/* Wrapper insulates Story from grid alignment — some components
        (e.g. Badge) hard-code `self-start`, which would otherwise
        override `place-items-center`. */}
    <div>
      <Story />
    </div>
  </div>
)

const preview: Preview = {
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
