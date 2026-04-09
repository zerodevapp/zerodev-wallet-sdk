import {
  AuthFlow,
  type AuthMethod,
  AuthProvider,
} from '@zerodev/wallet-react-kit'
import { useConnect } from 'wagmi'

export function AuthExample() {
  const { connect, connectors } = useConnect()
  const connector = connectors.find((c) => c.id === 'zerodev-wallet')

  const authConfig = {
    magicLinkBaseUrl: 'https://yourdomain.com/auth/verify',
    enabledMethods: ['email', 'google', 'passkey'] as AuthMethod[],
    onSuccess: () => {
      if (connector) {
        connect({ connector })
      }
    },
    onError: () => {
      // handle error
    },
  }

  return (
    <div className="flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <AuthProvider config={authConfig}>
          <AuthFlow />
        </AuthProvider>
      </div>
    </div>
  )
}
