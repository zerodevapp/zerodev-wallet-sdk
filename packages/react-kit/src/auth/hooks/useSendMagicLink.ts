import { useSendOTP } from '@zerodev/wallet-react'
import { useAuth } from './useAuth'

export function useSendMagicLink() {
  const { config: authConfig, setOtpId } = useAuth()
  const { mutateAsync: sendOtp, isPending, error } = useSendOTP()

  async function sendMagicLink({ email }: { email: string }) {
    const baseUrl = authConfig?.magicLinkBaseUrl
    const { otpId } = await sendOtp({
      email,
      ...(baseUrl && {
        emailCustomization: {
          magicLinkTemplate: `${baseUrl}/auth/verify-email?otp=%s&otpSource=email`,
        },
      }),
    })

    setOtpId(otpId)
    return { otpId }
  }

  return { sendMagicLink, isPending, error }
}
