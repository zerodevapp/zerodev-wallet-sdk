# zerodev-wallet-sdk

pnpm workspace monorepo. SDK packages live in `packages/*` (published to npm
via changesets), demo/test apps in `apps/*`. Build: `pnpm build`. Test a
package: `pnpm --filter <name> test`. Lint: biome.

## Authoring rules (AI and human authors)

- **Bug fixes ship their repro.** Every bug-fix PR includes a test that fails
  on the old code. A debugging repro (script, browser run) gets converted
  into that test, not thrown away.
- **PRs open as drafts** with an author self-review checklist in the body,
  split into: Decisions (API shapes, dependency strategy, changeset text —
  read the diff), Behavior (run the actual flow — say where you verified
  it), Mechanical (lockfile in sync, suite green). Mark ready only when
  every box is checked.
- **AI-authored PRs include the agent brief** (the task the agent was given)
  in the PR body, so reviewers can check intent-vs-diff alignment.
- **Dependencies changed → run `pnpm install`** and commit the lockfile if it
  changed. CI runs `pnpm install --frozen-lockfile` and fails on drift.
- **New public export →** add it to the package's `src/index.ts`, export its
  types, and add a changeset. Changesets use **patch** bumps by convention
  (no minor/major without explicit team sign-off).

## Review rules (for review agents and /code-review)

- Review with the full checkout, not the diff: grep callers of changed
  symbols, check the lockfile, read git history for context.
- **Every finding needs a concrete failure scenario** ("X breaks because Y"),
  and the scenario must be **verified by executing the check** — run the
  install, the test, the build. A plausible-but-unexecuted finding is not a
  finding.
- Routing tiers (see `.github/labeler.yml`): public API surface, versioning/
  deps, auth/signing paths, and architecture are `review:human`; tests,
  `apps/**`, and docs are `review:ai-first`. Human wins on conflict.

## Repo-specific conventions

- wagmi's `useConnect()` is destructured as `{ connect }` — never
  `{ mutate }` (doesn't exist on the return shape; breaks on both v2/v3).
- UI packages use the `zd:` Tailwind prefix; SDK stylesheets never ship
  Tailwind preflight or named `@layer`s — all styling stays inside the
  `.zd-scope` boundary (see `packages/react-ui/src/reset.css`).
- Branches are created with `av branch` (Aviator stacked PRs), not
  `git checkout -b`.
