import Link from 'next/link'

export default function Index() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Solana QA demo</h1>
        <p className="mt-2 text-muted">
          Connect, sign a message, disconnect. Two routes share one wagmi config
          and differ only in how they read and drive the connection.
        </p>
      </div>

      <ul className="space-y-4">
        <li className="rounded-2xl border border-border-warm bg-white p-5">
          <Link href="/with-solana" className="font-semibold">
            /with-solana
          </Link>
          <p className="mt-1 text-sm text-muted">
            <code>useZeroDevWalletKit()</code> for state,{' '}
            <code>
              kit.connect({'{'} namespace: &apos;solana&apos; {'}'})
            </code>{' '}
            to open the sheet, <code>useSolanaWallet()</code> to sign,{' '}
            <code>kit.disconnect()</code> to log out. Shows both namespaces and
            the aggregate side by side.
          </p>
        </li>
        <li className="rounded-2xl border border-border-warm bg-white p-5">
          <Link href="/without-solana" className="font-semibold">
            /without-solana
          </Link>
          <p className="mt-1 text-sm text-muted">
            The control: wagmi only. <code>useAccount()</code>,{' '}
            <code>useDisconnect()</code>, <code>useSignMessage()</code>, and an
            EVM-only sign-up. Connect a Solana wallet on the other route, then
            look here.
          </p>
        </li>
      </ul>

      <p className="text-sm text-muted">
        Both routes need <code>.env.local</code>. Copy <code>.env.example</code>{' '}
        and port the values from <code>apps/zerodev-signer-demo</code>. Without
        a WalletConnect project id the Solana WalletConnect row hides itself and
        installed wallets still work.
      </p>
    </div>
  )
}
