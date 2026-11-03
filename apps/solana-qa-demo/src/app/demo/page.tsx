'use client'

import { ConnectWallet, SignUp } from '@zerodev/wallet-react-ui'

export default function DemoPage() {
  return (
    <>
      <ConnectWallet
        renderSignUp={() => (
          <SignUp emailAuthMethod="otp">
            <SignUp.Email />
            <SignUp.Divider label="or a wallet" />
            <SignUp.InstalledWallets
              maxWallets={6}
              namespaces={['eip155', 'solana'] as const}
            />
            <SignUp.WalletConnect />
            <SignUp.SolanaWalletConnect />
          </SignUp>
        )}
      />
    </>
  )
}
