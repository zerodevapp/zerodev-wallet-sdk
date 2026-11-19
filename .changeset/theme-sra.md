---
"@zerodev/smart-routing-address-react-ui": patch
"@zerodev/react-ui": patch
---

The deposit screens colour themselves through the semantic tokens instead of the palette, so they follow the four themes: plain and branded, light and dark. Status text, the copy-address button, the token discs, skeletons and the QR tile all read from tokens; the layout and components are unchanged. In branded light a few colours snap to their nearest token value, as the wallet screens did: the copy-address button goes from 90% to full ink, the fee breakdown's secondary figures from 70% to 80% ink, row labels from 60% to 50%, and skeletons from 15% to 10%. `DataRow`'s warning card takes the brand-tertiary tint the design binds, the same peach in light and a neutral tint in dark.
