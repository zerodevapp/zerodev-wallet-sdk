import { Text } from '@zerodev/react-ui'

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

  // PoweredBy moved to the Screen's fixed footer zone — without an agreement
  // block there is nothing left to render.
  if (!showAgreement) return null

  return (
    <div className="zd:flex zd:flex-col zd:items-center zd:gap-5">
      {showAgreement && (
        <div
          className={`zd:flex zd:flex-row zd:items-center zd:gap-2 zd:rounded-md zd:p-2 zd:transition-colors ${
            highlight
              ? 'zd:border zd:border-negative'
              : 'zd:border zd:border-transparent'
          }`}
        >
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="zd:cursor-pointer zd:[color-scheme:light]"
          />
          <Text className="zd:flex-1">
            I agree to the{' '}
            {termsAndConditionsUrl && (
              <Text
                as="a"
                href={termsAndConditionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="zd:underline"
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
                className="zd:underline"
              >
                Privacy Policy
              </Text>
            )}
          </Text>
        </div>
      )}
    </div>
  )
}
