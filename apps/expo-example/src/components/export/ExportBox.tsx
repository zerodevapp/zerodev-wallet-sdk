import { ZeroDevExportWebView } from '@zerodev/wallet-react/react-native/export/webview'
import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'

type Props = {
  kind: 'wallet' | 'privateKey'
}

type Stage = 'loading' | 'ready' | 'error'

/**
 * Bordered box that mounts the Turnkey export WebView. The page mounts
 * this only after biometric has passed, so this component is purely
 * about the WebView lifecycle once the user has authorized the reveal.
 *
 * Stages:
 *   - 'loading' (initial): WebView is rendered but invisible while it
 *     fetches and injects the bundle. A spinner placeholder shows.
 *   - 'ready': BUNDLE_INJECTED received, WebView visible.
 *   - 'error': fetch / iframe failure; renders an error message.
 *
 * Unmounting this component destroys the WebView (and the iframe-decrypted
 * secret it was holding).
 */
export function ExportBox({ kind }: Props) {
  const [stage, setStage] = useState<Stage>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  return (
    <View style={styles.box}>
      <View
        style={[
          styles.webViewWrapper,
          stage !== 'ready' && styles.webViewHidden,
        ]}
        pointerEvents={stage === 'ready' ? 'auto' : 'none'}
      >
        <ZeroDevExportWebView
          kind={kind}
          onReady={() => setStage('ready')}
          onError={(msg) => {
            setStage('error')
            setErrorMsg(msg)
          }}
          style={styles.webView}
        />
      </View>
      {stage === 'loading' && (
        <View style={styles.statusOverlay}>
          <ActivityIndicator color="#6366f1" />
          <Text style={styles.statusText}>Preparing secure export…</Text>
        </View>
      )}
      {stage === 'error' && (
        <View style={styles.statusOverlay}>
          <Text style={styles.error}>{errorMsg}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    minHeight: 200,
    overflow: 'hidden',
  },
  statusOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
  webViewWrapper: {
    flex: 1,
    minHeight: 180,
  },
  webViewHidden: {
    height: 0,
    minHeight: 0,
    opacity: 0,
  },
  webView: {
    backgroundColor: 'transparent',
    flex: 1,
  },
})
