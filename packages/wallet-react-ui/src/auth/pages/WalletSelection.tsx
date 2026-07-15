import { ListItem, Text } from '@zerodev/react-ui'
import { useConnect } from 'wagmi'
import { useStore } from 'zustand'
import { PoweredBy } from '../../shared/components/PoweredBy'
import { useKitStore } from '../../shared/hooks/useKitStore'
import { useAuth } from '../hooks/useAuth'
import { WALLET_GUIDE } from '../walletGuide'

export function WalletSelection() {
  const { goToStep } = useAuth()
  const { connect, connectors, isPending } = useConnect()
  const walletConnectProjectId = useStore(
    useKitStore(),
    (s) => s.walletConnectProjectId,
  )

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
                iconName="walletOutline"
                {...(connector.icon ? { imageUri: connector.icon } : {})}
                disabled={isPending}
                onClick={() => handleSelect(connector)}
                className="zd:rounded-3xl"
              />
            ))
          )}
        </div>

        <div className="zd:flex zd:flex-col zd:gap-2">
          {walletConnectProjectId && (
            <ListItem
              title="WalletConnect"
              iconName="walletOutline"
              chevron
              disabled={isPending}
              onClick={() => goToStep('wallet-connect')}
              className="zd:rounded-3xl"
            />
          )}
          <Text className="zd:text-body3 zd:text-greyScale/50">
            More wallets
          </Text>
          {WALLET_GUIDE.map((wallet) => (
            <ListItem
              key={wallet.id}
              title={wallet.name}
              imageUri={wallet.icon}
              disabled={isPending}
              onClick={() =>
                window.open(wallet.downloadUrl, '_blank', 'noopener')
              }
              className="zd:rounded-3xl"
            />
          ))}
        </div>
      </div>

      <PoweredBy className="zd:self-center zd:pt-4 zd:pb-6" />
    </>
  )
}
