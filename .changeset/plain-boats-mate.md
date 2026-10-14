---
"@zerodev/wallet-react-ui": patch
"@zerodev/wallet-react": patch
"@zerodev/wallet-core": patch
---

Send an `X-SDK-Version` header on every KMS request so ZeroDev can see which SDK package and version each project runs. Apps using the UI kit report `@zerodev/wallet-react-ui@<version>`, React apps `@zerodev/wallet-react@<version>`, and core-only apps `@zerodev/wallet-core@<version>`. Requests sent directly to Turnkey don't carry it.
