import { StatusView } from '../../shared/components/StatusView'

export function Verifying() {
  return (
    <div className="flex flex-col gap-6 w-full max-w-md">
      <StatusView imageName="loading" title="Verifying...">
        Please wait while we verify your code.
      </StatusView>
    </div>
  )
}
