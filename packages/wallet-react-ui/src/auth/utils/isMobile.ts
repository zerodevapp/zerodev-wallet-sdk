export function isMobile() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(pointer: coarse)')?.matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|Opera Mini/u.test(
      navigator.userAgent,
    )
  )
}
