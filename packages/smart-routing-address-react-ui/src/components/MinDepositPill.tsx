import { cn, Icon, Text, Wrapper } from '@zerodev/react-ui'

/**
 * Warning pill at the bottom of `ArrivesCard`: "Minimum deposit  27.88 USDC".
 * Rendered when the minimum deposit exceeds a threshold or is worth calling
 * out to the user.
 */
export function MinDepositPill({
  amount,
  className,
}: {
  amount: string
  className?: string
}) {
  return (
    <Wrapper
      variant="soft"
      className={cn(
        'zd:rounded-[14px] zd:flex zd:gap-2 zd:items-center zd:justify-center zd:px-4 zd:py-2 zd:w-full',
        className,
      )}
      style={{
        height: 36,
        backgroundColor: 'rgba(242, 123, 62, 0.1)',
      }}
    >
      <Text className="zd:text-solarOrange zd:whitespace-nowrap">
        Minimum deposit
      </Text>
      <Icon
        name="info"
        className="zd:w-[14px] zd:h-[14px] zd:opacity-50 zd:text-solarOrange"
      />
      <div className="zd:flex-1" />
      <Text className="zd:text-solarOrange zd:whitespace-nowrap">{amount}</Text>
    </Wrapper>
  )
}
