const { withAppBuildGradle } = require('expo/config-plugins')

/**
 * Points Android's debug signingConfig at the committed keystore in
 * `credentials/debug.keystore` instead of the auto-generated one.
 *
 * Reason: Android passkeys (WebAuthn) require the installed APK's SHA-256
 * to match what the RP publishes in `/.well-known/assetlinks.json`. If
 * every contributor signs with `~/.android/debug.keystore` (different
 * per machine), only one of them matches. Signing every build with the
 * shared committed keystore makes the fingerprint stable across the team.
 *
 * Applied on every prebuild, so `pnpm android`, `npx expo run:android`,
 * and `eas build` all produce APKs signed with the same cert.
 */
const STORE_FILE_LINE = "storeFile file('debug.keystore')"

module.exports = function withDebugKeystore(config) {
  return withAppBuildGradle(config, (config) => {
    if (!config.modResults.contents.includes(STORE_FILE_LINE)) {
      throw new Error(
        `withDebugKeystore: did not find "${STORE_FILE_LINE}" in app/build.gradle — Expo prebuild template may have changed`,
      )
    }
    config.modResults.contents = config.modResults.contents.replace(
      STORE_FILE_LINE,
      "storeFile file('../../credentials/debug.keystore')",
    )
    return config
  })
}
