import { type ReactNode, useState } from 'react'

import { Icon, type IconName } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
import { Wrapper } from '../../../shared/components/Wrapper'

export interface DetailsContainerProps {
  title: string
  iconName: IconName
  children: ReactNode
  collapsible?: boolean
}

export function DetailsContainer({
  title,
  iconName,
  collapsible,
  children,
}: DetailsContainerProps) {
  const [collapsed, setCollapsed] = useState(collapsible === true)

  return (
    <Wrapper className="p-4 flex flex-col gap-3 rounded-xl w-full">
      <div className="flex flex-row justify-between items-center">
        <div className="flex flex-row items-center gap-2">
          <Icon name={iconName} className="h-4 w-4 text-solarOrange" />
          <Text className="text-h3">{title}</Text>
        </div>
        {collapsible !== undefined && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center justify-center cursor-pointer"
          >
            <Icon
              name={collapsed ? 'chevronDown' : 'chevronUp'}
              className="w-4 h-4 text-greyScale"
            />
          </button>
        )}
      </div>
      {!collapsed && children}
    </Wrapper>
  )
}
