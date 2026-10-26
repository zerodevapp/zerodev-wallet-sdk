---
'@zerodev/smart-routing-address-react-ui': patch
---

fix: require zod >=4.6.6

Raises the zod dependency floor from ^4.4.3 to ^4.6.6 so installs can no
longer resolve a release affected by GHSA-mrhx-c7xc-m3w5 (memory exhaustion
when validating oversized arrays). No API changes.
