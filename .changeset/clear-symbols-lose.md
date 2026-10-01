---
"@zerodev/wallet-react": patch
---

The provider builds a chain's client on demand, so a cross-chain wallet_sendCalls works without a manual switchChain first. getCapabilities reports atomic support only for configured chains, and unconfigured chains throw a typed UnsupportedChainIdError.
