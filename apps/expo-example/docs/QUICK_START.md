# Quick Start (Expo / React Native)

Stand up a React Native app that signs in with the ZeroDev wallet and
shows the connected address. The path here uses **email OTP** auth plus
an optional **Google OAuth** flow — neither needs a verified domain or
`assetlinks.json`, so you can run end-to-end with nothing more than a
project ID. Passkeys are out of scope for this guide (they require domain
binding — see [`passkeys.md`](./passkeys.md)); the `passkeyStamper` is
optional and omitted below.

Expo's APIs change between SDK versions. Use `pnpm add` for ordinary JS
dependencies, and use Expo's installer for Expo / React Native native
modules so those package versions match your Expo SDK. With pnpm, run the
Expo CLI through pnpm (`pnpm expo install ...`); Expo also defaults to
pnpm when it sees a `pnpm-lock.yaml`. Check the
[versioned Expo docs](https://docs.expo.dev/versions/latest/) for your SDK
if anything here drifts.

## 1. Create the project

```
pnpm create expo-app@latest <app_name>
cd <app_name>
```

Add the ZeroDev SDK, wagmi and its peers, then add the native modules the
SDK relies on. The first command is normal pnpm dependency management; the
second lets Expo choose SDK-compatible native package versions:

```
pnpm add @zerodev/wallet-core @zerodev/wallet-react wagmi viem @tanstack/react-query
pnpm expo install @react-native-async-storage/async-storage expo-secure-store react-native-get-random-values
```

## 2. Configure wagmi + ZeroDev

Create `src/wagmi.config.ts`. The ZeroDev connector is registered as a
wagmi connector via `zeroDevWallet()`, wired with the React Native
stamper and storage adapter:

- `apiKeyStamper: createSecureStoreStamper()` — stores the wallet's API
  key in the device keychain (`expo-secure-store`). Required.
- `sessionStorage` / `persistStorage` — back the wallet session with
  `AsyncStorage` so sign-in survives app restarts.
- `rpId` — only relevant for passkeys. Set it now so you can add passkeys
  later without reconfiguring; OTP and OAuth ignore it.

```ts
// src/wagmi.config.ts
import { createSecureStoreStamper } from "@zerodev/wallet-core/react-native/stampers/secure-store";
import { asyncStorageAdapter } from "@zerodev/wallet-core/react-native/storage/async-storage";
import { zeroDevWallet } from "@zerodev/wallet-react";
import { createConfig, createStorage, http } from "wagmi";
import { sepolia } from "wagmi/chains";

const ZERODEV_PROJECT_ID = process.env.EXPO_PUBLIC_ZERODEV_PROJECT_ID ?? "";
const RP_ID = "zd-wallet-quick-start";

const chains = [sepolia] as const;

export const wagmiConfig = createConfig({
  chains,
  connectors: [
    zeroDevWallet({
      projectId: ZERODEV_PROJECT_ID,
      chains,
      rpId: RP_ID,
      apiKeyStamper: createSecureStoreStamper(),
      sessionStorage: asyncStorageAdapter,
      persistStorage: asyncStorageAdapter,
    }),
  ],
  transports: {
    [sepolia.id]: http(),
  },
  storage: createStorage({ storage: asyncStorageAdapter }),
  multiInjectedProviderDiscovery: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
```

## 3. Wire up the providers

The `react-native-get-random-values` polyfill must be imported **before
anything that touches crypto**, so put it on the very first line of your
root layout. Wrap the app in `WagmiProvider` and `QueryClientProvider`:

```tsx
// src/app/_layout.tsx
import "react-native-get-random-values";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/wagmi.config";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <Stack screenOptions={{ headerShown: false }} />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
```

## 4. Get a project ID

1. Create a project in the ZeroDev dashboard.
2. Enable **Sepolia**.
3. Copy the project ID into a `.env` file in the project root:

```
EXPO_PUBLIC_ZERODEV_PROJECT_ID=<your project id>
```

The `EXPO_PUBLIC_` prefix exposes the value to the JS runtime. A project
ID is not a secret.

## 5. Add email OTP sign-in

`useSendOTP` emails a one-time code and returns an `otpId` +
`otpEncryptionTargetBundle`; `useVerifyOTP` exchanges the code for an
authenticated wallet session. Keep those OTP fields in local state between
the send and verify steps:

```tsx
// src/components/otp-email-flow.tsx
import { useSendOTP, useVerifyOTP } from "@zerodev/wallet-react";
import { useState } from "react";
import { Button, Text, TextInput, View } from "react-native";
import { useAccount } from "wagmi";

type Pending = { otpId: string; otpEncryptionTargetBundle: string };

/** Renders nothing once the wallet is connected. */
export function OtpEmailFlow() {
  const { status } = useAccount();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const sendOTP = useSendOTP();
  const verifyOTP = useVerifyOTP();

  if (status === "connected") return null;

  return (
    <View>
      <Text>Sign in</Text>

      {pending === null ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Button
            title={sendOTP.isPending ? "Sending..." : "Send code"}
            disabled={sendOTP.isPending || !email}
            onPress={() =>
              sendOTP.mutate(
                { email },
                {
                  onSuccess: ({ otpId, otpEncryptionTargetBundle }) =>
                    setPending({ otpId, otpEncryptionTargetBundle }),
                },
              )
            }
          />
        </>
      ) : (
        <>
          <Text>Code sent to {email}</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            keyboardType="number-pad"
          />
          <Button
            title={verifyOTP.isPending ? "Verifying..." : "Verify"}
            disabled={verifyOTP.isPending || !code}
            onPress={() =>
              verifyOTP.mutate({
                code,
                otpId: pending.otpId,
                otpEncryptionTargetBundle: pending.otpEncryptionTargetBundle,
              })
            }
          />
        </>
      )}

      <Text>{sendOTP.error?.message ?? verifyOTP.error?.message}</Text>
    </View>
  );
}
```

## 6. Show the connected wallet

Once connected, the ZeroDev wallet is a standard wagmi account. Use
`useAccount` to read the address and `useDisconnect` to log out:

```tsx
// src/components/wallet-actions.tsx
import { Button, Text, View } from "react-native";
import { useAccount, useDisconnect } from "wagmi";

/** Renders nothing until the wallet is connected. */
export function WalletActions() {
  const { address, status } = useAccount();
  const { disconnect } = useDisconnect();

  if (status !== "connected" || !address) return null;

  return (
    <View>
      <Text style={{ fontWeight: "600" }}>Wallet</Text>
      <Text selectable>{address}</Text>
      <Button title="Disconnect" onPress={() => disconnect()} />
    </View>
  );
}
```

## 7. Run it

```
pnpm expo start
```

Then open the app on a simulator/emulator or device (press `a` for
Android, `i` for iOS, `w` for web). Sign in with your email, paste the
code, and confirm your wallet address appears.

## Optional: Google OAuth

OAuth bounces out to a browser and back via a deep link, so it needs two
extra peer deps and one callback route. No domain setup is required when
you use the custom-scheme redirect (`<scheme>://oauth-callback`).

Install the OAuth peers (these may already be in the starter):

```
pnpm expo install expo-linking expo-web-browser
```

Add a sign-in component. `useAuthenticateOAuthWithExpoWebBrowser` opens
the provider in an in-app browser and reads the `session_id` back off the
redirect URL:

```tsx
// src/components/google-oauth-flow.tsx
import { OAUTH_PROVIDERS } from "@zerodev/wallet-react";
import { useAuthenticateOAuthWithExpoWebBrowser } from "@zerodev/wallet-react/react-native/oauth/with-expo-web-browser";
import * as Linking from "expo-linking";
import { Button, Text, View } from "react-native";
import { useAccount } from "wagmi";

/** Renders nothing once the wallet is connected. */
export function GoogleOauthFlow() {
  const { status } = useAccount();
  const auth = useAuthenticateOAuthWithExpoWebBrowser({
    redirectUri: Linking.createURL("oauth-callback"),
  });

  if (status === "connected") return null;

  return (
    <View>
      <Text>Sign in with Google</Text>
      <Button
        title={auth.isPending ? "Signing in..." : "Continue with Google"}
        disabled={auth.isPending}
        onPress={() => auth.mutate({ provider: OAUTH_PROVIDERS.GOOGLE })}
      />
      <Text>{auth.error?.message}</Text>
    </View>
  );
}
```

Add the callback route so expo-router doesn't show "Unmatched Route"
when the redirect lands. The SDK reads the `session_id` off the URL via
its own `Linking` listener, so this screen just bounces back home:

```tsx
// src/app/oauth-callback.tsx
import { Redirect } from "expo-router";

export default function OAuthCallback() {
  return <Redirect href="/" />;
}
```

Render `<GoogleOauthFlow />` alongside `<OtpEmailFlow />` on your home
screen, then **allowlist the redirect URL** in the ZeroDev dashboard.
Print what the value `Linking.createURL("oauth-callback")` resolves to (it
depends on your app's `scheme` in `app.json` or on the fact whether you use Expo Go or a Development Build) and add it under your
project's allowed OAuth redirects.

## Where to go next

- **Passkeys** — domain binding, `assetlinks.json` / AASA, signing
  certs: [`passkeys.md`](./passkeys.md).
- **OAuth & magic-link email over verified App Links** (instead of the
  custom scheme): [`oauth-native.md`](./oauth-native.md).
- **Universal Links**: [`universal-links.md`](./universal-links.md).
- **Wallet export** (seed phrase / private key):
  [`wallet-export.md`](./wallet-export.md).
