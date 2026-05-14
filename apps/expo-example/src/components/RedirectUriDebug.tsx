import * as Clipboard from 'expo-clipboard'
import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { OAUTH_REDIRECT_URI, VERIFY_EMAIL_REDIRECT_URI } from '@/config/auth'

/**
 * Debug helper: displays the computed redirect URIs and a Copy button so they
 * can be pasted into the backend project dashboard's Allowed Origins.
 *
 * Remove this component (and its import / usage) once the dashboard is
 * configured and OAuth + magic links are working.
 */
export function RedirectUriDebug() {
  return (
    <View style={styles.wrapper}>
      <RedirectUriRow label="OAUTH_REDIRECT_URI" uri={OAUTH_REDIRECT_URI} />
      <RedirectUriRow
        label="VERIFY_EMAIL_REDIRECT_URI"
        uri={VERIFY_EMAIL_REDIRECT_URI}
      />
    </View>
  )
}

function RedirectUriRow({ label, uri }: { label: string; uri: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await Clipboard.setStringAsync(uri)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label} (debug)</Text>
      <Text selectable style={styles.uri}>
        {uri}
      </Text>
      <TouchableOpacity onPress={handleCopy} style={styles.button}>
        <Text style={styles.buttonText}>{copied ? 'Copied!' : 'Copy'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    marginTop: 8,
  },
  box: {
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
