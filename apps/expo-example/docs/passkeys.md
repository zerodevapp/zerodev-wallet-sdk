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
