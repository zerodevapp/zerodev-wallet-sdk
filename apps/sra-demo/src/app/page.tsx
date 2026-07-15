'use client'

import {
  SmartRoutingAddress,
  type SmartRoutingAddressConfig,
  SmartRoutingAddressProvider,
} from '@zerodev/smart-routing-address-react-ui'
import type { Address } from 'viem'

// Arbitrum mainnet — SRA supports mainnet chains only. Slippage 50 = 0.50%.
const CONFIG: SmartRoutingAddressConfig = {
  targetChainId: 42161,
  slippage: 50,
}

// Hardcoded demo recipient (Vitalik's address) so the SRA flow renders
// immediately on page load. Swap for a wallet-connect flow when the demo
// grows beyond a static preview.
const RECIPIENT: Address = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'

export default function Home() {
  return (
    <main className="sra-demo-main">
      <SmartRoutingAddressProvider config={CONFIG}>
        <SmartRoutingAddress
          recipient={RECIPIENT}
          onClose={() => {
            /* no-op — the demo has nowhere to navigate to */
          }}
        />
      </SmartRoutingAddressProvider>
    </main>
  )
}
