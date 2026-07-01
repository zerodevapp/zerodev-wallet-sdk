import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SignUpFooter } from '.'

const TERMS_URL = 'https://example.com/terms'
const PRIVACY_URL = 'https://example.com/privacy'

const meta = {
  title: 'Shared/SignUpFooter',
  component: SignUpFooter,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    agreedToTerms: { control: 'boolean' },
  },
} satisfies Meta<typeof SignUpFooter>

export default meta
type Story = StoryObj<typeof meta>

function Wrap(props: React.ComponentProps<typeof SignUpFooter>) {
  const [agreed, setAgreed] = useState(props.agreedToTerms)
  return (
    <SignUpFooter
      {...props}
      agreedToTerms={agreed}
      setAgreedToTerms={setAgreed}
    />
  )
}

export const BothLinks: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
    termsAndConditionsUrl: TERMS_URL,
    privacyPolicyUrl: PRIVACY_URL,
  },
  render: (args) => <Wrap {...args} />,
}

export const Checked: Story = {
  args: {
    agreedToTerms: true,
    setAgreedToTerms: () => {},
    termsAndConditionsUrl: TERMS_URL,
    privacyPolicyUrl: PRIVACY_URL,
  },
  render: (args) => <Wrap {...args} />,
}

export const OnlyTerms: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
    termsAndConditionsUrl: TERMS_URL,
  },
  render: (args) => <Wrap {...args} />,
}

export const OnlyPrivacy: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
    privacyPolicyUrl: PRIVACY_URL,
  },
  render: (args) => <Wrap {...args} />,
}

export const NoAgreement: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
  },
  render: (args) => <Wrap {...args} />,
}
