# Review routing rubric

Route by blast radius and reversibility — not diff size, not author.
`review:human` always wins on conflict. A classifier may escalate to human
but never downgrade a rule-assigned human tier.

| Change | Tier | Why |
|---|---|---|
| Public API surface (exports, hook signatures, config shapes) | `review:human` | Permanent contract once published |
| Versioning & deps (changesets, peer ranges, publish config) | `review:human` | Ecosystem judgment call, even for one-line edits |
| Auth / keys / signing / money paths | `review:human` | Unbounded cost of a miss |
| Architecture (new packages, state ownership, dependency choices) | `review:human` | Direction compounds |
| Mechanical refactors with green CI | `review:ai-first` | Exhaustive consistency checking, AI's strength |
| Tests, demo apps (`apps/**`), docs | `review:ai-first` | Contained blast radius |
| Well-covered leaf code, dep bumps with passing suites | `review:ai-first` | The suite is the reviewer of record |

Reviewer obligations per tier:

- **review:human** — a human approves the *decision*; AI review still runs
  and verifies the consequences.
- **review:ai-first** — a checkout-based AI review must pass. Every finding
  carries a concrete failure scenario, verified by executing the check
  (install / test / build), not by asserting it.
