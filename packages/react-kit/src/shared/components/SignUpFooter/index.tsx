import { AppLogo } from '../AppLogo'
import { Text } from '../Text'

export function SignUpFooter({
  agreedToTerms,
  setAgreedToTerms,
}: {
  agreedToTerms: boolean
  setAgreedToTerms: (agreed: boolean) => void
}) {
  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex flex-row items-center gap-2">
        <input
          type="checkbox"
          checked={agreedToTerms}
          onChange={(e) => setAgreedToTerms(e.target.checked)}
          className="cursor-pointer"
        />
        <Text className="flex-1">
          I agree to the{' '}
          <Text
            as="a"
            href="https://zerodev.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Terms & Conditions
          </Text>{' '}
          and{' '}
          <Text
            as="a"
            href="https://zerodev.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Privacy Policy
          </Text>
        </Text>
      </div>
      <div className="gap-1.5 flex flex-row items-center">
        <Text>Powered by:</Text>
        <AppLogo />
      </div>
    </div>
  )
}
