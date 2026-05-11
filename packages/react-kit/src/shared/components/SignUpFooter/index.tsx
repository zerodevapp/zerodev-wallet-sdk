import { AppLogo } from '../AppLogo'
import { Text } from '../Text'

export function SignUpFooter({
  termsAndConditionsUrl,
  privacyPolicyUrl,
  agreedToTerms,
  setAgreedToTerms,
}: {
  termsAndConditionsUrl?: string | undefined
  privacyPolicyUrl?: string | undefined
  agreedToTerms: boolean
  setAgreedToTerms: (agreed: boolean) => void
}) {
  const showAgreement = !!(termsAndConditionsUrl || privacyPolicyUrl)

  return (
    <div className="flex flex-col items-center gap-5">
      {showAgreement && (
        <div className="flex flex-row items-center gap-2">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="cursor-pointer [color-scheme:light]"
          />
          <Text className="flex-1">
            I agree to the{' '}
            {termsAndConditionsUrl && (
              <Text
                as="a"
                href={termsAndConditionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Terms & Conditions
              </Text>
            )}
            {termsAndConditionsUrl && privacyPolicyUrl && ' and '}
            {privacyPolicyUrl && (
              <Text
                as="a"
                href={privacyPolicyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Privacy Policy
              </Text>
            )}
          </Text>
        </div>
      )}
      <AppLogo />
    </div>
  )
}
