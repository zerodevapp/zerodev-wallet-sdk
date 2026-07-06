'use client'

import {
    SmartRoutingAddress,
    SmartRoutingAddressProvider,
} from '@zerodev/smart-routing-address-react-ui'
import { useRouter } from 'next/navigation'
import { arbitrum } from 'viem/chains'

// Hard-coded recipient for visual iteration on the design. When the flow gets
// wired up for real, this will come from the connected account (useAccount).
const DEMO_RECIPIENT = '0x0000000000000000000000000000000000000001' as const

export const dynamic = 'force-dynamic'

export default function DepositPage() {
    const router = useRouter()

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-neutral-100">
            <div className="w-[400px] h-[810px]">
                <SmartRoutingAddressProvider
                    config={{
                        targetChainId: arbitrum.id,
                        slippage: 50,
                    }}
                >
                    <SmartRoutingAddress
                        recipient={DEMO_RECIPIENT}
                        onClose={() => router.push('/')}
                    />
                </SmartRoutingAddressProvider>
            </div>
        </div>
    )
}
