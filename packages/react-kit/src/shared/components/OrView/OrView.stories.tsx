import type { Meta, StoryObj } from '@storybook/react-vite'

import { OrView } from '.'

const meta = {
  title: 'Shared/OrView',
  component: OrView,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof OrView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <div className="w-80">
      <OrView />
    </div>
  ),
}

export const InForm: Story = {
  render: () => (
    <div className="w-96 flex flex-col gap-4 p-6 bg-white rounded-lg">
      <button
        type="button"
        className="px-4 py-3 rounded-lg bg-blue-500 text-white font-medium"
      >
        Continue with Google
      </button>
      <OrView />
      <div className="flex flex-col gap-3">
        <input
          type="email"
          placeholder="Email"
          className="px-4 py-3 rounded-lg bg-white border border-gray-300"
        />
        <input
          type="password"
          placeholder="Password"
          className="px-4 py-3 rounded-lg bg-white border border-gray-300"
        />
        <button
          type="button"
          className="px-4 py-3 rounded-lg bg-gray-900 text-white font-medium"
        >
          Sign In
        </button>
      </div>
    </div>
  ),
}

export const NarrowWidth: Story = {
  render: () => (
    <div className="w-48">
      <OrView />
    </div>
  ),
}

export const WideWidth: Story = {
  render: () => (
    <div className="w-[600px]">
      <OrView />
    </div>
  ),
}

export const MultipleStacked: Story = {
  render: () => (
    <div className="w-80 flex flex-col gap-8">
      <div>
        <button
          type="button"
          className="w-full px-4 py-3 rounded-lg bg-blue-500 text-white font-medium"
        >
          Option A
        </button>
      </div>
      <OrView />
      <div>
        <button
          type="button"
          className="w-full px-4 py-3 rounded-lg bg-green-500 text-white font-medium"
        >
          Option B
        </button>
      </div>
      <OrView />
      <div>
        <button
          type="button"
          className="w-full px-4 py-3 rounded-lg bg-purple-500 text-white font-medium"
        >
          Option C
        </button>
      </div>
    </div>
  ),
}
