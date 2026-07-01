import { Text } from '@zerodev/react-ui'
import { PoweredBy } from '../PoweredBy'

export function SignUpFooter({
  termsAndConditionsUrl,
  privacyPolicyUrl,
  agreedToTerms,
  setAgreedToTerms,
  highlight = false,
}: {
  termsAndConditionsUrl?: string | undefined
  privacyPolicyUrl?: string | undefined
  agreedToTerms: boolean
  setAgreedToTerms: (agreed: boolean) => void
  highlight?: boolean
}) {
  const showAgreement = !!(termsAndConditionsUrl || privacyPolicyUrl)

  return (
    <div className="flex flex-col items-center gap-5">
      {showAgreement && (
        <div
          className={`flex flex-row items-center gap-2 rounded-md p-2 transition-colors ${
            highlight ? 'border border-negative' : 'border border-transparent'
          }`}
        >
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
      <PoweredBy />
    </div>
  )
}
