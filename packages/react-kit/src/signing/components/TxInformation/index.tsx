import { Icon, type IconName } from '../../../shared/components/Icon'
import { Text } from '../../../shared/components/Text'
import { Wrapper } from '../../../shared/components/Wrapper'
import { capitalizeFirst } from '../../../shared/utils/common'

export interface Dapp {
  name: string | undefined
  domain: string | undefined
  network?: string
  imageSource: string
}

export interface TxInformationProps {
  dapp: Dapp
}

export function TxInformation({ dapp }: TxInformationProps) {
  const { name, domain, network, imageSource } = dapp

  return (
    <Wrapper className="rounded-2xl w-full">
      <div className="flex flex-row justify-between items-center p-4">
        <div className="flex flex-row gap-2 items-center">
          <img
            src={imageSource}
            alt=""
            className="w-11 h-11 rounded-xl object-cover"
          />
          <div className="flex flex-col">
            <Text>Request from</Text>
            <Text className="text-body1">{name}</Text>
          </div>
        </div>
      </div>
      <div className="h-px bg-offWhite/50" />
      <div className="flex flex-col pt-2 pb-4 px-4 gap-2">
        <div className="flex flex-row justify-between">
          <Text>Domain</Text>
          <Text className="text-body1">{domain ?? 'Unknown'}</Text>
        </div>
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
