import { cn, Wrapper } from '@zerodev/react-ui'
import { DataRowSkeleton } from '../DataRow'

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg bg-offWhite/50 animate-pulse', className)} />
  )
}

function SkeletonCard() {
  return (
    <Wrapper className="rounded-xl p-4 w-full flex flex-col gap-3">
      <div className="flex flex-row items-center gap-3">
        <SkeletonBar className="w-12 h-12 rounded-2xl" />
        <div className="flex flex-col gap-2 flex-1">
          <SkeletonBar className="w-1/2 h-4" />
          <SkeletonBar className="w-1/3 h-3" />
        </div>
      </div>
    </Wrapper>
  )
}

export function SigningPageSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <SkeletonCard />
      <SkeletonCard />
      <DataRowSkeleton />
    </div>
  )
}
