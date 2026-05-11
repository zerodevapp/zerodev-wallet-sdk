# Wallet export

The export screens at `src/app/export/*` reveal the user's seed phrase or
private key. Plaintext is reconstructed by Turnkey's export iframe
(`https://export.turnkey.com`) using HPKE — the RN bundle never holds
it. The iframe is loaded inside a `react-native-webview` that we treat
as a privileged boundary.

## Why a WebView

The export iframe is a browser primitive that requires a real DOM,
`MessageChannel`, and a same-origin sandbox — none of which exist in
React Native's JS context. The two practical hosts are a `WebView` or a
custom native module that embeds `WKWebView` / `WebView` itself. A
`react-native-webview` keeps the example managed-workflow-compatible and
gives us a single component to harden, at the cost of being JS-side
instead of native-side. The native-module path is the next step but
deferred.

## What this app hardens

| Concern | Location | What it does |
|---|---|---|
| Cross-origin loads | `src/components/export/ExportWebView.tsx` — `originWhitelist` + `onShouldStartLoadWithRequest` | Reject anything outside the wrapper origin and `export.turnkey.com` |
| WebView state isolation | same file — `incognito`, `setSupportMultipleWindows={false}`, `javaScriptCanOpenWindowsAutomatically={false}`, `allowsInlineMediaPlayback={false}`, `mediaPlaybackRequiresUserAction` | No persistent storage, no popups, no inline media |
| Replay / multi-invocation | same file — `handledPubkey` ref + `requestId` matched on `BUNDLE_INJECTED` | A misbehaving iframe can't drive multiple export calls or replay acks |
| Screenshot / recording (Android) | `src/hooks/usePreventScreenCapture.ts` | `FLAG_SECURE` via `expo-screen-capture`; fail-closed on reject |
| Biometric gate | `src/lib/biometricAuth.ts` | `disableDeviceFallback: true` — biometric only, no passcode |
| Consent + reveal reset | `src/app/export/_layout.tsx`, `wallet.native.tsx`, `private-key.native.tsx` | Consent resets on background; reveal resets on inactive |
| Crypto-path dep versions | `package.json` | `@turnkey/api-key-stamper`, `@turnkey/crypto`, `@turnkey/react-native-passkey-stamper`, `react-native-webview` pinned exactly (no `^` / `~`) |
| Workspace install delay | `pnpm-workspace.yaml` — `minimumReleaseAge: 1440` | 24h floor before a freshly published version is installable |

## What to add in your own app

Even with the above, a compromised dependency in the JS bundle can
still try to substitute the iframe origin, decrypt in JS, or exfiltrate
the bundle over `fetch`. The defenses below live outside the JS bundle
and need to be wired in by the app developer — the SDK alone can't
provide them.

### iOS — App Transport Security

Add to `app.json` under `expo.ios.infoPlist`:

```json
"NSAppTransportSecurity": {
  "NSAllowsArbitraryLoads": false,
  "NSExceptionDomains": {
    "turnkey.com": {
      "NSIncludesSubdomains": true,
      "NSExceptionRequiresForwardSecrecy": true
    }
  }
}
```

Gates `fetch` / `XMLHttpRequest` at the OS networking layer. A
compromised dep that tries to exfiltrate to `attacker.example` gets a
network error before the request leaves the device.

### Android — Network Security Config

Drop `network_security_config.xml` under
`android/app/src/main/res/xml/` via a config plugin similar to
`plugins/withDebugKeystore.js`:

```xml
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors><certificates src="system"/></trust-anchors>
  </base-config>
</network-security-config>
```

Reference it on `<application android:networkSecurityConfig="@xml/…">`.
This blocks cleartext traffic in release builds and refuses
user-installed CAs (which closes proxying-based MITM in attacker
hands). Add a dev-only exception for `localhost` / `10.0.2.2` if you
need Metro over HTTP from a real device.

### OTA bundle signing

If you ship with EAS Update, CodePush, or similar, enable signed
updates. Without it, anyone with deploy credentials can push malicious
JS without an app-store review — a free supply-chain vector. For EAS
Update: `eas.json` `code-signing`, ship the public cert with the build.

### CI / supply-chain monitoring

- `pnpm install --frozen-lockfile` in CI; no floating versions.
- `pnpm audit signatures` on the crypto path; fail the build on
  missing / invalid provenance.
- Watch advisories for `@turnkey/*`, `@noble/*`, and
  `react-native-webview` via Dependabot / Socket / Snyk.
- 2FA on every account with publish or deploy rights.

### Out-of-scope here

- **Jailbreak / root refusal** — `expo-device` + a native check can
  block compromised devices, but blocks legitimately rooted users too.
  Trade-off call.
- **iOS screenshot prevention** — there is no official iOS API; only
  detection. `UITextField.isSecureTextEntry` blacks out captures but is
  undocumented and needs a native module. Detection via
  `expo-screen-capture` is supported but reacts after the fact.
- **Runtime self-checks** (hash the wrapper HTML, freeze module
  exports, etc.) — these live in the same trust domain as the
  attacker. A malicious dep can replace the check too. Skip.
