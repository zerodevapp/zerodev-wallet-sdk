import type { Decorator, Preview } from '@storybook/react-vite'
import { Screen } from '../src/shared/components/Screen'
import '../src/styles.css'

const withScreen: Decorator = (Story, context) => {
  const screen = context.globals.screen as 'on' | 'off'
  if (screen !== 'on') return <Story />
  // Storybook-flavored mimic of <Screen>: same gradient + rounded
  // offWhite card, but with no TopNav padding and content-driven height
  // (with a 500x500 floor). This way the story is genuinely centered and
  // taller stories (e.g. Button — all variants) can grow the wrapper
  // instead of being clipped.
  return (
    <Screen
      className="w-125 min-h-75 flex flex-col relative overflow-hidden rounded-[34px]"
      contentClassName="flex-1 grid place-items-center bg-offWhite/85 m-1.5 px-4 py-6 rounded-[30px] relative"
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
      description: 'Render the story inside the AuthFlow card chrome',
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
