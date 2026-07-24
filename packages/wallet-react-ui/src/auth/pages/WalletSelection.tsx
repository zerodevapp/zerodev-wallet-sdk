import { ListItem, ListItemIcon, PoweredBy, Text } from '@zerodev/react-ui'
import { useConnect } from 'wagmi'
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
          goToStep(null)
        },
      },
    )
  }

  return (
    <>
      <div className="zd:flex-1 zd:flex zd:flex-col zd:gap-8 zd:justify-center">
        <Text className="zd:text-h2 zd:text-center">Select your wallet</Text>

        <div className="zd:flex zd:flex-col zd:gap-2">
          {externalConnectors.length === 0 ? (
            <Text className="zd:text-center">
              No wallets detected. Install a browser wallet extension to
              continue.
            </Text>
          ) : (
            externalConnectors.map((connector) => (
              <ListItem
                key={connector.uid}
                title={connector.name}
                icon={
                  connector.icon ? (
                    <img
                      src={connector.icon}
                      alt=""
                      className="zd:w-6 zd:h-6"
                    />
                  ) : (
                    <ListItemIcon name="walletOutline" />
                  )
                }
                disabled={isPending}
                onClick={() => handleSelect(connector)}
                className="zd:rounded-3xl"
              />
            ))
          )}
        </div>
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
