import { Icon, Text, Wrapper } from '@zerodev/react-ui'
import { useState } from 'react'
import { DataRow } from '../DataRow'

export interface TxDetailsItemProps {
  title: string
  index: number
  data: Record<string, string>
}

export function TxDetailsItem({ title, index, data }: TxDetailsItemProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Wrapper className="w-full flex flex-col rounded-xl gap-2" variant="ghost">
      <Wrapper className="w-full h-[68px] rounded-xl p-4 flex flex-row justify-between items-center">
        <div className="flex flex-row gap-2 items-center">
          <div className="w-11 h-11 bg-white flex items-center justify-center rounded-xl">
            <Text className="text-body1">{index}</Text>
          </div>
          <Text className="text-body1">{title}</Text>
        </div>
        <button
          type="button"
          onClick={() => {
            setExpanded(!expanded)
          }}
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          className="cursor-pointer"
        >
          <Icon
            name={expanded ? 'chevronUp' : 'chevronDown'}
            className="w-4 h-4"
          />
        </button>
      </Wrapper>
      {expanded && (
        <div className="flex flex-col px-5 pb-2 gap-2">
          {Object.entries(data).map(([label, value]) => (
            <DataRow key={label} label={label} value={value} />
          ))}
        </div>
      )}
    </Wrapper>
  )
}
