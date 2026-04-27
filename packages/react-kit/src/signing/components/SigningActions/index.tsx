import { Button } from '../../../shared/components/Button'
import { Text } from '../../../shared/components/Text'
import { Wrapper } from '../../../shared/components/Wrapper'

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
  return (
    <Wrapper className="p-1 gap-2 mb-1.5 -mx-1.5 rounded-3xl">
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
      <Text className="self-center text-body3">
        By continuing, you accept the{' '}
        <Text as="span" className="underline">
          Terms
        </Text>{' '}
        and{' '}
        <Text as="span" className="underline">
          Privacy Policy
        </Text>
      </Text>
    </Wrapper>
  )
}
