import { Icon, Input } from '@zerodev/react-ui'
import { useSendMagicLink, useSendOTP } from '@zerodev/wallet-react'
import { useState } from 'react'
import { isValidEmailAddress } from '../../../shared/utils/common'
import { useAuth } from '../../hooks/useAuth'
import { useReportPending, useSignUpContext } from './context'

/** Email input row: sends an OTP or magic link depending on the root's
 * `emailAuthMethod`, then advances to the matching verification step. */
export function SignUpEmail() {
  const { goToStep, setEmail, setOtpSession } = useAuth()
  const {
    authPending,
    emailAuthMethod,
    needsAgreement,
    guardAgreement,
    setError,
  } = useSignUpContext()
  const [emailInput, setEmailInput] = useState('')

  const shouldUseOtp = emailAuthMethod === 'otp'
  const { mutateAsync: sendOtp, isPending: isSendOtpPending } = useSendOTP()
  const { mutateAsync: sendMagicLink, isPending: isSendMagicLinkPending } =
    useSendMagicLink()
  const isEmailLoading = isSendOtpPending || isSendMagicLinkPending
  useReportPending(isEmailLoading)

  const handleSubmit = async () => {
    if (!emailInput || authPending) return
    if (!isValidEmailAddress(emailInput)) return
    if (!guardAgreement()) return

    setError(null)
    try {
      const send = shouldUseOtp ? sendOtp : sendMagicLink
      const { otpId, otpEncryptionTargetBundle } = await send({
        email: emailInput,
      })
      setEmail(emailInput)
      setOtpSession({ otpId, otpEncryptionTargetBundle })
      goToStep(shouldUseOtp ? 'otp-input' : 'email-verification')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to send verification code',
      )
    }
  }

  return (
    <Input
      iconName="email"
      placeholder="Enter your email"
      value={emailInput}
      onChange={(e) => setEmailInput(e.target.value)}
      type="email"
      autoCapitalize="none"
      autoComplete="email"
      disabled={authPending}
      variant="listItemStyle"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && emailInput && !authPending) {
          handleSubmit()
        }
      }}
    >
      {isEmailLoading ? (
        <div className="zd:w-13 zd:h-13 zd:flex zd:items-center zd:justify-center">
          <div className="zd:w-5 zd:h-5 zd:border-2 zd:border-solarOrange zd:border-t-transparent zd:rounded-full zd:animate-spin" />
        </div>
      ) : (
        <button
          type="button"
          disabled={!isValidEmailAddress(emailInput) || needsAgreement}
          className={`zd:w-13 zd:h-13 zd:rounded-2xl zd:flex zd:items-center zd:justify-center zd:transition-colors ${
            isValidEmailAddress(emailInput) && !needsAgreement
              ? 'zd:cursor-pointer'
              : 'zd:cursor-not-allowed zd:opacity-50'
          }`}
          onClick={() => handleSubmit()}
        >
          <Icon name="chevronRight" className="zd:text-greyScale" />
        </button>
      )}
    </Input>
  )
}
