---
"@zerodev/wallet-react-ui": patch
---

The passkey, Google and email sign-up units render nothing while the embedded wallet is signed in, and a divider hides itself when nothing renders above or below it or when it follows another divider. A sign-up sheet opened over a live session, to add a Solana wallet for instance, no longer offers a second login that would re-authenticate over it. In the EVM-only installed-wallets list a wallet that is already connected reads as CONNECTED and is not connectable, as it already was in the multichain list.
