import { Icon } from '../Icon'
import { Text } from '../Text'
import { Wrapper } from '../Wrapper'

export interface CalloutProps {
  title: string
  description: string
}

export function Callout({ title, description }: CalloutProps) {
  return (
    <Wrapper
      className="w-full py-5 px-4 flex flex-col gap-4 rounded-xl"
      variant="solid"
    >
      <div className="flex flex-row items-center gap-2">
        <Icon name="info" className="h-3.5 w-3.5 text-solarOrange" />
        <Text className="text-body1">{title}</Text>
      </div>
      <Text className="text-body3 break-all">{description}</Text>
    </Wrapper>
  )
}
