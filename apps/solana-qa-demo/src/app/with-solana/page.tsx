'use client'

import {
  ConnectWallet,
  SignUp,
  useAuth,
  useSolanaWallet,
  useWalletInfo,
  useZeroDevWalletKit,
} from '@zerodev/wallet-react-ui'
import { bytesToHex } from 'viem'
import { useAccount, useSignMessage } from 'wagmi'
import { EventLog, useChangeLog } from '../components/EventLog'
import { Panel } from '../components/Panel'

const MESSAGE = 'Solana QA demo: sign this message.'

export default function WithSolana() {
  const kit = useZeroDevWalletKit()
  const handle = useSolanaWallet()
  // Read wagmi directly as well, purely so the log can show where the two
  // disagree. Nothing on this page gates on it.
  const evm = useAccount()
  const { signMessageAsync } = useSignMessage()
  // An embedded login lands in the EVM namespace like any other connection, so
  // `eip155.status: connected` alone cannot say whether email auth or a wallet
  // put it there. `source` is the only thing that separates them: the embedded
  // connector is the one the kit filters out of `eip155.wallets`.
  const { walletInfo: evmWalletInfo } = useWalletInfo()
  const { step: authStep, email: authEmail, connectError } = useAuth()

  // wagmi reports `isConnected: false` for status `connecting` whatever the
  // address, so opening the sign-up sheet beside a live connection reads as a
  // lost session there and not here.
  const disagree = evm.isConnected !== kit.eip155.isConnected
  const log = useChangeLog(
    {
      'wagmi.status': evm.status,
      'wagmi.isConnected': String(evm.isConnected),
      'wagmi.address': evm.address ?? '—',
      'kit.eip155.status': kit.eip155.status,
      'kit.eip155.isConnected': String(kit.eip155.isConnected),
      'kit.solana.status': kit.solana.status,
      'kit.solana.isConnected': String(kit.solana.isConnected),
      'kit.solana.address': kit.solana.address ?? '—',
      'kit.isConnected': String(kit.isConnected),
      'kit.isReconnecting': String(kit.isReconnecting),
      'handle.signMessage': handle?.signMessage ? 'available' : 'null',
      'auth.step': authStep ?? '—',
      'eip155.source': evmWalletInfo?.source ?? '—',
    },
    disagree
      ? `wagmi.isConnected=${evm.isConnected} but kit.eip155.isConnected=${kit.eip155.isConnected} (wagmi status ${evm.status}, address ${evm.address ?? 'none'})`
      : undefined,
  )

  return (
    <>
      <Panel
        title="With Solana"
        note="Reads and drives both namespaces through useZeroDevWalletKit. Solana signing relays to the wallet's own solana:signMessage; EVM signing stays on wagmi."
        actions={[
          {
            label: 'Connect (Solana)',
            busyLabel: 'Connecting…',
            tone: 'primary',
            // Clickable with its own sheet still open, so a second request can
            // be made while the first is in flight. openSolanaSignUp rejects
            // that with 'Auth flow already in progress' once auth.step is set.
            allowWhileBusy: true,
            run: () => kit.connect({ namespace: 'solana' }),
          },
          {
            // Without this the EVM sign button is unreachable from this page:
            // picking an EVM wallet inside the Solana sheet settles that
            // request as AuthFlowDismissedError, by design.
            label: 'Connect (EVM)',
            busyLabel: 'Connecting…',
            tone: 'primary',
            run: () => kit.connect({ namespace: 'eip155' }),
          },
          {
            label: 'Sign message (Solana)',
            busyLabel: 'Signing…',
            tone: 'accent',
            disabled: handle?.signMessage == null,
            // The kit's aggregate says connected for an EVM-only session
            // while the Solana handle is null. Spelling that out is the
            // point: a host that gates a Solana action on kit.isConnected
            // rather than kit.solana.isConnected ships a button that cannot
            // work.
            hint: kit.solana.isConnected
              ? 'Connected wallet exposes no solana:signMessage for this account.'
              : `no Solana connection. kit.isConnected is ${kit.isConnected}, kit.solana.isConnected is ${kit.solana.isConnected}.`,
            run: async () => {
              if (!handle?.signMessage) {
                throw new Error('No signMessage on handle')
              }
              const { signature, signedMessage } = await handle.signMessage(
                new TextEncoder().encode(MESSAGE),
              )
              const echoed = new TextDecoder().decode(signedMessage)
              return `solana sig ${bytesToHex(signature)}${
                echoed === MESSAGE ? '' : ` | wallet signed: ${echoed}`
              }`
            },
          },
          {
            label: 'Sign message (EVM)',
            busyLabel: 'Signing…',
            tone: 'accent',
            disabled: !kit.eip155.isConnected,
            hint: `no EVM connection. kit.eip155.status is ${kit.eip155.status}.`,
            run: async () =>
              `evm sig ${await signMessageAsync({ message: MESSAGE })}`,
          },
          {
            // The interesting pair. With one multichain wallet serving both,
            // this should detach the EVM side at wagmi's state level rather
            // than revoking the site permission, so Solana survives.
            label: 'Disconnect (EVM)',
            busyLabel: 'Disconnecting…',
            disabled: !kit.eip155.isConnected,
            hint: `nothing to disconnect. kit.eip155.status is ${kit.eip155.status}.`,
            run: () => kit.disconnect({ namespace: 'eip155' }),
          },
          {
            label: 'Disconnect (Solana)',
            busyLabel: 'Disconnecting…',
            disabled: !kit.solana.isConnected,
            hint: `nothing to disconnect. kit.solana.status is ${kit.solana.status}.`,
            run: () => kit.disconnect({ namespace: 'solana' }),
          },
          {
            label: 'Disconnect (both)',
            busyLabel: 'Disconnecting…',
            run: () => kit.disconnect(),
          },
        ]}
        rows={[
          { label: 'kit.isConnected', value: String(kit.isConnected) },
          { label: 'kit.isReconnecting', value: String(kit.isReconnecting) },
          { label: 'solana.status', value: kit.solana.status },
          { label: 'solana.address', value: kit.solana.address ?? '—' },
          {
            label: 'solana.walletInfo',
            value: kit.solana.walletInfo
              ? `${kit.solana.walletInfo.name} (${kit.solana.walletInfo.source})`
              : '—',
          },
          {
            label: 'solana.wallets',
            value:
              kit.solana.wallets.map((w) => w.name).join(', ') ||
              '(none found)',
          },
          {
            label: 'solana.walletConnect',
            value: String(kit.solana.walletConnect),
          },
          { label: 'eip155.status', value: kit.eip155.status },
          { label: 'eip155.address', value: kit.eip155.address ?? '—' },
          // `source: 'embedded'` is what says an email or passkey login made
          // this connection rather than a wallet. The connector id is the
          // same fact unresolved: the embedded one is `zerodev-wallet`.
          {
            label: 'eip155.walletInfo',
            value: evmWalletInfo
              ? `${evmWalletInfo.name ?? '(unnamed)'} (${evmWalletInfo.source})`
              : '—',
          },
          { label: 'eip155.connector', value: evm.connector?.id ?? '—' },
          // A wallet in both lists announces on both sides, which is what
          // makes the adoption guard apply to it. In solana.wallets only, it
          // is Solana-only as far as the kit is concerned.
          {
            label: 'eip155.wallets',
            value:
              kit.eip155.wallets.map((c) => c.name).join(', ') ||
              '(none found)',
          },
          // The email flow's own state, and it is live rather than durable:
          // `authenticated` is where OtpInput lands once the code verifies and
          // it stays there, but the next kit.connect() wipes all three through
          // endCompletedAuthFlow, as does the sheet's X, and a reload starts
          // them empty. Read them before connecting again. `auth.email` is
          // also set when the code is SENT, so on its own it says a code was
          // requested, not that anyone entered it.
          { label: 'auth.step', value: authStep ?? '—' },
          { label: 'auth.email', value: authEmail ?? '—' },
          {
            label: 'auth.connectError',
            value: connectError
              ? `${connectError.title}: ${connectError.message}`
              : '—',
          },
          {
            label: 'handle.signMessage',
            value: handle?.signMessage ? 'available' : 'null',
          },
          {
            label: 'handle.signTransaction',
            value: handle?.signTransaction ? 'available' : 'null',
          },
          {
            label: 'handle.signAndSend',
            value: handle?.signAndSendTransaction ? 'available' : 'null',
          },
        ]}
      />

      {/* Connect() with no wallet opens this sheet and the promise follows it.
          Above the log on purpose: both are in the document flow, so a log
          that grows would otherwise push the sheet off screen. */}
      <ConnectWallet
        renderSignUp={() => (
          <SignUp emailAuthMethod="otp">
            {/* An embedded unit beside the wallet rows: completing it settles
                the Solana request as AuthFlowDismissedError. OTP, because the
                code is entered in this tab — a magic link returns to the
                origin baked into the project's email template, and this app
                has no /verify route to land on. Needs an OTP-configured
                project id; the magic-link one answers the send call but never
                delivers a code. */}
            <SignUp.Email />
            <SignUp.Divider label="or a wallet" />
            <SignUp.InstalledWallets
              maxWallets={6}
              namespaces={['eip155', 'solana'] as const}
            />
            {/* Both rows, so the sheet shows which door each one is. Each
                self-gates: the EVM row on a `zeroDevWalletConnect` connector
                existing, the Solana row additionally on `solana: true`. */}
            <SignUp.WalletConnect />
            <SignUp.SolanaWalletConnect />
          </SignUp>
        )}
      />

      <EventLog log={log} />
    </>
  )
}
