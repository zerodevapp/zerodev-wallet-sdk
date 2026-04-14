import { useSendOTP } from '@zerodev/wallet-react'
import { useState } from 'react'

import { Icon } from '../../shared/components/Icon'
import { Input } from '../../shared/components/Input'
import { ListItem } from '../../shared/components/ListItem'
import { OrView } from '../../shared/components/OrView'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { SignUpFooter } from '../../shared/components/SignUpFooter'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

export function SignUp() {
  const { goToStep, setEmail, setOtpId } = useAuth()
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [emailInput, setEmailInput] = useState('')
  const { mutateAsync: sendOtp, isPending: isEmailLoading } = useSendOTP()
  const [error, setError] = useState<string | null>(null)

  const handleGoogleAuth = () => {
    alert('Google authentication coming soon')
  }

  const handleTwitterAuth = () => {
    alert('Twitter authentication coming soon')
  }

  const handleEmailSubmit = async () => {
    if (!emailInput || isEmailLoading) return

    setError(null)
    try {
      const { otpId } = await sendOtp({ email: emailInput })
      setEmail(emailInput)
      setOtpId(otpId)
      goToStep('otp-input')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  const handleChooseWallet = () => {
    goToStep('wallet-selection')
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col gap-4 max-w-md">
          <Text className="text-h2 text-center">Error occurred</Text>
          <Text className="text-center text-red-500">{error}</Text>
        </div>
      </div>
    )
  }

  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="h-full flex flex-col justify-between pb-6 overflow-y-auto"
        >
          <div className="flex-1 flex flex-col justify-center">
            <div className="flex flex-col items-center gap-4">
              <Text className="text-h2 text-center">
                Continue to your wallet
              </Text>
              <Text className="text-center">
                Choose a sign-in method to proceed
              </Text>
            </div>
            <div className="mt-12 flex flex-col gap-4 mb-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-row items-center gap-1 w-full">
                  <ListItem
                    iconName="google"
                    title="Google"
                    className="flex-1 rounded-3xl"
                    disabled={isEmailLoading}
                    onClick={handleGoogleAuth}
                  />
                  <ListItem
                    iconName="xTwitter"
                    title="X.com"
                    className="flex-1 rounded-3xl"
                    disabled={isEmailLoading}
                    onClick={handleTwitterAuth}
                  />
                </div>
                <Input
                  iconName="email"
                  placeholder="Enter your email..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  type="email"
                  autoCapitalize="none"
                  autoComplete="email"
                  disabled={isEmailLoading}
                  variant="listItemStyle"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailInput && !isEmailLoading) {
                      handleEmailSubmit()
                    }
                  }}
                >
                  {emailInput && !isEmailLoading ? (
                    <button
                      type="button"
                      className="w-13 h-13 rounded-2xl bg-greyScale/[3%] flex items-center justify-center hover:bg-greyScale/[5%] transition-colors"
                      onClick={handleEmailSubmit}
                    >
                      <Icon name="chevronRight" />
                    </button>
                  ) : isEmailLoading ? (
                    <div className="w-13 h-13 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-solarOrange border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : null}
                </Input>
              </div>
              <OrView />
              <ListItem
                iconName="walletOutline"
                title="Choose a wallet instead"
                disabled={isEmailLoading}
                onClick={handleChooseWallet}
                chevron
                className="rounded-3xl"
              />
            </div>
          </div>
          <SignUpFooter
            agreedToTerms={agreedToTerms}
            setAgreedToTerms={setAgreedToTerms}
          />
        </div>
      )}
    </ScreenWrapper>
  )
}
