import type { Meta, StoryObj } from '@storybook/react-vite'

import { ScreenWrapper } from '.'

const meta = {
  title: 'Shared/ScreenWrapper',
  component: ScreenWrapper,
  parameters: {
    layout: 'fullscreen',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof ScreenWrapper>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    children: ({ paddingTop, paddingBottom }) => (
      <div
        style={{
          paddingTop: `${paddingTop}px`,
          paddingBottom: `${paddingBottom}px`,
        }}
        className="h-full overflow-y-auto"
      >
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Content</h1>
          {Array.from({ length: 10 }, (_, i) => i).map((i) => (
            <div key={`content-${i}`} className="bg-white/50 p-4 rounded-lg">
              <p className="text-gray-700">Content block {i + 1}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
}
