import type { Decorator, Preview } from '@storybook/react-vite'
import { useEffect } from 'react'
import '../src/styles.css'

const DEFAULT_THEME = 'branded-light'

/** The preset, `<brand>-<mode>`, written on <html> as a host would, so the
 * stories and what they portal out share it. A story that needs a fixed
 * theme names it in `parameters.theme`; the toolbar decides otherwise, and
 * the default covers a global that has not been set. */
function useHtmlTheme(preset: string = DEFAULT_THEME) {
  const [brand, mode] = preset.split('-')
  useEffect(() => {
    document.documentElement.dataset.zdMode = mode
    document.documentElement.dataset.zdBrand = brand
  }, [brand, mode])
}

// Stories may render outside a Screen, so this wrapper carries the zd-scope
// class the scoped reset applies to (nesting inside a story's own Screen is
// harmless — the rules are identical).
const withZdScope: Decorator = (Story, context) => {
  useHtmlTheme(
    (context.parameters.theme ?? context.globals.theme) as string | undefined,
  )
  return (
    <div className="zd-scope">
      <Story />
    </div>
  )
}

const preview: Preview = {
  initialGlobals: { theme: DEFAULT_THEME },
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
  },
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
