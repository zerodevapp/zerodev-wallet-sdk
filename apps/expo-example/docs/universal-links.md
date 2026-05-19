# iOS Universal Links

Universal Links let an `https://` URL open your app directly instead of in
Safari. In this app the canonical use case is the email magic-link flow:
the user taps a link like
`https://zerodev-expo-example.vercel.app/verify-email?code=...` in Mail,
the app launches, and `expo-router` lands on `src/app/verify-email.tsx`
which finishes the verification.

Universal Links only succeed when:

1. The RP domain serves `/.well-known/apple-app-site-association` (AASA)
   over HTTPS with an `applinks` entry that includes the app's
   `<TeamID>.<bundleID>` and the path components you want to claim.
2. The app is built with the **Associated Domains** entitlement for the
   RP host (`applinks:<domain>`).
3. The path the email link points at is covered by the AASA
   `components` rule.

Any drift between these and iOS silently routes the URL to Safari with no
useful error — same opaque-failure mode as passkeys.

Apple's [Supporting universal links in your app](https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app)
covers the underlying mechanics.

## Prerequisites

- A paid Apple Developer Program account. The Associated
  Domains entitlement is paid-tier — free Apple IDs can sideload the app
  but the entitlement is silently dropped from the provisioning profile,
  so AASA is never fetched and UL never fires.
- A Team ID (from the
  [Apple Developer membership page](https://developer.apple.com/account))
  wired into `ios.appleTeamId` in `app.json` and into the AASA's
  `applinks.details[].appIDs`. Personal Team IDs from free accounts
  won't work.

## The binding, in this repo

| Concern | Location | Value |
|---|---|---|
| `ios.bundleIdentifier` | `app.json` | `com.zerodev.expoexample` |
| `ios.appleTeamId` | `app.json` | `88J4C462WP` |
| Associated Domains entitlement | `app.json` → `ios.associatedDomains` | `applinks:zerodev-expo-example.vercel.app?mode=developer` |
| Claimed path → route | `src/app/verify-email.tsx` | matches `/verify-email*` |
| AASA source | `assetlinks/public/.well-known/apple-app-site-association` | Declares `applinks.details[].appIDs = ["88J4C462WP.com.zerodev.expoexample"]` with `components: [{ "/": "/verify-email*" }]` |
| Live AASA | `https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association` | Served by Vercel |
| Magic-link redirect URL | `src/config/auth.ts` → `VERIFY_EMAIL_REDIRECT_URI` | `https://zerodev-expo-example.vercel.app/verify-email` when `EXPO_PUBLIC_USE_APP_LINKS=true`, otherwise the custom scheme |

### How the entitlement gets baked in

`ios.associatedDomains` is a **build-time** entitlement, not a runtime
config. Expo's prebuild embeds it into the generated `.entitlements`
file. Adding/changing an entry only takes effect after:

```
npx expo prebuild --clean
# then rebuild:
pnpm ios
# or:
pnpm dlx eas-cli build --platform ios --local --profile preview
```

A `pnpm ios` against an already-built simulator binary will not pick up
an entitlement change — you need a fresh build.

## Hosting the AASA on Vercel

Same Vercel project as `assetlinks.json` (see
[passkeys.md](./passkeys.md)). Both files live under
`assetlinks/public/.well-known/` and ship in the same deploy.

```
cd apps/expo-example/assetlinks
pnpm dlx vercel --prod
```

The `vercel.json` pins `Content-Type: application/json` and serves the
file without an extension (Apple requires both — `.json` extension or a
non-JSON content-type and the file is silently rejected).

Verify the live file:

```
curl -sSfI https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association
# expect 200, application/json, no redirects (no Location header)

curl -sSf  https://zerodev-expo-example.vercel.app/.well-known/apple-app-site-association | jq
```

The device fetches AASA from **Apple's CDN**, not from your origin:

```
curl -sSf 'https://app-site-association.cdn-apple.com/a/v1/zerodev-expo-example.vercel.app' | jq
```

If the CDN payload is stale (often a few hours after deploy, occasionally
up to 24h), see "Iterating without waiting on Apple's CDN" below.

## Claiming more paths

The AASA's `components` array decides which URLs your app claims. Today
only `/verify-email*` is claimed because that's the only URL we hand
out in email. To claim another path, append a component entry:

```
"components": [
  { "/": "/verify-email*" },
  { "/": "/some-other-path*" }
]
```

The trailing `*` wildcard matches arbitrary characters including the
`?code=...` query string. Then redeploy AASA.

Don't claim paths your app doesn't actually handle — every navigation to
that URL in Safari (typing it into the address bar, link from another
site) will be intercepted by your app, which surprises users.

## Iterating without waiting on Apple's CDN

When you redeploy AASA, the device keeps using the cached CDN copy until
Apple re-pulls from your origin. Two ways to bypass during development:

1. **`?mode=developer`** in `ios.associatedDomains`:
   ```
   "associatedDomains": [
     "applinks:zerodev-expo-example.vercel.app?mode=developer"
   ]
   ```
   iOS skips the CDN and fetches AASA directly from your origin every
   time. **Dev/ad-hoc builds only** — App Store builds strip the flag.
   Rebuild + reinstall after changing.
2. **Settings → Developer → Universal Links → Associated Domains
   Development → on** on the test device. The "Developer" menu only
   appears after the device has been connected to Xcode at least once.

With both, your next tap hits the latest AASA. You can confirm by
watching Vercel logs — the device requests
`/.well-known/apple-app-site-association` directly.

---
