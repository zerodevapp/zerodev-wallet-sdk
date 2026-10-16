---
'@zerodev/react-ui': patch
---

`TokenSummary` truncates a headline or secondary line that is wider than the
card instead of overflowing it. `InfoCard` truncates its title and subtitle
the same way. A long headline wraps to a second line before it is clipped.
