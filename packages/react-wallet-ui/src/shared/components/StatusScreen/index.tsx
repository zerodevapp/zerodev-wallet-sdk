import { cn, Text } from '@zerodev/react-ui'
import type { ReactNode } from 'react'
import errorImg from '../../../../assets/states/error.png'
import loadingImg from '../../../../assets/states/loading.png'
import sendImg from '../../../../assets/states/send.png'
import successImg from '../../../../assets/states/success.png'

export type StateImageName = 'error' | 'loading' | 'send' | 'success'

const STATE_IMAGES: Record<StateImageName, string> = {
  error: errorImg,
  loading: loadingImg,
  send: sendImg,
  success: successImg,
}

export interface StatusScreenProps {
  imageName: StateImageName
  title: string
  children: ReactNode
  className?: string
}

export function StatusScreen({
  imageName,
  title,
  children,
  className,
}: StatusScreenProps) {
  return (
    <div className={cn('flex flex-col gap-8 items-center', className)}>
      <img
        src={STATE_IMAGES[imageName]}
        alt={imageName}
        className="w-[118px] h-[118px] bg-transparent"
      />
      <div className="flex flex-col gap-4 items-center">
        <Text className="text-h2 text-center whitespace-pre-wrap">{title}</Text>
        <Text className="text-center whitespace-pre-wrap">{children}</Text>
      </div>
    </div>
  )
}
