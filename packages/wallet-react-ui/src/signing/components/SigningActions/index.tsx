import { Button, Text, Wrapper } from '@zerodev/react-ui'
import { useAuth } from '../../../auth/hooks/useAuth'

interface SigningActionsProps {
  onConfirm: () => void
  onReject: () => void
  disabled?: boolean
}

export function SigningActions({
  onConfirm,
  onReject,
  disabled,
}: SigningActionsProps) {
  const { config } = useAuth()
  const termsAndConditionsUrl = config?.termsAndConditionsUrl
  const privacyPolicyUrl = config?.privacyPolicyUrl
  const showAgreement = !!(termsAndConditionsUrl || privacyPolicyUrl)

  return (
    <Wrapper className="zd:p-1 zd:gap-2 zd:mb-1.5 zd:rounded-3xl">
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-1">
        <Button
          text="Reject"
          action="secondary"
          className="zd:flex-1"
          onClick={onReject}
        />
        <Button
          text="Confirm"
          className="zd:flex-1"
          disabled={disabled}
          onClick={onConfirm}
        />
      </div>
      {showAgreement && (
        <Text className="zd:text-center zd:text-body3 zd:mt-2">
          By continuing, you accept the{' '}
          {termsAndConditionsUrl && (
            <Text
              as="a"
              href={termsAndConditionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="zd:underline zd:text-body3"
            >
              Terms
            </Text>
          )}
          {termsAndConditionsUrl && privacyPolicyUrl && ' and '}
          {privacyPolicyUrl && (
            <Text
              as="a"
              href={privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="zd:underline zd:text-body3"
            >
              Privacy Policy
            </Text>
          )}
        </Text>
      )}
    </Wrapper>
  )
}
