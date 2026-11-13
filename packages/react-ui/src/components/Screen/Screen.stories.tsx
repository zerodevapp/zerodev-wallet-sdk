import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
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
 * have got them from the host's stylesheet. */
const PURPLE_CSS = `:root {
  --zd-bg-inverse-primary: #7c3aed;
  --zd-text-inverse-primary: #ffffff;
  --zd-border-neutral-primary: #7c3aed;
  --zd-bg-bright-primary: #ede9fe;
}`

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
 * attributes on <html> alone. */
export const Default: Story = {
  args: { children: null },
  render: () => (
    <Screen topNav={<TopNav title="Default" />}>
      <Content />
    </Screen>
  ),
}

/** Theming without React: the host sets the two attributes on <html> (here
 * the preview decorator writes `plain-light` for this story) and overrides
 * tokens from its stylesheet (a style tag). Popovers render under
 * document.body, so they inherit the same. */
export const ThemedOnHtml: Story = {
  args: { children: null },
  parameters: { theme: 'plain-light' },
  render: () => (
    <>
      <style>{PURPLE_CSS}</style>
      <Screen topNav={<TopNav title="Plain + :root overrides" />}>
        <Content />
      </Screen>
    </>
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

/** The host flips the theme at runtime by rewriting the attribute on
 * <html>. Open popovers follow, as they inherit from it. */
export const ThemeToggledAtRuntime: Story = {
  args: { children: null },
  render: () => {
    function Host() {
      const [plain, setPlain] = useState(
        () => document.documentElement.dataset.zdBrand === 'plain',
      )
      const toggle = () => {
        document.documentElement.dataset.zdBrand = plain ? 'branded' : 'plain'
        setPlain(!plain)
      }
      return (
        <div className="zd:flex zd:flex-col zd:gap-4 zd:items-start">
          <Button
            text={plain ? 'Switch to branded' : 'Switch to plain'}
            onClick={toggle}
          />
          <Screen topNav={<TopNav title={plain ? 'Plain' : 'Branded'} />}>
            <Content />
          </Screen>
        </div>
      )
    }
    return <Host />
  },
}
