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
    autoFocus: { control: 'boolean' },
    length: { control: { type: 'number', min: 4, max: 8, step: 1 } },
  },
  args: {
    disabled: false,
    autoFocus: false,
    length: 6,
  },
} satisfies Meta<typeof CodeInput>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

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

export const FourDigits: Story = {
  args: {
    length: 4,
  },
}

export const EightDigits: Story = {
  args: {
    length: 8,
  },
}

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-8 items-center">
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-500 font-medium">Default (6)</span>
        <CodeInput onComplete={() => window.alert('Completed')} />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-500 font-medium">4 digits</span>
        <CodeInput length={4} />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-500 font-medium">8 digits</span>
        <CodeInput length={8} />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <span className="text-sm text-gray-400 font-medium">Disabled</span>
        <CodeInput disabled />
      </div>
    </div>
  ),
}
