// Writes each package's src/version.ts from its package.json, so the
// X-SDK-Version header names the published version. Runs in changeset:version.
import { readFileSync, writeFileSync } from 'node:fs'

for (const pkg of ['core', 'react', 'wallet-react-ui']) {
  const { version } = JSON.parse(
    readFileSync(
      new URL(`../packages/${pkg}/package.json`, import.meta.url),
      'utf8',
    ),
  )
  writeFileSync(
    new URL(`../packages/${pkg}/src/version.ts`, import.meta.url),
    `// Synced from package.json by scripts/sync-version.mjs in changeset:version.\nexport const version = '${version}'\n`,
  )
}
