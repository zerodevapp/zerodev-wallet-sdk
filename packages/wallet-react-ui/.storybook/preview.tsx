import type { Decorator, Preview } from '@storybook/react-vite'
import { Screen } from '@zerodev/react-ui'
import '../src/styles.css'

const withScreen: Decorator = (Story, context) => {
  const screen = context.globals.screen as 'on' | 'off'
  // Screen-off stories render outside a Screen, so this wrapper carries the
  // zd-scope class the scoped reset applies to.
  if (screen !== 'on')
    return (
      <div className="zd-scope">
        <Story />
      </div>
    )
  // Storybook-flavored mimic of <Screen>: same gradient + rounded
  // neutral card, but with no TopNav padding and content-driven height
  // (with a 500x500 floor). This way the story is genuinely centered and
  // taller stories (e.g. Button — all variants) can grow the wrapper
  // instead of being clipped.
  return (
    <Screen
      className="zd:w-125 zd:min-h-75 zd:flex zd:flex-col zd:relative zd:overflow-hidden zd:rounded-[34px]"
      contentClassName="zd:flex-1 zd:grid zd:place-items-center zd:bg-neutral-primary zd:m-1.5 zd:px-4 zd:py-6 zd:rounded-[30px] zd:relative"
    >
      <div>
        <Story />
      </div>
    </Screen>
  )
}

const preview: Preview = {
  globalTypes: {
    screen: {
      name: 'Screen',
      description: 'Render the story inside the ConnectWallet card chrome',
      defaultValue: 'on',
      toolbar: {
        icon: 'contrast',
        items: [
          { value: 'off', title: 'Screen Off' },
          { value: 'on', title: 'Screen On' },
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
  decorators: [withScreen],
}

export default preview
