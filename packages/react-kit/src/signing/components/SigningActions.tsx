import { Button } from '../../shared/components/Button'

interface SigningActionsProps {
  confirm: () => void
  reject: () => void
}

export function SigningActions({ confirm, reject }: SigningActionsProps) {
  return (
    <div className="flex gap-3">
      <Button text="Reject" onClick={reject} action="secondary" />
      <Button text="Confirm" onClick={confirm} action="primary" />
    </div>
  )
}
