---
'@zerodev/smart-routing-address-react-ui': minor
---

feat: migrate to @zerodev/smart-routing-address v1

Addresses are created against the v1 manager by default
(`SMART_ROUTING_ADDRESS_V1_0_0`); hosts can still pin a 0.2.x version via
`config.version`, whose actions keep the legacy `fallBack`. `projectId` is
sent as a first-class request parameter and `baseUrl` is passed as the bare
server root. Source tokens without an available route are dropped by the
server (`allowPartialRoutes`) instead of being filtered client-side, and the
default source tokens follow the SDK's curated `SUPPORTED_TOKENS` map.
Requires viem >=2.55.
