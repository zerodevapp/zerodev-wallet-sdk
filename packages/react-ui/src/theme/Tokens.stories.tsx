import type { Meta, StoryObj } from '@storybook/react-vite'
import { Text } from '../components/Text'
import tokensCss from './tokens.css?raw'

/** `bg-neutral-primary` -> `--zd-background-color-neutral-primary`, etc. */
const NAMESPACES = {
  bg: 'background-color',
  text: 'text-color',
  'text-icon': 'text-color-icon',
  border: 'border-color',
} as const

type Role = keyof typeof NAMESPACES

/** Every token the stylesheet declares, read off the @theme block. */
function tokensByRole(): Record<Role, string[]> {
  const out: Record<Role, string[]> = {
    bg: [],
    text: [],
    'text-icon': [],
    border: [],
  }
  for (const [, namespace, tail] of tokensCss.matchAll(
    /^\s+--(background-color|text-color-icon|text-color|border-color)-([a-z-]+):/gm,
  )) {
    const role = (Object.keys(NAMESPACES) as Role[]).find(
      (r) => NAMESPACES[r] === namespace,
    )
    if (role) out[role].push(tail)
  }
  return out
}

function TokenSwatches() {
  const tokens = tokensByRole()
  return (
    <div className="zd:flex zd:flex-col zd:gap-6">
      {(Object.keys(tokens) as Role[]).map((role) => (
        <section key={role}>
          <Text className="zd:text-h3 zd:mb-2">{role}</Text>
          <div className="zd:grid zd:grid-cols-4 zd:gap-2">
            {tokens[role].map((tail) => (
              <div key={tail} className="zd:flex zd:items-center zd:gap-2">
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
                    style={{
                      backgroundColor: `var(--zd-${NAMESPACES[role]}-${tail})`,
                    }}
                  />
                </div>
                <Text className="zd:text-body3 zd:font-mono">
                  {role}-{tail}
                </Text>
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
