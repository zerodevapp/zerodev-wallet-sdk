import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { REDIRECT_URI } from '@/oauth/redirectUri'

/**
 * Debug helper: displays the computed OAuth redirect URI and a Copy button so
 * it can be pasted into the backend project dashboard's Allowed Origins.
 *
 * Remove this component (and its import / usage in GoogleAuth.tsx) once the
 * dashboard is configured and OAuth is working.
 */
export function RedirectUriDebug() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await Clipboard.setStringAsync(REDIRECT_URI)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>REDIRECT_URI (debug)</Text>
      <Text selectable style={styles.uri}>
        {REDIRECT_URI}
      </Text>
      <TouchableOpacity onPress={handleCopy} style={styles.button}>
        <Text style={styles.buttonText}>{copied ? 'Copied!' : 'Copy'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  uri: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#111827',
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#111827',
  },
  buttonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
})
