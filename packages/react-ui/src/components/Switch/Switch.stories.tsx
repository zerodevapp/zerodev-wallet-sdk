import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { useArgs } from 'storybook/preview-api'

import { Switch } from '.'

const meta = {
  title: 'Shared/Switch',
  component: Switch,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    value: { control: 'boolean' },
  },
  render: function Render(args) {
    const [, setArgs] = useArgs<{ value: boolean }>()
    return (
      <Switch {...args} onValueChange={() => setArgs({ value: !args.value })} />
    )
  },
} satisfies Meta<typeof Switch>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {
  args: { value: false },
}

export const On: Story = {
  args: { value: true },
}

export const Interactive: Story = {
  render: () => {
    const [on, setOn] = useState(false)
    return <Switch value={on} onValueChange={() => setOn((v) => !v)} />
  },
}
