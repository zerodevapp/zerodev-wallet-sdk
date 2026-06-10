import { useState } from 'react'
import { type Address, zeroAddress } from 'viem'
import { arbitrum, mainnet } from 'viem/chains'
import { useAccount } from 'wagmi'

import { Button } from '../../shared/components/Button'
import { Select } from '../../shared/components/Select'
import { Text } from '../../shared/components/Text'
import { DataRow } from '../../signing/components/DataRow'
import { DetailsContainer } from '../../signing/components/DetailsContainer'
import { AddressDisplay } from '../components/AddressDisplay'
import { useSmartRoutingAddress } from '../hooks/useSmartRoutingAddress'
import { useSmartRoutingFlow } from '../hooks/useSmartRoutingFlow'
import { getChainIcon } from '../utils/chainIcon'

const PLACEHOLDER_ADDRESS = '0x0000000000000000000000000000000000000000'

interface TransferFromWalletProps {
  onGotIt: () => void
  onShowQr: (address: string) => void
  onSelectNetwork: () => void
}

export function TransferFromWallet({
  onGotIt,
  onShowQr,
  onSelectNetwork,
}: TransferFromWalletProps) {
  const { address: connectedAddress } = useAccount()
  const { sendChain, receiveChain, setEditingChainSlot } = useSmartRoutingFlow()

  const sendChainIcon = getChainIcon(sendChain?.id) ?? 'arbitrum'
  const receiveChainIcon = getChainIcon(receiveChain?.id) ?? 'arbitrum'

  const openChainPicker = (slot: 'send' | 'receive') => {
    setEditingChainSlot(slot)
    onSelectNetwork()
  }
  // The SRA refetches whenever the user picks a new chain in either slot.
  // We use a specific token (USDC) — the SRA API's Across simulation cannot
  // quote a route when the src/dest tokens resolve to a generic FLEX
  // placeholder. Defaults fall back to mainnet/arbitrum (which the SRA API
  // supports) until the user makes a selection.
  const { data, error, isPending } = useSmartRoutingAddress({
    owner: (connectedAddress ?? zeroAddress) as Address,
    destChain: receiveChain ?? arbitrum,
    srcTokens: [{ tokenType: 'USDC', chain: sendChain ?? mainnet }],
  })
  const address = data?.smartRoutingAddress ?? PLACEHOLDER_ADDRESS
  const canCopy = !!data?.smartRoutingAddress

  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    if (!canCopy) return
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 bg-white/20 backdrop-blur-md border border-offWhite rounded-2xl p-1">
            <AddressDisplay
              address={
                isPending
                  ? 'Loading...'
                  : error
                    ? 'Error loading address'
                    : address
              }
              onQrClick={() => canCopy && onShowQr(address)}
            />
            <Button
              action="primary"
              text={copied ? 'Copied!' : 'Copy Address'}
              iconName={copied ? 'check' : 'copy'}
              trailIcon
              disabled={!canCopy}
              onClick={handleCopy}
              className="h-13"
            />
          </div>

          <SectionCard label="Send">
            <Select
              label="ETH"
              iconName="ethereum"
              className="flex-1 basis-0"
            />
            <Select
              label={sendChain?.name ?? 'Arbitrum'}
              iconName={sendChainIcon}
              className="flex-1 basis-0"
              onClick={() => openChainPicker('send')}
            />
          </SectionCard>

          <SectionCard label="Receive">
            <Select
              label="USDC"
              leadingImage="https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png"
              trailingIcon={false}
              variant="ghost"
              className="flex-1 basis-0"
            />
            <Select
              label={receiveChain?.name ?? 'Arbitrum'}
              iconName={receiveChainIcon}
              trailingIcon={false}
              variant="ghost"
              className="flex-1 basis-0"
              onClick={() => openChainPicker('receive')}
            />
          </SectionCard>

          <DetailsContainer
            title="Transaction details"
            iconName="arrowSwapHorizontal"
          >
            <DataRow
              label="Routing costs"
              value="0.00008 ETH ($0.28)"
              iconName="gasStation"
            />
            <DataRow
              label="Price impact"
              value="< 0.25%"
              iconName="dollarCircle"
            />
            <DataRow label="Price" value="≈ 1 sec" iconName="clock" />
            <DataRow label="Slippage" value="0.5 %" iconName="settings" />
            <DataRow label="Time" value="≈ 1 sec" iconName="clock" />
          </DetailsContainer>
        </div>
      </div>

      <div className="border border-offWhite bg-offWhite/40 backdrop-blur-md rounded-[28px] p-1">
        <Button action="secondary" text="Got it" onClick={onGotIt} />
      </div>
    </div>
  )
}

function SectionCard({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col bg-white/20 backdrop-blur-md border border-offWhite rounded-2xl p-1">
      <div className="px-2 py-3">
        <Text className="text-body2">{label}</Text>
      </div>
      <div className="flex flex-row gap-1 items-stretch">{children}</div>
    </div>
  )
}
