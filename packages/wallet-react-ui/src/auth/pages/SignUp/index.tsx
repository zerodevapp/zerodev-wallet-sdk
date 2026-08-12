import { Button, Text } from '@zerodev/react-ui'
import { type ReactNode, useCallback, useState } from 'react'
import { SignUpFooter } from '../../../shared/components/SignUpFooter'
import { BlobAnimation } from '../../components/BlobAnimation'
import type { EmailAuthMethod } from '../../types'
import { SignUpContext } from './context'
import { SignUpEmail } from './Email'
import { SignUpGoogle } from './Google'
import { SignUpInstalledWallets } from './InstalledWallets'
import { SignUpMoreWallets } from './MoreWallets'
import { SignUpPasskey } from './Passkey'
import { SignUpWallet } from './Wallet'
import { SignUpWalletConnect } from './WalletConnect'

type SignUpRootProps = {
  children: ReactNode
  /** Enable the consent gate: linked from the footer checkbox, and every
   * method is blocked until the user agrees when either URL is set. */
  termsAndConditionsUrl?: string | undefined
  privacyPolicyUrl?: string | undefined
  /** Which email verification flow the Email unit runs. */
  emailAuthMethod?: EmailAuthMethod | undefined
}

function SignUpRoot({
  children,
  termsAndConditionsUrl,
  privacyPolicyUrl,
  emailAuthMethod = 'magicLink',
}: SignUpRootProps) {
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [highlightAgreement, setHighlightAgreement] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // One flag for the whole page: methods are mutually exclusive, so at most
  // one unit is in flight at a time. Known accepted edge: a unit unmounting
  // mid-flight (conditional composition) clears a sibling's lock.
  const [authPending, setAuthPending] = useState(false)
  // Which wallets have a pinned `SignUp.Wallet` row mounted. A plain list of
  // registrants: register appends, cleanup removes one occurrence.
  const [registeredWallets, setRegisteredWallets] = useState<readonly string[]>(
    [],
  )

  const registerWallet = useCallback((walletId: string) => {
    setRegisteredWallets((prev) => [...prev, walletId])
    return () => {
      setRegisteredWallets((prev) => {
        const next = [...prev]
        next.splice(next.indexOf(walletId), 1)
        return next
      })
    }
  }, [])

  const requiresAgreement = !!(termsAndConditionsUrl || privacyPolicyUrl)
  const needsAgreement = requiresAgreement && !agreedToTerms

  const guardAgreement = () => {
    if (!needsAgreement) return true
    setHighlightAgreement(true)
    return false
  }

  return (
    <SignUpContext.Provider
      value={{
        authPending,
        emailAuthMethod,
        setAuthPending,
        needsAgreement,
        guardAgreement,
        setError,
        registeredWallets,
        registerWallet,
      }}
    >
      {error !== null && (
        <div className="zd:flex zd:items-center zd:justify-center zd:h-full zd:min-h-100">
          <div className="zd:flex zd:flex-col zd:gap-4 zd:max-w-md">
            <Text className="zd:text-h2 zd:text-center">Error occurred</Text>
            <Text className="zd:text-center zd:text-red-500">{error}</Text>
            <Button
              action="primary"
              text="Try again"
              onClick={() => setError(null)}
            />
          </div>
        </div>
      )}
      {/* Kept mounted (hidden) during the error takeover so unit state — the
          typed email, pending flags — survives "Try again".
          `-mx-4` cancels Screen's scroll-container padding so this page
          owns its own; inner blocks re-add `zd:px-4` where they need it. */}
      <div
        className={`zd:-mx-4 zd:flex-1 zd:flex zd:flex-col zd:justify-between zd:pb-4 zd:overflow-y-auto zd:overflow-x-hidden${
          error !== null ? ' zd:hidden' : ''
        }`}
      >
        <div className="zd:flex-1 zd:flex zd:flex-col zd:justify-center">
          <div className="zd:px-4 zd:flex zd:flex-col zd:items-center">
            <div className="zd:w-full zd:px-16 zd:py-4">
              <BlobAnimation className="zd:w-full zd:pointer-events-none zd:select-none" />
            </div>
            <Text className="zd:text-h2 zd:text-center">
              Continue to your wallet
            </Text>
            <Text className="zd:mt-2 zd:text-center zd:text-greyScale/50">
              Choose a sign-in method to proceed
            </Text>
          </div>
          <div className="zd:mt-6 zd:mb-4 zd:px-4 zd:flex zd:flex-col zd:gap-2">
            {children}
          </div>
        </div>
        <div className="zd:px-4">
          <SignUpFooter
            termsAndConditionsUrl={termsAndConditionsUrl}
            privacyPolicyUrl={privacyPolicyUrl}
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={(agreed) => {
              setAgreedToTerms(agreed)
              if (agreed) setHighlightAgreement(false)
            }}
            highlight={highlightAgreement}
          />
        </div>
      </div>
    </SignUpContext.Provider>
  )
}

function SignUpDivider({ label = 'or' }: { label?: string }) {
  return (
    <div className="zd:-mx-4 zd:my-2 zd:flex zd:items-center zd:gap-3">
      <div className="zd:h-px zd:flex-1 zd:bg-greyScale/30" />
      <Text className="zd:text-body3">{label}</Text>
      <div className="zd:h-px zd:flex-1 zd:bg-greyScale/30" />
    </div>
  )
}

/** The canonical sign-up page. Takes the root's own props (the consent-gate
 * URLs) and forwards them — per-unit config (e.g. the email method) still
 * means composing the units yourself. */
function SignUpDefault(props: Omit<SignUpRootProps, 'children'>) {
  return (
    <SignUpRoot {...props}>
      <SignUpPasskey />
      <SignUpDivider />
      <SignUpGoogle />
      <SignUpEmail />
    </SignUpRoot>
  )
}

export const SignUp = Object.assign(SignUpRoot, {
  Default: SignUpDefault,
  Passkey: SignUpPasskey,
  Google: SignUpGoogle,
  Email: SignUpEmail,
  Wallet: SignUpWallet,
  WalletConnect: SignUpWalletConnect,
  InstalledWallets: SignUpInstalledWallets,
  MoreWallets: SignUpMoreWallets,
  Divider: SignUpDivider,
})
