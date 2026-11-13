import { createContext, useContext, useEffect, useState } from 'react'

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

/** The portal root, once it exists; `undefined` during SSR and the first
 * client render. */
export function useZdPortalRoot(): HTMLElement | undefined {
  const [root, setRoot] = useState<HTMLElement>()
  useEffect(() => {
    setRoot(getZdPortalRoot())
  }, [])
  return root
}

/** The portal container a `Screen` gives its subtree: a child of the portal
 * root that carries that frame's theme, so what portals out of the frame is
 * themed like the frame. `null` outside a Screen. */
export const PortalContainerContext = createContext<HTMLElement | null>(null)

/** Default `container` for Radix portals: the enclosing Screen's container,
 * else the shared root. Both resolve in an effect, so SSR and the first
 * client render return undefined and Radix falls back to document.body.
 * That window is harmless. Tooltips and dropdowns only open after mount,
 * and by then the container exists. */
export function useZdPortalContainer(): HTMLElement | undefined {
  const scoped = useContext(PortalContainerContext)
  const root = useZdPortalRoot()
  return scoped ?? root
}
