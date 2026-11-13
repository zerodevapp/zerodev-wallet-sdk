import { useEffect, useState } from 'react'

const PORTAL_ROOT_ID = 'zd-portal-root'

/** Find or create the SDK's singleton portal root, a `.zd-scope` div on
 * document.body. Portals target it instead of body so their content stays
 * inside the scoped reset from reset.css with no per-component class. */
export function getZdPortalRoot(): HTMLElement {
  let root = document.getElementById(PORTAL_ROOT_ID)
  if (!root) {
    root = document.createElement('div')
    root.id = PORTAL_ROOT_ID
    root.className = 'zd-scope'
    document.body.appendChild(root)
  }
  return root
}

/** Default `container` for Radix portals: the shared root. It is a child of
 * document.body, so it inherits the theme (`data-zd-*` and `--zd-*`) from
 * `<html>`, and no host transform or overflow can clip what lands in it.
 * The root resolves in an effect, so SSR and the first client render return
 * undefined and Radix falls back to document.body. That window is harmless.
 * Tooltips and dropdowns only open after mount, and by then the root exists. */
export function useZdPortalContainer(): HTMLElement | undefined {
  const [root, setRoot] = useState<HTMLElement>()
  useEffect(() => {
    setRoot(getZdPortalRoot())
  }, [])
  return root
}
