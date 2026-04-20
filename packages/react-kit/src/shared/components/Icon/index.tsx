import type { FC, SVGProps } from 'react'

type SvgModule = { default: FC<SVGProps<SVGSVGElement>> }

// Eagerly import every .svg from assets/icons/ as a React component
const svgModules = import.meta.glob('../../../../../../assets/icons/*.svg', {
  eager: true,
  query: '?react',
}) as Record<string, SvgModule>

// Build a name → component map:  "check" → check component, "arrow-left" → arrowLeft component
function toCamelCase(str: string) {
  const parts = str.split('-')
  return (
    parts[0] +
    parts
      .slice(1)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  )
}

const icons: Record<string, FC<SVGProps<SVGSVGElement>>> = {}
for (const [path, mod] of Object.entries(svgModules) as [string, SvgModule][]) {
  const filename = path.split('/').pop()?.replace('.svg', '') ?? ''
  const name = toCamelCase(filename)
  icons[name] = mod.default
}

export { icons }

export type IconName = keyof typeof icons

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: string
}

export function Icon({ name, ...props }: IconProps) {
  const Component = icons[name]
  if (!Component) return null
  return <Component {...props} />
}
