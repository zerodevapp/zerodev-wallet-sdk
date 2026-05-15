import { useEffect, useRef } from 'react'
import { AppState, type AppStateStatus } from 'react-native'

/**
 * Subscribe to AppState transitions. The handler runs on every transition
 * and is always the latest callback you passed (held in a ref) — you don't
 * need to memoize it for the listener to behave correctly.
 */
export function useAppChangeListener(
  onChange: (state: AppStateStatus) => void,
) {
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      onChangeRef.current(next)
    })
    return () => sub.remove()
  }, [])
}
