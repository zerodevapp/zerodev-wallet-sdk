import type { Decorator, Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import '../src/styles.css'

/** The preset, `<brand>-<mode>`, written on <html> as a host would, so the
 * stories and what they portal out share it. A story that needs a fixed
 * theme names it in `parameters.theme`; the toolbar decides otherwise. */
function useHtmlTheme(preset: string) {
  const [brand, mode] = preset.split('-')
  useEffect(() => {
    document.documentElement.dataset.zdMode = mode
    document.documentElement.dataset.zdBrand = brand
  }, [brand, mode])
}

const withCenteredContainer: Decorator = (Story, context) => {
  useHtmlTheme((context.parameters.theme ?? context.globals.theme) as string)
  return (
    // Stories render outside a Screen, so this container carries the zd-scope
    // class the scoped reset applies to.
    <div className="zd-scope zd:min-h-[300px] zd:min-w-[400px] zd:grid zd:place-items-center zd:p-6">
      {/* Wrapper insulates Story from grid alignment — some components
          (e.g. Badge) hard-code `self-start`, which would otherwise
          override `place-items-center`. */}
      <div>
        <Story />
      </div>
    </div>
  )
}

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
