import { Button, CodeInput } from '@zerodev/wallet-react-kit'
import { useState } from 'react'

export function App() {
  const [, setCode] = useState('')
  const [, setCompleted] = useState(false)
  const [action, setAction] = useState<
    'primary' | 'secondary' | 'secondaryNeutral'
  >('primary')
  const [codeError, setCodeError] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            ZeroDev React Kit — Playground
          </h1>
          <p className="mt-2 text-gray-500">
            Interactive demo of{' '}
            <code className="text-sm bg-gray-100 px-1.5 py-0.5 rounded">
              @zerodev/wallet-react-kit
            </code>{' '}
            components
          </p>
        </div>

        {/* Button */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">Button</h2>

          <div className="flex gap-2">
            {(['primary', 'secondary', 'secondaryNeutral'] as const).map(
              (v) => (
                <Button
                  key={v}
                  text={v}
                  onClick={() => {
                    setAction(v)
                  }}
                  className={`h-auto w-auto px-3 py-1 text-sm rounded-full border ${
                    action === v
                      ? 'bg-gray-900 border-gray-900'
                      : 'bg-white border-gray-300 hover:border-gray-400'
                  }`}
                  action={action === v ? 'primary' : 'secondary'}
                />
              ),
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Button
              text="Connect Wallet"
              action={action}
              onClick={() => {
                alert('Button clicked!')
              }}
            />
            <Button text="Disabled" action={action} disabled />
          </div>
        </section>

        {/* CodeInput */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
          <h2 className="text-xl font-semibold text-gray-800">CodeInput</h2>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={codeError}
                onChange={(e) => {
                  setCodeError(e.target.checked)
                }}
                className="rounded"
              />
              Error state
            </label>
          </div>

          <div className="flex flex-col items-center">
            <CodeInput
              error={codeError}
              onChange={(value) => {
                setCode(value)
                setCompleted(false)
              }}
              onComplete={(value) => {
                setCompleted(true)
                setCode(value)
              }}
            />
          </div>

          <div className="pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-500 mb-3">Disabled</h3>
            <div className="flex justify-center">
              <CodeInput disabled />
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
