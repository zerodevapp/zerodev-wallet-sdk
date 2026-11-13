---
"@zerodev/react-ui": patch
---

Primitives colour themselves through the semantic tokens instead of palette classes and inline colours, so the upcoming themes can restyle them. `Wrapper` sets its surface through a class (`zd:bg-bright-*`) rather than an inline style, so a `className` can now override it. Where the previous value had no token, the nearest design-system token applies: Badge primary 40%→50% white, Switch track 70%→50% white and off-thumb 30%→50% ink, skeleton tints 15%→10% ink, the solid Wrapper surface 80%→100% white, the Tooltip fill to solid ink.
