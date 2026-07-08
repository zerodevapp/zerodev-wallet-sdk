# Contributing

## Development setup

```bash
git clone git@github.com:zerodevapp/zerodev-wallet-sdk.git
cd zerodev-wallet-sdk
pnpm install
pnpm build
```

Common scripts: `pnpm test`, `pnpm lint`, `pnpm typecheck`. PR titles follow
[Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`,
`chore:`, `refactor:`, `build:`, …).

## Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets)
and published to npm from CI. **Nobody runs `npm publish` locally, and there are
no npm tokens** — CI authenticates to npm via GitHub OIDC ([npm Trusted
Publishing](https://docs.npmjs.com/trusted-publishers)) and every publish carries
a signed provenance attestation.

### Publishable packages

| Package | Path |
|---|---|
| `@zerodev/wallet-core` | `packages/core` |
| `@zerodev/wallet-react` | `packages/react` |
| `@zerodev/react-ui` | `packages/react-ui` |
| `@zerodev/wallet-react-ui` | `packages/wallet-react-ui` |

`@zerodev/wallet-react-native-kit` is private and ignored by the release tooling.

### The flow — two merges, zero manual publishing

**1. Add a changeset to your PR.** If your change affects a published package:

```bash
pnpm changeset
```

- select the package(s) and the bump type (`patch` / `minor` / `major`)
- write a one-line summary — it becomes the CHANGELOG entry (prefix `feat:` /
  `fix:` to match existing entries)
- commit the generated `.changeset/*.md` file **in your PR**

Skip this for changes that don't affect a published package (docs, CI, tests, the
demo app, or refactors with no output change). No changeset simply means no
release — that's fine.

> **Bump type:** everything is pre-1.0 (`0.0.x`), so nearly everything is a
> `patch` today. Use `minor` for notable new API, `major` only after 1.0.

**2. Merge your PR → a "Version Packages" PR appears.** On merge to `main`, the
release workflow opens (or updates) a PR titled **"Version Packages"**. It bumps
versions, rewrites CHANGELOGs, and deletes the consumed changesets. Dependent
packages are bumped automatically (e.g. bumping `wallet-react` also bumps
`wallet-react-ui`, which depends on it).

**3. Merge the "Version Packages" PR → publish.** That merge triggers the publish:
CI builds, then `changeset publish` pushes the changed packages to npm `latest`
with provenance and creates git tags.

### Requirements for a publishable package

Every publishable package's `package.json` **must** have a `repository` field with
the monorepo URL and its `directory`:

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/zerodevapp/zerodev-wallet-sdk.git",
  "directory": "packages/<name>"
}
```

npm's provenance check **rejects the publish with `E422`** if this is missing or
empty. The package must also not be marked `"private": true`. When adding a new
publishable package, set both before its first release.

### PR preview packages

Every PR automatically publishes throwaway preview builds via
[pkg.pr.new](https://pkg.pr.new) (no npm token — its own CDN). Install one to test
a branch before it's released:

```bash
npm i https://pkg.pr.new/@zerodev/wallet-react@<pr-sha>
```

The exact install commands are posted as a comment on each PR.

### How auth works (nothing long-lived to leak)

- **Publishing:** npm Trusted Publishing (OIDC). CI proves its identity to npm via
  a short-lived `id-token`; there is no `NPM_TOKEN`. Each package has this repo +
  `release.yml` registered as its Trusted Publisher on npm.
- **The "Version Packages" PR:** opened by a GitHub App (short-lived installation
  token), so the required CI checks run on it. A PR opened by the default
  `GITHUB_TOKEN` wouldn't trigger workflows and could never satisfy branch
  protection.
- Third-party GitHub Actions are pinned to commit SHAs and kept current by
  Dependabot.

### Good to know

- The published code is always code that passed CI: the "Version Packages" PR must
  go green before it can merge. The release job itself does not re-run the test
  suite — branch protection on `main` is the gate.
- `changeset publish` is not atomic. If one package fails to publish (e.g. a
  provenance error) but a dependent already published, fix the cause and merge —
  the next release run publishes any package whose version isn't yet on npm.
