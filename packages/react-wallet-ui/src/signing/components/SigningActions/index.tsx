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
    <Wrapper className="p-1 gap-2 mb-1.5 rounded-3xl">
      <div className="flex flex-row items-center gap-1">
        <Button
          text="Reject"
          action="secondary"
          className="flex-1"
          onClick={onReject}
        />
        <Button
          text="Confirm"
          className="flex-1"
          disabled={disabled}
          onClick={onConfirm}
        />
      </div>
      {showAgreement && (
        <Text className="text-center text-body3 mt-2">
          By continuing, you accept the{' '}
          {termsAndConditionsUrl && (
            <Text
              as="a"
              href={termsAndConditionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-body3"
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
              className="underline text-body3"
            >
              Privacy Policy
            </Text>
          )}
        </Text>
      )}
    </Wrapper>
  )
}
