import { cn } from '../../utils/common'
import { AppLogo } from '../AppLogo'
import { Text } from '../Text'

export function SignUpFooter({
  isAndroidNavButtons = false,
  agreedToTerms,
  setAgreedToTerms,
}: {
  isAndroidNavButtons?: boolean
  agreedToTerms: boolean
  setAgreedToTerms: (agreed: boolean) => void
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-5',
        isAndroidNavButtons && 'pb-8',
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="cursor-pointer"
        />
        <Text className="flex-1">
          I agree to the{' '}
          <Text as="span" className="underline">
            Terms & Conditions
          </Text>{' '}
          and{' '}
          <Text as="span" className="underline">
            Privacy Policy
          </Text>
        </Text>
      </div>
      <div className="gap-1.5 flex flex-row">
        <Text>Powered by:</Text>
        <AppLogo />
      </div>
    </div>
  )
}
