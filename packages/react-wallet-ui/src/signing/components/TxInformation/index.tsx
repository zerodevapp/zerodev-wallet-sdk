import { Icon, type IconName, Text, Wrapper } from '@zerodev/react-ui'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface TxInformationProps {
  network?: string | undefined
}

export function TxInformation({ network }: TxInformationProps) {
  return (
    <Wrapper className="rounded-2xl w-full">
      <div className="flex flex-col p-4 gap-2">
        {network && (
          <div className="flex flex-row justify-between">
            <Text>Network</Text>
            <div className="flex flex-row gap-2 items-center">
              <Text className="text-body1">{capitalizeFirst(network)}</Text>
              <div className="h-[18px] w-[18px] bg-white flex items-center justify-center rounded-full">
                <Icon
                  name={network as IconName}
                  className="h-[18px] w-[18px]"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Wrapper>
  )
}
