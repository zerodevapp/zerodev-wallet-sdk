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
      className="zd:w-full zd:py-5 zd:px-4 zd:flex zd:flex-col zd:gap-4 zd:rounded-xl"
      variant="solid"
    >
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-2">
        <Icon name="info" className="zd:h-3.5 zd:w-3.5 zd:text-solarOrange" />
        <Text className="zd:text-body1">{title}</Text>
      </div>
      <Text className="zd:text-body3 zd:break-all">{description}</Text>
    </Wrapper>
  )
}
