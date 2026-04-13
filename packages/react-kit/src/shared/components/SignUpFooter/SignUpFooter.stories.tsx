import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'

import { SignUpFooter } from '.'

const meta = {
  title: 'Shared/SignUpFooter',
  component: SignUpFooter,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    agreedToTerms: { control: 'boolean' },
    isAndroidNavButtons: { control: 'boolean' },
  },
} satisfies Meta<typeof SignUpFooter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
  },
  render: () => {
    const [agreed, setAgreed] = useState(false)
    return (
      <div className="w-96 p-6 bg-white rounded-lg">
        <SignUpFooter agreedToTerms={agreed} setAgreedToTerms={setAgreed} />
      </div>
    )
  },
}

export const Unchecked: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
  },
  render: () => {
    const [agreed, setAgreed] = useState(false)
    return (
      <div className="w-96 p-6 bg-white rounded-lg">
        <SignUpFooter agreedToTerms={agreed} setAgreedToTerms={setAgreed} />
      </div>
    )
  },
}

export const Checked: Story = {
  args: {
    agreedToTerms: true,
    setAgreedToTerms: () => {},
  },
  render: () => {
    const [agreed, setAgreed] = useState(true)
    return (
      <div className="w-96 p-6 bg-white rounded-lg">
        <SignUpFooter agreedToTerms={agreed} setAgreedToTerms={setAgreed} />
      </div>
    )
  },
}

export const WithAndroidNavButtons: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
    isAndroidNavButtons: true,
  },
  render: () => {
    const [agreed, setAgreed] = useState(false)
    return (
      <div className="w-96 p-6 bg-white rounded-lg">
        <SignUpFooter
          agreedToTerms={agreed}
          setAgreedToTerms={setAgreed}
          isAndroidNavButtons={true}
        />
      </div>
    )
  },
}

export const InSignUpForm: Story = {
  args: {
    agreedToTerms: false,
    setAgreedToTerms: () => {},
  },
  render: () => {
    const [agreed, setAgreed] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    return (
      <div className="w-96 p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Create Account
        </h2>
        <div className="flex flex-col gap-4 mb-6">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="px-4 py-3 rounded-lg border border-gray-300"
          />
          <button
            type="button"
            disabled={!agreed}
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
              agreed
                ? 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Sign Up
          </button>
        </div>
        <SignUpFooter agreedToTerms={agreed} setAgreedToTerms={setAgreed} />
      </div>
    )
  },
}
