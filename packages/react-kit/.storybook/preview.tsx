import type { Decorator, Preview } from '@storybook/react-vite'
import { MultiRadialBackground } from '../src/shared/components/ScreenWrapper/MultiRadialBackground'
import '../src/styles.css'

const withScreenWrapper: Decorator = (Story, context) => {
  const screenWrapper = context.globals.screenWrapper as 'on' | 'off'
  if (screenWrapper !== 'on') return <Story />
  // Storybook-flavored mimic of <ScreenWrapper>: same gradient + rounded
  // offWhite card, but with no TopNav padding and content-driven height
  // (with a 500x500 floor). This way the story is genuinely centered and
  // taller stories (e.g. Button — all variants) can grow the wrapper
  // instead of being clipped.
  return (
    <div className="w-[500px] min-h-[300px] flex flex-col relative overflow-hidden rounded-[34px]">
      <MultiRadialBackground />
      <div className="flex-1 grid place-items-center bg-offWhite/85 m-1.5 px-4 py-6 rounded-[30px] relative">
        {/* Wrapper insulates Story from grid alignment — some components
            (e.g. Badge) hard-code `self-start`, which would otherwise
            override `place-items-center`. */}
        <div>
          <Story />
        </div>
      </div>
    </div>
  )
}

const preview: Preview = {
  globalTypes: {
    screenWrapper: {
      name: 'ScreenWrapper',
      description: 'Render the story inside the AuthFlow card chrome',
      defaultValue: 'off',
      toolbar: {
        icon: 'contrast',
        items: [
          { value: 'off', title: 'ScreenWrapper Off' },
          { value: 'on', title: 'ScreenWrapper On' },
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
  decorators: [withScreenWrapper],
}

export default preview
