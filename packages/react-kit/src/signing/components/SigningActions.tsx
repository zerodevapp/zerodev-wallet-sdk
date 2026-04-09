interface SigningActionsProps {
  confirm: () => void
  reject: () => void
}

export function SigningActions({ confirm, reject }: SigningActionsProps) {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={reject}
        className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
      >
        Reject
      </button>
      <button
        type="button"
        onClick={confirm}
        className="flex-1 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800 transition-colors cursor-pointer"
      >
        Confirm
      </button>
    </div>
  )
}
