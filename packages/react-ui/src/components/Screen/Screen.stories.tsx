import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import type { ThemeTokenOverrides } from '../../theme/theme'
import { Button } from '../Button'
import { Pill } from '../Pill'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
} from '../Select'
import { Text } from '../Text'
import {
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from '../Tooltip'
import { TopNav } from '../TopNav'
import { Screen } from './index'

const meta = {
  title: 'Screen',
  component: Screen,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Screen>

export default meta
type Story = StoryObj<typeof meta>

/** Overrides no stock theme uses, so a popover painted with them can only
 * have got them through the frame's theme. */
const PURPLE_TOKENS = {
  'bg-inverse-primary': '#7c3aed',
  'text-inverse-primary': '#ffffff',
  'border-neutral-primary': '#7c3aed',
  'bg-bright-primary': '#ede9fe',
} satisfies ThemeTokenOverrides
const PURPLE_OVERRIDES = Object.fromEntries(
  Object.entries(PURPLE_TOKENS).map(([k, v]) => [`--zd-${k}`, v]),
)

/** A tooltip held open, so the story shows where it lands and what paints it. */
function OpenTooltip({
  label,
  side = 'top',
}: {
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <TooltipProvider>
      <TooltipRoot open>
        <TooltipTrigger asChild>
          <Button text={label} />
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side={side}>Portaled tooltip</TooltipContent>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  )
}

const TOKENS = ['USDC', 'WETH', 'USDT'] as const

/** A select held open, the other popover that portals out of the content. */
function OpenSelect() {
  const [value, setValue] = useState<string>('USDC')
  return (
    <Select value={value} onValueChange={setValue} open>
      <SelectTrigger asChild>
        <Pill label={value} />
      </SelectTrigger>
      <SelectContent align="start">
        {TOKENS.map((t) => (
          <SelectItem key={t} value={t}>
            <SelectItemText>{t}</SelectItemText>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Content({ edge = false }: { edge?: boolean }) {
  return (
    <div className="zd:flex zd:flex-col zd:gap-6 zd:pt-4">
      <Text>Popovers portal into the frame.</Text>
      <OpenTooltip label="Tooltip" />
      <OpenSelect />
      {edge && (
        <div className="zd:flex zd:justify-end zd:-mr-4">
          <OpenTooltip label="At the edge" side="right" />
        </div>
      )}
    </div>
  )
}

/** The toolbar theme reaches the frame and its popovers through the
 * decorator's attributes alone. */
export const Default: Story = {
  args: { children: null },
  render: () => (
    <Screen topNav={<TopNav title="Default" />}>
      <Content />
    </Screen>
  ),
}

/** The `theme` prop: a preset plus token overrides, written on the frame
 * and on its portal container. The tooltip and the select panel paint in
 * the override purple. */
export const ThemedByProp: Story = {
  args: { children: null },
  render: () => (
    <Screen
      theme={{ mode: 'light', brand: 'plain', tokens: PURPLE_TOKENS }}
      topNav={<TopNav title="theme prop" />}
    >
      <Content />
    </Screen>
  ),
}

/** The same without React: a host wraps the frame with the attributes, and
 * overrides tokens from `:root` (here: a style tag). The frame's portal
 * container mirrors the wrapper's attributes, so popovers follow. */
export const ThemedByWrapper: Story = {
  args: { children: null },
  render: () => (
    <>
      <style>{`:root { ${Object.entries(PURPLE_OVERRIDES)
        .map(([k, v]) => `${k}: ${v};`)
        .join(' ')} }`}</style>
      <div data-zd-mode="light" data-zd-brand="plain">
        <Screen topNav={<TopNav title="Plain + :root overrides" />}>
          <Content />
        </Screen>
      </div>
    </>
  ),
}

/** Two frames with different themes on one page. Each popover follows its
 * own frame's container; nothing is shared. */
export const TwoFramesDifferentThemes: Story = {
  args: { children: null },
  render: () => (
    <div className="zd:flex zd:gap-6">
      <Screen size="sm" topNav={<TopNav title="Branded" />}>
        <Content />
      </Screen>
      <Screen
        size="sm"
        theme={{ brand: 'plain', tokens: PURPLE_TOKENS }}
        topNav={<TopNav title="Plain + overrides" />}
      >
        <Content />
      </Screen>
    </div>
  ),
}

/** A tooltip opening past the frame's edge. It renders under the portal
 * root on document.body, so the frame's overflow-hidden cannot clip it. */
export const PopoverPastTheFrameEdge: Story = {
  args: { children: null },
  render: () => (
    <Screen topNav={<TopNav title="Edge" />}>
      <Content edge />
    </Screen>
  ),
}

/** A host that animates the wallet in with a transform and leaves it on, and
 * clips its own overflow. Popovers live on document.body, outside it, so
 * they open next to their trigger, unclipped. */
export const InsideTransformedHost: Story = {
  args: { children: null },
  render: () => (
    <div
      style={{
        transform: 'scale(0.9)',
        overflow: 'hidden',
        padding: 24,
        outline: '1px dashed #999',
      }}
    >
      <Screen topNav={<TopNav title="Transformed host" />}>
        <Content edge />
      </Screen>
    </div>
  ),
}

/** The host flips the theme at runtime by rewriting the attribute on its
 * wrapper. The frame's container mirrors the change, so open popovers
 * follow. */
export const ThemeToggledAtRuntime: Story = {
  args: { children: null },
  render: () => {
    function Host() {
      const [plain, setPlain] = useState(false)
      return (
        <div className="zd:flex zd:flex-col zd:gap-4 zd:items-start">
          <Button
            text={plain ? 'Switch to branded' : 'Switch to plain'}
            onClick={() => setPlain((p) => !p)}
          />
          <div data-zd-brand={plain ? 'plain' : 'branded'}>
            <Screen topNav={<TopNav title={plain ? 'Plain' : 'Branded'} />}>
              <Content />
            </Screen>
          </div>
        </div>
      )
    }
    return <Host />
  },
}
