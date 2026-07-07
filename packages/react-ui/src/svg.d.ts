declare module '*.svg' {
  import type { FC, SVGProps } from 'react'

  const ReactComponent: FC<SVGProps<SVGSVGElement>>
  export default ReactComponent
}

// Explicit `?react` query imports (vite-plugin-svgr) resolve to the same
// React-component default export.
declare module '*.svg?react' {
  import type { FC, SVGProps } from 'react'

  const ReactComponent: FC<SVGProps<SVGSVGElement>>
  export default ReactComponent
}
