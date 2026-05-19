import { exportPrivateKey, exportWallet } from '@zerodev/wallet-core'
import { useRef } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { v4 as uuidv4 } from 'uuid'
import { useConfig } from 'wagmi'
import {
  getZeroDevConnector,
  getZeroDevStore,
  getZeroDevWallet,
} from '../../actions.js'

/**
 * WebView-isolated Turnkey export. Loads a wrapper HTML which embeds
 * `https://export.turnkey.com` as an iframe; the iframe owns the keypair,
 * decrypts the HPKE bundle, and renders the secret in its own JS context.
 * RN never holds the plaintext.
 *
 * Mount lifecycle is the trigger: render the component when you want the
 * export to start, unmount it to dismiss. The component holds no React
 * state; wire up parent state via the `onReady` / `onError` callbacks.
 *
 * The WebView bridge is treated as a privileged boundary:
 *  - `onShouldStartLoadWithRequest` + a narrow `originWhitelist` reject any
 *    navigation outside the wrapper's baseUrl and the Turnkey export iframe.
 *  - `PUBLIC_KEY_READY` is consumed at most once per mount, and each inject
 *    carries a `requestId` matched against the corresponding `BUNDLE_INJECTED`
 *    so a misbehaving iframe cannot drive multiple export calls or replay
 *    acks.
 */
type Props = {
  kind: 'wallet' | 'privateKey'
  /** Required: the wrapper's baseUrl origin (e.g. the consumer's RP_ID). */
  rpId: string
  /** Fires after the iframe acks BUNDLE_INJECTED — the secret is on screen. */
  onReady?: () => void
  /** Fires on bundle-fetch failure or iframe-side ERROR. */
  onError?: (message: string) => void
  /** Forwarded to the underlying WebView. */
  style?: StyleProp<ViewStyle>
}

const TURNKEY_EXPORT_ORIGIN = 'https://export.turnkey.com'

type InjectPayload =
  | {
      type: 'INJECT_WALLET_EXPORT_BUNDLE'
      requestId: string
      value: string
      organizationId: string
    }
  | {
      type: 'INJECT_KEY_EXPORT_BUNDLE'
      requestId: string
      value: string
      organizationId: string
      keyFormat: 'HEXADECIMAL'
    }

function buildWrapperHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: transparent; }
      iframe { width: 100%; height: 100%; border: 0; display: block; }
    </style>
  </head>
  <body>
    <iframe
      id="tk"
      src="${TURNKEY_EXPORT_ORIGIN}"
      sandbox="allow-scripts allow-same-origin"
    ></iframe>
    <script>
      (function () {
        var iframe = document.getElementById('tk');
        var iframeOrigin = '${TURNKEY_EXPORT_ORIGIN}';
        var channel = new MessageChannel();

        channel.port1.onmessage = function (event) {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify(event.data));
          } catch (e) {}
        };

        window.__sendToTurnkey = function (msg) {
          try {
            channel.port1.postMessage(msg);
          } catch (e) {}
        };

        iframe.addEventListener('load', function () {
          if (!iframe.contentWindow) return;
          iframe.contentWindow.postMessage(
            { type: 'TURNKEY_INIT_MESSAGE_CHANNEL' },
            iframeOrigin,
            [channel.port2]
          );
        });
      })();
    </script>
  </body>
</html>`
}

export function ZeroDevExportWebView({
  kind,
  rpId,
  onReady,
  onError,
  style,
}: Props) {
  if (!rpId) {
    throw new Error('ZeroDevExportWebView: rpId is required')
  }
  const wrapperOrigin = `https://${rpId}`

  const config = useConfig()
  const webViewRef = useRef<WebView>(null)
  // PUBLIC_KEY_READY can only be acted on once per mount. Resets when the
  // parent unmounts/remounts the component (e.g. on Hide → Reveal).
  const handledPubkey = useRef(false)
  // Tracks the requestId we sent on inject; BUNDLE_INJECTED is only honored
  // when the response carries the same id.
  const pendingInjectId = useRef<string | null>(null)

  const handleMessage = async (event: WebViewMessageEvent) => {
    let data: { type?: string; value?: string; requestId?: string }
    try {
      data = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }
    if (!data || typeof data.type !== 'string') return

    switch (data.type) {
      case 'PUBLIC_KEY_READY': {
        if (handledPubkey.current) return
        if (typeof data.value !== 'string') return
        handledPubkey.current = true
        try {
          const connector = getZeroDevConnector(config)
          const store = await getZeroDevStore(connector)
          const wallet = getZeroDevWallet(store)
          const bundle =
            kind === 'wallet'
              ? await exportWallet({ wallet, targetPublicKey: data.value })
              : await exportPrivateKey({
                  wallet,
                  targetPublicKey: data.value,
                })

          const requestId = uuidv4()
          pendingInjectId.current = requestId
          const payload: InjectPayload =
            kind === 'wallet'
              ? {
                  type: 'INJECT_WALLET_EXPORT_BUNDLE',
                  requestId,
                  value: bundle.exportBundle,
                  organizationId: bundle.organizationId,
                }
              : {
                  type: 'INJECT_KEY_EXPORT_BUNDLE',
                  requestId,
                  value: bundle.exportBundle,
                  organizationId: bundle.organizationId,
                  keyFormat: 'HEXADECIMAL',
                }

          webViewRef.current?.injectJavaScript(
            `window.__sendToTurnkey(${JSON.stringify(payload)}); true;`,
          )
        } catch (e) {
          onError?.(e instanceof Error ? e.message : 'Failed to fetch bundle')
        }
        return
      }
      case 'BUNDLE_INJECTED': {
        if (
          typeof data.requestId !== 'string' ||
          data.requestId !== pendingInjectId.current
        ) {
          return
        }
        pendingInjectId.current = null
        onReady?.()
        return
      }
      case 'ERROR':
        onError?.(typeof data.value === 'string' ? data.value : 'Export failed')
        return
      default:
        return
    }
  }

  return (
    <WebView
      ref={webViewRef}
      source={{ html: buildWrapperHtml(), baseUrl: wrapperOrigin }}
      originWhitelist={[wrapperOrigin, TURNKEY_EXPORT_ORIGIN, 'about:*']}
      onShouldStartLoadWithRequest={(request) => {
        const url = request.url
        if (url.startsWith('about:')) return true
        if (url === wrapperOrigin || url.startsWith(`${wrapperOrigin}/`)) {
          return true
        }
        if (
          url === TURNKEY_EXPORT_ORIGIN ||
          url.startsWith(`${TURNKEY_EXPORT_ORIGIN}/`)
        ) {
          return true
        }
        return false
      }}
      onMessage={handleMessage}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      allowsInlineMediaPlayback={false}
      mediaPlaybackRequiresUserAction
      incognito
      style={style}
    />
  )
}
