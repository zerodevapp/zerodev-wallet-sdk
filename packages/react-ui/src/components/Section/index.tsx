import { type ReactNode, useState } from 'react'
import { Icon, type IconName } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface SectionProps {
  title: string
  iconName: IconName
  children: ReactNode
  /** `undefined` (default) → static, no toggle. `false` → collapsible,
   * starts expanded. `true` → collapsible, starts collapsed. */
  collapsible?: boolean
}

export function Section({
  title,
  iconName,
  collapsible,
  children,
}: SectionProps) {
  const [collapsed, setCollapsed] = useState(collapsible === true)

  return (
    <Wrapper className="zd:p-4 zd:flex zd:flex-col zd:gap-3 zd:rounded-xl zd:w-full">
      <div className="zd:flex zd:flex-row zd:justify-between zd:items-center">
        <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
          <Icon name={iconName} className="zd:h-4 zd:w-4 zd:text-solarOrange" />
          <Text className="zd:text-h3">{title}</Text>
        </div>
        {collapsible !== undefined && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="zd:flex zd:items-center zd:justify-center zd:cursor-pointer"
          >
            <Icon
              name={collapsed ? 'chevronDown' : 'chevronUp'}
              className="zd:w-4 zd:h-4 zd:text-greyScale"
            />
          </button>
        )}
      </div>
      {!collapsed && children}
    </Wrapper>
  )
}
