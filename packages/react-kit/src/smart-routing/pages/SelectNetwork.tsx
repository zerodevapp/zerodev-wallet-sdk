import { useState } from 'react'
import type { Chain } from 'viem'
import { useChains } from 'wagmi'

import { Input } from '../../shared/components/Input'
import { TokenListItem } from '../../shared/components/TokenListItem'
import { useSmartRoutingFlow } from '../hooks/useSmartRoutingFlow'
import { getChainIcon } from '../utils/chainIcon'

function NetworkRow({
  chain,
  onSelect,
}: {
  chain: Chain
  onSelect: (chain: Chain) => void
}) {
  const iconName = getChainIcon(chain.id)
  return (
    <TokenListItem
      symbol={chain.name}
      iconVariant="network"
      {...(iconName && { iconName })}
      onClick={() => onSelect(chain)}
    />
  )
}

export function SelectNetwork() {
  const wagmiChains = useChains()
  const {
    editingChainSlot,
    sendChain,
    receiveChain,
    sourceChains,
    destinationChains,
    setChain,
    setEditingChainSlot,
    goBack,
  } = useSmartRoutingFlow()
  const [query, setQuery] = useState('')

  // Pick the slot-specific list from the connector's SRA config (which lists
  // SRA-supported mainnets) so the picker doesn't surface chains the API
  // would reject. Falls back to wagmi's chains if the consumer didn't
  // configure source/destination lists.
  const chains =
    editingChainSlot === 'send'
      ? (sourceChains ?? wagmiChains)
      : editingChainSlot === 'receive'
        ? (destinationChains ?? wagmiChains)
        : wagmiChains

  const filtered = query
    ? chains.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : chains

  // Picking the chain that's currently in the *other* slot swaps the two,
  // since Across can't quote a same-chain route.
  const handleSelect = (chain: Chain) => {
    if (!editingChainSlot) {
      goBack?.()
      return
    }
    const otherSlot = editingChainSlot === 'send' ? 'receive' : 'send'
    const otherChain = editingChainSlot === 'send' ? receiveChain : sendChain
    const currentChain = editingChainSlot === 'send' ? sendChain : receiveChain
    if (otherChain && otherChain.id === chain.id && currentChain) {
      setChain(otherSlot, currentChain)
    }
    setChain(editingChainSlot, chain)
    setEditingChainSlot(null)
    goBack?.()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 pb-2 flex flex-col gap-4">
        <Input
          iconName="search"
          placeholder="Network name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          {filtered.map((chain) => (
            <NetworkRow key={chain.id} chain={chain} onSelect={handleSelect} />
          ))}
        </div>
      </div>
    </div>
  )
}
