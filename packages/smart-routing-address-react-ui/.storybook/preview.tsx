import type { Decorator, Preview } from '@storybook/react-vite'
import '../src/styles.css'

// Stories may render outside a Screen, so this wrapper carries the zd-scope
// class the scoped reset applies to (nesting inside a story's own Screen is
// harmless — the rules are identical).
const withZdScope: Decorator = (Story) => (
  <div className="zd-scope">
    <Story />
  </div>
)

const preview: Preview = {
  decorators: [withZdScope],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
}

export default preview
