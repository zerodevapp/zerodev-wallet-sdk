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
    <div
      className={cn('zd:flex zd:flex-col zd:gap-8 zd:items-center', className)}
    >
      <img
        src={STATE_IMAGES[imageName]}
        alt={imageName}
        className="zd:w-[118px] zd:h-[118px] zd:bg-transparent"
      />
      <div className="zd:flex zd:flex-col zd:gap-4 zd:items-center">
        <Text className="zd:text-h2 zd:text-center zd:whitespace-pre-wrap">
          {title}
        </Text>
        <Text className="zd:text-center zd:whitespace-pre-wrap">
          {children}
        </Text>
      </div>
    </div>
  )
}
