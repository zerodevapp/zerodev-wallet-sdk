import type { Decorator, Preview } from '@storybook/react-vite'
import { Screen } from '@zerodev/react-ui'
import { useEffect } from 'react'
import '../src/styles.css'

const DEFAULT_THEME = 'branded-light'

/** The toolbar value is a preset name, `<brand>-<mode>`, written on <html>
 * as a host would, so the stories and what they portal out share it; the
 * default covers a global that has not been set. */
function useToolbarTheme(preset: string = DEFAULT_THEME) {
  const [brand, mode] = preset.split('-')
  useEffect(() => {
    document.documentElement.dataset.zdMode = mode
    document.documentElement.dataset.zdBrand = brand
  }, [brand, mode])
}

const withScreen: Decorator = (Story, context) => {
  const screen = (context.globals.screen ?? 'on') as 'on' | 'off'
  useToolbarTheme(context.globals.theme as string | undefined)
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
  initialGlobals: { theme: DEFAULT_THEME, screen: 'on' },
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Theme preset (mode × brand)',
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
    screen: {
      name: 'Screen',
      description: 'Render the story inside the ConnectWallet card chrome',
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
