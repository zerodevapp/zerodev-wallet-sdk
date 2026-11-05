import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text } from '../components/Text'
import {
  type ThemeTokenName,
  themeTokenRole,
  themeTokens,
  themeTokenVar,
} from './tokens'

/** Every semantic token as the stylesheet resolves it, grouped by role. */
function TokenSwatches() {
  const names = Object.keys(themeTokens) as ThemeTokenName[]
  const roles = [...new Set(names.map(themeTokenRole))]
  return (
    <div className="zd:flex zd:flex-col zd:gap-6">
      {roles.map((role) => (
        <section key={role}>
          <Text className="zd:text-h3 zd:mb-2 zd:capitalize">{role}</Text>
          <div className="zd:grid zd:grid-cols-4 zd:gap-2">
            {names
              .filter((n) => themeTokenRole(n) === role)
              .map((name) => (
                <div key={name} className="zd:flex zd:items-center zd:gap-2">
                  {/* A checker behind the swatch makes alpha visible. */}
                  <div
                    className="zd:h-8 zd:w-8 zd:shrink-0 zd:rounded-lg zd:border zd:border-greyScale/30"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
                      backgroundSize: '8px 8px',
                      backgroundPosition: '0 0, 4px 4px',
                    }}
                  >
                    <div
                      className="zd:h-full zd:w-full zd:rounded-lg"
                      style={{ backgroundColor: `var(${themeTokenVar(name)})` }}
                    />
                  </div>
                  <Text className="zd:text-body3 zd:font-mono">{name}</Text>
                </div>
              ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const meta = {
  title: 'Foundations/Theme tokens',
  component: TokenSwatches,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TokenSwatches>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
