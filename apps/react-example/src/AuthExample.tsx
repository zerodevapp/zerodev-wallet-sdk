import { AuthFlow } from '@zerodev/wallet-react-kit'

export function AuthExample() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <AuthFlow />
      </div>
    </div>
  )
}
