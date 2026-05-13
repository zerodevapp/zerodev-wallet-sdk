import { useConnect } from 'wagmi'
import { AppLogo } from '../../shared/components/AppLogo'
import { ListItem } from '../../shared/components/ListItem'
import { ScreenWrapper } from '../../shared/components/ScreenWrapper'
import { Text } from '../../shared/components/Text'
import { useAuth } from '../hooks/useAuth'

export function WalletSelection() {
  const { goToStep } = useAuth()
  const { connect, connectors, isPending } = useConnect()

  const externalConnectors = connectors.filter((c) => c.id !== 'zerodev-wallet')

  const handleSelect = (connector: (typeof connectors)[number]) => {
    connect(
      { connector },
      {
        onSuccess: () => {
          goToStep('sign-up')
        },
      },
    )
  }

  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div
          style={{ paddingTop: `${paddingTop}px` }}
          className="flex flex-1 flex-col h-full"
        >
          <div className="flex-1 flex flex-col gap-8 justify-center">
            <Text className="text-h2 text-center">Select your wallet</Text>

            <div className="flex flex-col gap-2">
              {externalConnectors.length === 0 ? (
                <Text className="text-center">
                  No wallets detected. Install a browser wallet extension to
                  continue.
                </Text>
              ) : (
                externalConnectors.map((connector) => (
                  <ListItem
                    key={connector.uid}
                    title={connector.name}
                    iconName="walletOutline"
                    {...(connector.icon ? { imageUri: connector.icon } : {})}
                    disabled={isPending}
                    onClick={() => handleSelect(connector)}
                    className="rounded-3xl"
                  />
                ))
              )}
            </div>
          </div>

          <AppLogo className="self-center pt-4 pb-6" />
        </div>
      )}
    </ScreenWrapper>
  )
}
