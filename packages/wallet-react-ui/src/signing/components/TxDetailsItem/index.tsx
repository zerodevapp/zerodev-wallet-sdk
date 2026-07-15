import { DataRow, Icon, Text, Wrapper } from '@zerodev/react-ui'
import { useState } from 'react'
import { camelCaseToTitle } from '../../../shared/utils/common'

export interface TxDetailsItemProps {
  title: string
  index: number
  data: Record<string, string>
}

export function TxDetailsItem({ title, index, data }: TxDetailsItemProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Wrapper
      className="zd:w-full zd:flex zd:flex-col zd:rounded-xl zd:gap-2"
      variant="ghost"
    >
      <Wrapper className="zd:w-full zd:h-[68px] zd:rounded-xl zd:p-4 zd:flex zd:flex-row zd:justify-between zd:items-center">
        <div className="zd:flex zd:flex-row zd:gap-2 zd:items-center">
          <div className="zd:w-11 zd:h-11 zd:bg-white zd:flex zd:items-center zd:justify-center zd:rounded-xl">
            <Text className="zd:text-body1">{index}</Text>
          </div>
          <Text className="zd:text-body1">{title}</Text>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="zd:cursor-pointer"
        >
          <Icon
            name={expanded ? 'chevronUp' : 'chevronDown'}
            className="zd:w-4 zd:h-4"
          />
        </button>
      </Wrapper>
      {expanded && (
        <div className="zd:flex zd:flex-col zd:px-5 zd:pb-2 zd:gap-2">
          {Object.entries(data).map(([label, value]) => (
            // Object keys are raw camelCase (e.g. "gasFee"); the primitive
            // DataRow renders labels verbatim, so title-case them here.
            <DataRow
              key={label}
              label={camelCaseToTitle(label)}
              value={value}
            />
          ))}
        </div>
      )}
    </Wrapper>
  )
}
