import { cn, Wrapper } from '@zerodev/react-ui'
import { DataRowSkeleton } from '../DataRow'

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'zd:rounded-lg zd:bg-offWhite/50 zd:animate-pulse',
        className,
      )}
    />
  )
}

function SkeletonCard() {
  return (
    <Wrapper className="zd:rounded-xl zd:p-4 zd:w-full zd:flex zd:flex-col zd:gap-3">
      <div className="zd:flex zd:flex-row zd:items-center zd:gap-3">
        <SkeletonBar className="zd:w-12 zd:h-12 zd:rounded-2xl" />
        <div className="zd:flex zd:flex-col zd:gap-2 zd:flex-1">
          <SkeletonBar className="zd:w-1/2 zd:h-4" />
          <SkeletonBar className="zd:w-1/3 zd:h-3" />
        </div>
      </div>
    </Wrapper>
  )
}

export function SigningPageSkeleton() {
  return (
    <div className="zd:flex zd:flex-col zd:gap-2">
      <SkeletonCard />
      <SkeletonCard />
      <DataRowSkeleton />
    </div>
  )
}
