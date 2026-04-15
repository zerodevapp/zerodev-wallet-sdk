import type { Meta, StoryObj } from '@storybook/react-vite'

import { CodeInput } from '.'

const meta = {
  title: 'Auth/CodeInput',
  component: CodeInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    error: { control: 'boolean' },
    autoFocus: { control: 'boolean' },
  },
  args: {
    disabled: false,
    error: false,
    autoFocus: false,
  },
} satisfies Meta<typeof CodeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithError: Story = {
  args: {
    error: true,
  },
}

export const Disabled: Story = {
  args: {
    disabled: true,
  },
}

export const WithOnComplete: Story = {
  args: {
    onComplete: (code) => {
      // biome-ignore lint/suspicious/noConsole: This is a demo/story
      console.log(`Code complete: ${code}`)
      alert(`Code complete: ${code}`)
    },
  },
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8 items-center">
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-500 font-medium">Default</span>
        <CodeInput />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-red-500 font-medium">Error</span>
        <CodeInput error />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-400 font-medium">Disabled</span>
        <CodeInput disabled />
      </div>
    </div>
  ),
}
