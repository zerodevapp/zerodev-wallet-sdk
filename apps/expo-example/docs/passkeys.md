# Android passkeys

Android passkeys (WebAuthn via Credential Manager) only succeed when:

1. The installed APK is signed with a known SHA-256.
2. The RP domain serves `/.well-known/assetlinks.json` over HTTPS
   declaring that SHA-256 + the app's `package_name`.
3. The `rpId` the app passes to the passkey stamper matches the RP
   domain.

Any drift between the three yields a generic OS-level error with no
useful JS stack. This doc explains how this repo wires the three, how
to (re)deploy the assetlinks file, how to produce a standalone APK
build, and what to do if you sign a build with a different keystore.

Much of the mechanics here follow Turnkey's
[passkeyapp local-Android guide][tkhq-passkeyapp] — credit where due.

## The binding, in this repo

| Concern | Location | Value |
|---|---|---|
| `android.package` | `app.json` | `com.zerodev.expoexample` |
| Committed signing cert | `credentials/debug.keystore` | SHA-256 `11:F4:8E:00:20:B4:FB:77:BF:6C:86:A2:62:8F:F5:B4:69:6F:4C:68:ED:C0:90:79:56:93:6C:8E:50:4A:6E:B0` |
| Gradle signing wiring | `plugins/withDebugKeystore.js` | Expo config plugin |
| `rpId` | `src/wagmi/config.native.ts` | `zerodev-expo-example.vercel.app` |
| Assetlinks source | `assetlinks/public/.well-known/assetlinks.json` | Declares package + SHA-256 |
| Live assetlinks | `https://zerodev-expo-example.vercel.app/.well-known/assetlinks.json` | Served by Vercel |

### How the signing cert gets used

Expo's default Android prebuild points `signingConfigs.debug.storeFile`
at `android/app/debug.keystore`, which falls back to each machine's
`~/.android/debug.keystore` — different SHA-256 per contributor, so
only one of them would ever match the live `assetlinks.json`.

`plugins/withDebugKeystore.js` is a small Expo config plugin,
registered in `app.json` under `expo.plugins`, that rewrites the
generated `android/app/build.gradle` on every prebuild so
`signingConfigs.debug.storeFile` resolves to
`credentials/debug.keystore` in the repo. Every contributor's
`pnpm android` / `expo run:android` / `eas build` now produces an APK
with the committed SHA-256 — the one `assetlinks.json` advertises.

The keystore uses Android debug defaults:
`storepass=android`, `keypass=android`, `alias=androiddebugkey`. To
extract its SHA-256:

```
keytool -list -v \
  -keystore credentials/debug.keystore \
  -alias androiddebugkey -storepass android -keypass android
```

## Hosting `assetlinks.json` on Vercel

Done once by a maintainer, and again when the fingerprint set changes.

```
pnpm dlx vercel login                     # first time per machine
cd apps/expo-example/assetlinks
pnpm dlx vercel                           # interactive: name "zerodev-expo-example", accept defaults
pnpm dlx vercel --prod                    # promote to production
```

The directory's `vercel.json` already sets the output dir to `public/`
and pins `Content-Type: application/json` on the assetlinks response
(Android's Credential Manager rejects anything else).

Verify the deploy:

```
curl -sSfI https://zerodev-expo-example.vercel.app/.well-known/assetlinks.json   # expect 200 + application/json
curl -sSf  https://zerodev-expo-example.vercel.app/.well-known/assetlinks.json
```

Ask Google's Digital Asset Links server whether the binding is valid
end-to-end:

```
curl -sSG "https://digitalassetlinks.googleapis.com/v1/assetlinks:check" \
  --data-urlencode "source.web.site=https://zerodev-expo-example.vercel.app" \
  --data-urlencode "relation=delegate_permission/common.get_login_creds" \
  --data-urlencode "target.android_app.package_name=com.zerodev.expoexample" \
  --data-urlencode "target.android_app.certificate.sha256_fingerprint=11:F4:8E:00:20:B4:FB:77:BF:6C:86:A2:62:8F:F5:B4:69:6F:4C:68:ED:C0:90:79:56:93:6C:8E:50:4A:6E:B0"
```

`{"linked": true}` means Google sees the binding; the Android
Credential Manager will too.

The only hard requirements are HTTPS and that the file be served at
the **root** `/.well-known/assetlinks.json`. If you prefer a different
host, swap it in here and update `RP_ID` in `src/wagmi/config.native.ts`
to match.

## Building a standalone APK (EAS local)

`pnpm android` is the fastest dev path. When you want a signed APK
artifact — to share with a teammate, load onto a device without Metro,
or test specific signing credentials — use EAS local.

Before your first build, open `apps/expo-example/eas.json` and set
`build.preview.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID` to your project ID
from the [ZeroDev dashboard](https://dashboard.zerodev.app). The
committed value is a placeholder. EAS release-variant builds do **not**
read `.env` at runtime — `EXPO_PUBLIC_*` vars must be embedded at
build time, and `eas.json` is where you do that for `--local` builds.

Then build and install:

```
cd apps/expo-example
pnpm dlx eas-cli build --platform android --local --profile preview
```

Reads `eas.json` and `credentials.json` and writes an APK
(`build-*.apk`) into the current directory, signed with
`credentials/debug.keystore`. Install it on the running emulator or a
connected device:

```
adb install build-*.apk
```

If you have multiple devices attached, target one with `adb -t<id>`:

```
adb devices -l                            # look up transport_id
adb -t<id> install build-*.apk
```

Since the APK is signed with the committed keystore, passkeys work on
it out of the box. If you need a different signing cert, see the next
section.

Note: `npx expo run:android -d` (debug variant) does **not** produce a
signed APK suitable for passkey testing — stick with `pnpm android` or
`eas build --local`.

## Signing with a different keystore

If you build an APK signed with a cert other than
`credentials/debug.keystore` (a personal release keystore, a
teammate's build, an EAS-managed build with cloud credentials),
`assetlinks.json` needs to declare that cert's SHA-256 too. Android's
Credential Manager matches against any fingerprint in the array, so
you can list several.

1. Extract your keystore's SHA-256:
   ```
   keytool -list -v -keystore <your-keystore> -alias <your-alias>
   ```
2. Add it to `sha256_cert_fingerprints` in
   `apps/expo-example/assetlinks/public/.well-known/assetlinks.json`:
   ```
   "sha256_cert_fingerprints": [
     "11:F4:8E:00:20:B4:FB:77:BF:6C:86:A2:62:8F:F5:B4:69:6F:4C:68:ED:C0:90:79:56:93:6C:8E:50:4A:6E:B0",
     "<your-new-fingerprint>"
   ]
   ```
3. Redeploy Vercel:
   ```
   cd apps/expo-example/assetlinks
   pnpm dlx vercel --prod
   ```
4. Verify the live file lists both (see the `curl` commands above),
   then install your APK and test.

## Tips for testing on an emulator

- Use a **Google Play** system image. AOSP / Google APIs images lack
  Google Play Services and therefore Credential Manager.
- Set up a screen lock (PIN, pattern, or biometrics) on the emulator
  before registering — Credential Manager refuses to create passkeys
  on an unlocked device.
- Sanity-check Credential Manager itself at
  [webauthn.io](https://webauthn.io) in Chrome on the emulator before
  blaming your APK — if webauthn.io can't register, the emulator
  itself is misconfigured.

[tkhq-passkeyapp]: https://github.com/tkhq/passkeyapp#running-the-app-locally-on-android

# iOS passkeys

iOS passkeys (WebAuthn over the Authentication Services framework) only succeed when:

1. The app is signed with a provisioning profile whose Team ID matches what `apple-app-site-association` (AASA) advertises.
2. The RP domain serves `/.well-known/apple-app-site-association` over HTTPS, declaring a `webcredentials` entry for the app's `<TeamID>.<bundleID>`.
3. The app is built with the **Associated Domains** entitlement for the RP host (`webcredentials:<domain>`).
4. The `rpId` the app passes to the passkey stamper matches the RP domain.

Any drift between these yields an opaque OS error (typically "The operation couldn't be completed") with no useful JS stack. This section explains how this repo wires the four, how to (re)deploy the AASA, and how to iterate without waiting on Apple's CDN.

Apple's [Supporting passkeys](https://developer.apple.com/documentation/authenticationservices/supporting-passkeys) and [Supporting Associated Domains](https://developer.apple.com/documentation/xcode/supporting-associated-domains) docs cover the underlying mechanics.

## Prerequisites

- A paid Apple Developer Program account. Associated Domains is a paid-tier entitlement — free Apple IDs can sideload the app but the entitlement is silently dropped from the provisioning profile, so AASA never gets fetched and passkeys won't register or assert.
- A real Team ID (from the [Apple Developer membership page](https://developer.apple.com/account)) wired into `ios.appleTeamId` in `app.json` and into the AASA's `appIDs` / `webcredentials.apps`. Personal Team IDs from free accounts won't work here either.

## The binding, in this repo

| Concern | Location | Value |
|---|---|---|
| `ios.bundleIdentifier` | `app.json` | `com.zerodev.expoexample` |
| `ios.appleTeamId` | `app.json` | `88J4C462WP` |
| Associated Domains entitlement | `app.json` → `ios.associatedDomains` | `webcredentials:zerodev-expo-example.vercel.app` |
| `rpId` | `src/wagmi/config.native.ts` | `zerodev-expo-example.vercel.app` |
| AASA source | `assetlinks/public/.well-known/apple-app-site-association` | Declares `webcredentials.apps = ["88J4C462WP.com.zerodev.expoexample"]` |
| Live AASA | `https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association` | Served by Vercel |

### How the entitlement gets baked in

Associated Domains is a **build-time** entitlement, not a runtime config. Expo's `expo-managed` workflow embeds `ios.associatedDomains` into the generated `.entitlements` file during prebuild. Adding or changing an entry only takes effect after:

```
npx expo prebuild --clean        # regenerates ios/
# then rebuild with one of:
pnpm ios
pnpm dlx eas-cli build --platform ios --local --profile preview
```

A `pnpm ios` against an already-built binary will *not* pick up an entitlement change — you need a fresh build.

## Hosting the AASA on Vercel

Same deploy as `assetlinks.json` — both live under `assetlinks/public/.well-known/`.

```
cd apps/expo-example/assetlinks
pnpm dlx vercel --prod
```

The `vercel.json` already pins `Content-Type: application/json` and serves the file without an extension (Apple requires both).

Verify the live file:

```
curl -sSfI https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association
# expect 200, application/json, no redirects (Location header)

curl -sSf  https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association | jq
```

The device fetches AASA from Apple's CDN, not from your origin:

```
curl -sSf 'https://app-site-association.cdn-apple.com/a/v1/zerodev-expo-example.vercel.app' | jq
```

If the CDN payload is stale (often a few hours after deploy, occasionally up to 24h), see "Iterating without waiting on Apple's CDN" below.

## Iterating without waiting on Apple's CDN

When you redeploy AASA, the device keeps using the cached version until Apple's CDN re-pulls from your origin. Two ways to bypass during development:

1. **`?mode=developer`** in `ios.associatedDomains`:
   ```
   "associatedDomains": [
     "webcredentials:zerodev-expo-example.vercel.app?mode=developer"
   ]
   ```
   iOS skips the CDN and fetches AASA directly from your origin on every link/credential association. **Dev/ad-hoc builds only** — App Store builds strip the flag. Rebuild + reinstall after changing.
2. **Settings → Developer → Universal Links → Associated Domains Development → on** on the test device. The "Developer" menu only appears once a device has been connected to Xcode at least once.

With both, your next passkey registration/auth hits the latest AASA. You can confirm by watching Vercel logs — the device requests `/.well-known/apple-app-site-association` directly.

## Using a different team / bundle

If you build with a different Apple Team ID or bundle identifier (a fork, a separate org's profile), AASA needs to advertise that app ID too. The `webcredentials.apps` array accepts multiple entries:

1. Update `assetlinks/public/.well-known/apple-app-site-association`:
   ```
   "webcredentials": {
     "apps": [
       "88J4C462WP.com.zerodev.expoexample",
       "<NEW_TEAM_ID>.<NEW_BUNDLE_ID>"
     ]
   }
   ```
2. Redeploy:
   ```
   cd apps/expo-example/assetlinks
   pnpm dlx vercel --prod
   ```
3. Wait for Apple's CDN, or use the dev-mode flag above on the new build.

## Tips for testing on iOS

- Use a physical device to test passkeys.
- Set a device passcode (and Face ID / Touch ID where applicable). The system refuses to create passkeys on a passcode-less device.
- Sanity-check the device's WebAuthn implementation independently at [webauthn.io](https://webauthn.io) in Safari before blaming your app build — if Safari can't register on this device, the device is misconfigured (no iCloud Keychain, no passcode, etc.).
- Errors like *"The operation couldn't be completed"* almost always mean an AASA/entitlement mismatch. Re-run the `curl` checks above and confirm the `?mode=developer` flag is on for dev builds.

