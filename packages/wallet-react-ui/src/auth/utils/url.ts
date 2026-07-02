export function hasMagicLinkCodeInUrl(): boolean {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).has('code')
}

export function stripMagicLinkCodeFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (!url.searchParams.has('code')) return
  url.searchParams.delete('code')
  window.history.replaceState(null, '', url.toString())
}
