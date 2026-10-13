import type { Decorator } from '@storybook/react-vite'
import { Screen, TopNav } from '@zerodev/react-ui'

/**
 * Renders a page story inside the real Screen, as TxHistory does, so content
 * scrolls instead of being centered and clipped by the preview's card mimic.
 */
export const withRealScreen =
  (title: string): Decorator =>
  (Story) => (
    <div style={{ width: 420, height: 680 }}>
      <Screen topNav={<TopNav title={title} />}>
        <Story />
      </Screen>
    </div>
  )
