import { Text } from '../Text'

export function OrView() {
  return (
    <div className="gap-2 flex flex-row items-center">
      <div className="flex-1 h-px bg-greyScale/30" />
      <Text className="text-body3 text-greyScale/30">or</Text>
      <div className="flex-1 h-px bg-greyScale/30" />
    </div>
  )
}
