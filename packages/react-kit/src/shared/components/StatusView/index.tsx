import type { ReactNode } from 'react'

import errorImg from '../../../../../../assets/states/error.png'
import loadingImg from '../../../../../../assets/states/loading.png'
import sendImg from '../../../../../../assets/states/send.png'
import successImg from '../../../../../../assets/states/success.png'
import { cn } from '../../utils/common'

export type StateImageName = 'error' | 'loading' | 'send' | 'success'

const STATE_IMAGES: Record<StateImageName, string> = {
  error: errorImg,
  loading: loadingImg,
  send: sendImg,
  success: successImg,
}

export interface StatusViewProps {
  imageName: StateImageName
  title: string
  children: ReactNode
  className?: string
}

export function StatusView({
  imageName,
  title,
  children,
  className,
}: StatusViewProps) {
  return (
    <div className={cn('flex flex-col gap-8 items-center', className)}>
      <img
        src={STATE_IMAGES[imageName]}
        alt={imageName}
        className="w-[118px] h-[118px] bg-transparent"
      />
      <div className="flex flex-col gap-4 items-center">
        <h2 className="text-2xl font-semibold text-center">{title}</h2>
        <p className="text-base text-center">{children}</p>
      </div>
    </div>
  )
}
