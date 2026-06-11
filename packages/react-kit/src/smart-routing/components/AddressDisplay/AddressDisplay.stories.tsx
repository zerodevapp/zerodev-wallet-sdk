import type { Meta, StoryObj } from '@storybook/react-vite'

import { AddressDisplay } from '.'

const meta = {
  title: 'Shared/AddressDisplay',
  component: AddressDisplay,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AddressDisplay>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    address: '0x8f527b33CD7c791aEDe7EbA077140D81A0000001',
    onQrClick: () => alert('Show QR'),
  },
}
