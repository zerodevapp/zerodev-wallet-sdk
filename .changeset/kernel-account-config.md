---
'@zerodev/wallet-react': patch
---

Export `KERNEL_ACCOUNT_CONFIG`, the Kernel version, EntryPoint version, and
index the connector derives every `4337` account with. The Data API derives
the same address from the owner EOA with this config, so it is now one named
value instead of repeated literals.
