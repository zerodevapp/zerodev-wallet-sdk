import { useState } from 'react'
import { useChains } from 'wagmi'

import type { IconName } from '../../shared/components/Icon'
import { Input } from '../../shared/components/Input'
import { Text } from '../../shared/components/Text'
import { TokenListItem } from '../../shared/components/TokenListItem'
import { useSmartRoutingFlow } from '../hooks/useSmartRoutingFlow'

// Loose grouping per the design's "Ethereum Ecosystem" / "Other chains"
// sections. Includes mainnets + corresponding testnets so the demo
// renders something under the first section.
const ETHEREUM_ECOSYSTEM_CHAIN_IDS = new Set<number>([
  1,
  11155111, // mainnet, sepolia
  42161,
  421614, // arbitrum, arbitrumSepolia
  10,
  11155420, // optimism, optimismSepolia
  8453,
  84532, // base, baseSepolia
  137,
  80002, // polygon, polygonAmoy
  130, // unichain
  59144, // linea
  534352,
  534351, // scroll, scrollSepolia
  81457,
  168587773, // blast, blastSepolia
  7777777, // zora
  480, // worldchain
])

const CHAIN_ICON_BY_ID: Record<number, IconName> = {
  1: 'ethereum',
  11155111: 'ethereum',
  42161: 'arbitrum',
  421614: 'arbitrum',
}

interface NetworkRowChain {
  id: number
  name: string
}

function NetworkRow({ chain }: { chain: NetworkRowChain }) {
  const { goBack } = useSmartRoutingFlow()
  const iconName = CHAIN_ICON_BY_ID[chain.id]
  return (
    <TokenListItem
      symbol={chain.name}
      iconVariant="network"
      {...(iconName && { iconName })}
      value="$0.00"
      change="+0.00%"
      onClick={() => goBack?.()}
    />
  )
}

function Section({
  title,
  chains,
}: {
  title: string
  chains: NetworkRowChain[]
}) {
  if (chains.length === 0) return null
  return (
    <div className="flex flex-col gap-1">
      <Text className="text-body2 px-2">{title}</Text>
      <div className="flex flex-col gap-1">
        {chains.map((chain) => (
          <NetworkRow key={chain.id} chain={chain} />
        ))}
      </div>
    </div>
  )
}

export function SelectNetwork() {
  const chains = useChains()
  const [query, setQuery] = useState('')

  const filtered = query
    ? chains.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : chains

  const ethereumEcosystem = filtered.filter((c) =>
    ETHEREUM_ECOSYSTEM_CHAIN_IDS.has(c.id),
  )
  const otherChains = filtered.filter(
    (c) => !ETHEREUM_ECOSYSTEM_CHAIN_IDS.has(c.id),
  )

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2 flex flex-col gap-4">
        <Input
          iconName="search"
          placeholder="Network name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <Section title="Ethereum Ecosystem" chains={ethereumEcosystem} />
        <Section title="Other chains" chains={otherChains} />
      </div>
    </div>
  )
}
