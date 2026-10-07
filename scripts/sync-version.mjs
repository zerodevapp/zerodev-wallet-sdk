// Writes packages/core/src/version.ts from packages/core/package.json, so the
// X-SDK-Version header names the published version. Runs in changeset:version.
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(
  readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8'),
)
writeFileSync(
  new URL('../packages/core/src/version.ts', import.meta.url),
  `// Synced from package.json by scripts/sync-version.mjs in changeset:version.\nexport const version = '${version}'\n`,
)
