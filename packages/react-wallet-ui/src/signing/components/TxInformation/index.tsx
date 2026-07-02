import { Icon, type IconName, Text, Wrapper } from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface TxInformationProps {
  network?: string | undefined
}

export function TxInformation({ network }: TxInformationProps) {
  return (
    <Wrapper className="zd:rounded-2xl zd:w-full">
      <div className="zd:flex zd:flex-col zd:p-4 zd:gap-2">
        {network && (
          <div className="zd:flex zd:flex-row zd:justify-between">
            <Text>Network</Text>
            <div className="zd:flex zd:flex-row zd:gap-2 zd:items-center">
              <Text className="zd:text-body1">{capitalizeFirst(network)}</Text>
              <div className="zd:h-[18px] zd:w-[18px] zd:bg-white zd:flex zd:items-center zd:justify-center zd:rounded-full">
                <Icon
                  name={network as IconName}
                  className="zd:h-[18px] zd:w-[18px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  )
}
