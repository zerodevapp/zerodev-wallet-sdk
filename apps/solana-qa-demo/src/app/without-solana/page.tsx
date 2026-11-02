'use client'

import { ConnectWallet, SignUp } from '@zerodev/wallet-react-ui'
import { useAccount, useConnect, useDisconnect, useSignMessage } from 'wagmi'
import { EventLog, useChangeLog } from '../components/EventLog'
import { Panel } from '../components/Panel'

const MESSAGE = 'Solana QA demo: sign this message.'

/**
 * The control. Wired the way an app was before Solana existed: wagmi is the
 * only thing it reads, and wagmi knows nothing about the Solana slot.
 *
 * Connect a Solana wallet on /with-solana, then come here. If this page shows
 * `disconnected` while that one shows a Solana address, that is not a bug in
 * either page — it is the integration hazard, and the reason an app that adds
 * Solana has to stop gating on useAccount().
 */
export default function WithoutSolana() {
  const { status, address, isConnected } = useAccount()
  const { connectAsync, connectors } = useConnect()
  const { disconnectAsync } = useDisconnect()
  const { signMessageAsync } = useSignMessage()

  const kitConnector = connectors.find((c) => c.id === 'zerodev-wallet')

  // Only wagmi's view here. Compare against /with-solana's log, which carries
  // the kit's reading of the same connection beside it.
  const log = useChangeLog({
    'wagmi.status': status,
    'wagmi.isConnected': String(isConnected),
    'wagmi.address': address ?? '—',
  })

  return (
    <>
      <Panel
        title="Without Solana"
        note="Reads wagmi only: useAccount, useDisconnect, useSignMessage. No kit hook anywhere on this page."
        actions={[
          {
            label: 'Connect',
            busyLabel: 'Connecting…',
            tone: 'primary',
            run: async () => {
              if (!kitConnector) throw new Error('No zerodev-wallet connector')
              await connectAsync({ connector: kitConnector })
            },
          },
          {
            label: 'Sign message',
            busyLabel: 'Signing…',
            tone: 'accent',
            disabled: !isConnected,
            hint: `no connection. useAccount().status is ${status}.`,
            run: async () =>
              `sig ${await signMessageAsync({ message: MESSAGE })}`,
          },
          {
            label: 'Disconnect',
            busyLabel: 'Disconnecting…',
            run: () => disconnectAsync(),
          },
        ]}
        rows={[
          { label: 'useAccount().status', value: status },
          { label: 'useAccount().isConnected', value: String(isConnected) },
          { label: 'useAccount().address', value: address ?? '—' },
        ]}
      />

      {/* Above the log: both are in the document flow, so a log that grows
          would otherwise push the sheet off screen. */}
      <ConnectWallet
        renderSignUp={() => (
          <SignUp>
            <SignUp.InstalledWallets />
          </SignUp>
        )}
      />

      <EventLog log={log} />
    </>
  )
}
