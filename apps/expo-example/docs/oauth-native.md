# OAuth and magic-link email on Android (App Links)

Android can deliver an external redirect via either of two paths:

1. A **custom-scheme deep link** (`zerodev-example://<path>?...`) —
   no domain setup needed; works out of the box.
2. A **verified https App Link**
   (`https://zerodev-expo-example.vercel.app/<path>?...`) —
   requires a domain you own and an `assetlinks.json` that binds it to
   your app's signing cert. The OS then routes the redirect straight to
   your signed app without a chooser.

Two such redirects exist in this app:

- `oauth-callback` — the provider's redirect after OAuth sign-in.
- `verify-email` — the magic link emailed by `useSendMagicLink`.

Both reuse the same App Link infrastructure (one assetlinks file, one
signing cert, one toggle) and each has its own intent filter in
`app.json` plus its own exported constant
(`OAUTH_REDIRECT_URI`, `VERIFY_EMAIL_REDIRECT_URI`) in
[`src/config/auth.ts`](../src/config/auth.ts).

Either delivery path is fine. This repo supports both: setting
`EXPO_PUBLIC_USE_APP_LINKS=true` opts into the App Link path (each
redirect URI is then derived from `RP_ID` in
[`src/config/auth.ts`](../src/config/auth.ts)); when unset or `false`,
`Linking.createURL(<path>)` builds the custom-scheme fallback.
The OAuth branch lands in the `Linking.addEventListener('url', ...)`
handler inside [`src/oauth/createNativeOAuthGetSessionId.ts`](../src/oauth/createNativeOAuthGetSessionId.ts);
the magic-link branch lands in
[`src/app/verify-email.tsx`](../src/app/verify-email.tsx) via
expo-router's `useLocalSearchParams`.

This doc covers the App Link wiring. If you just want a custom scheme,
leave `EXPO_PUBLIC_USE_APP_LINKS` unset — no further setup needed.

## The binding, in this repo

| Concern | Location | Value |
|---|---|---|
| App Link toggle | `.env` → `EXPO_PUBLIC_USE_APP_LINKS` | `true` |
| OAuth redirect URL | derived from `RP_ID` in `src/config/auth.ts` | `https://zerodev-expo-example.vercel.app/oauth-callback` |
| Magic-link redirect URL | derived from `RP_ID` in `src/config/auth.ts` | `https://zerodev-expo-example.vercel.app/verify-email` |
| `android.intentFilters` | `app.json` | one filter per path (`/oauth-callback`, `/verify-email`), host `zerodev-expo-example.vercel.app`, `autoVerify: true` |
| Assetlinks source | `assetlinks/public/.well-known/assetlinks.json` | Declares `handle_all_urls` + the signing SHA-256 |
| Live assetlinks | `https://zerodev-expo-example.vercel.app/.well-known/assetlinks.json` | Served by Vercel |
| Signing cert | `credentials/debug.keystore` | Pinned via `plugins/withDebugKeystore.js` |

The assetlinks file, signing cert, and Vercel hosting are the same
artifacts used for passkeys — see [`passkeys.md`](./passkeys.md) for how
they're deployed, rotated, and verified. The `handle_all_urls` relation
that enables App Links is already present in the committed
`assetlinks.json` alongside the `get_login_creds` relation that
passkeys use.

## Pointing at your own domain

If you fork this example and host the redirect on a domain you control,
every piece of the table above has to line up. The recipe:

1. Deploy an `assetlinks.json` at
   `https://<your-domain>/.well-known/assetlinks.json` declaring your
   package name, your signing cert's SHA-256, and the
   `delegate_permission/common.handle_all_urls` relation. The mechanics
   — Vercel setup, `Content-Type` pinning, `keytool` to extract
   fingerprints — are already documented in
   [`passkeys.md`](./passkeys.md#hosting-assetlinksjson-on-vercel) and
   [`passkeys.md`](./passkeys.md#signing-with-a-different-keystore).
2. Update `app.json` → both entries in `android.intentFilters` so
   `host` matches your domain. Keep one filter per redirect path
   (`/oauth-callback`, `/verify-email`) — magic-link verification needs
   its own filter.
3. Update `RP_ID` in `src/config/auth.ts` to your domain, set
   `EXPO_PUBLIC_USE_APP_LINKS=true` in your `.env`, and configure the
   resulting URLs (`https://<RP_ID>/oauth-callback` for OAuth,
   `https://<RP_ID>/verify-email` for magic links) as allowed redirects
   in your OAuth provider's and ZeroDev dashboards.
4. Run `npx expo prebuild --platform android` to regenerate
   `AndroidManifest.xml` with the new intent filter. **`pnpm android`
   alone does not re-run prebuild when `android/` already exists**, so
   `app.json` changes silently won't land in the installed APK.
5. Build and install: `pnpm android`.

Narrow the `pathPrefix` to a path you actually own (e.g.
`/oauth-callback`). A broad prefix like `/` would register your app as
a handler for every URL on the domain, including `/.well-known/`, which
can interact badly with other integrations.

## Verifying the binding

After install, confirm Android accepted the binding:

```
adb shell pm get-app-links <your-package-name>
```

Expect `<your-host>: verified`. Other states mean something is off:

- `legacy_failure` / `1024` — Android couldn't fetch or parse
  `assetlinks.json`. Most common cause is a wrong `Content-Type`
  (Vercel pins `application/json` via `assetlinks/vercel.json`; if
  you're hosting elsewhere, make sure yours does the same).
- `ask` — `autoVerify` didn't run, usually because `app.json` wasn't
  prebuilt into the installed APK.

For a focused end-to-end check without walking through the OAuth flow,
fire a synthetic intent:

```
adb shell am start -a android.intent.action.VIEW \
  -d "https://<your-host>/<your-pathPrefix>/test" \
  <your-package-name>
```

A verified App Link opens the app directly; unverified, Android shows
a chooser or sends the URL to the browser.
