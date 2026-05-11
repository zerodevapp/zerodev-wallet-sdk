import { Redirect, useRouter } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { CaptureFailedScreen } from '@/components/export/CaptureFailedScreen'
import { ExportBox } from '@/components/export/ExportBox'
import { WarningCard } from '@/components/export/WarningCard'
import { useAppChangeListener } from '@/hooks/useAppChangeListener'
import { usePreventScreenCapture } from '@/hooks/usePreventScreenCapture'
import { authenticateForReveal } from '@/lib/biometricAuth'
import { useExportConsent } from './_layout'

export default function ExportWalletScreen() {
  const router = useRouter()
  const { consented } = useExportConsent()
  const { protectionEnabled, preventionFailed } = usePreventScreenCapture()
  const [revealed, setRevealed] = useState(false)
  const [busy, setBusy] = useState(false)
  useAppChangeListener((next) => {
    if (next !== 'active') setRevealed(false)
  })

  if (!consented) return <Redirect href="/export" />
  if (preventionFailed) return <CaptureFailedScreen kind="wallet" />

  const handleToggle = async () => {
    if (revealed) {
      setRevealed(false)
      return
    }
    if (!protectionEnabled) return
    setBusy(true)
    try {
      const ok = await authenticateForReveal(
        'Authenticate to export seed phrase',
      )
      if (ok) setRevealed(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Seed phrase</Text>
        <View style={styles.headerSpacer} />
      </View>

      <WarningCard
        title="Warning!"
        body="Your seed phrase grants full control over your entire wallet and all its assets. Sharing or losing this phrase will lead to permanent loss of all your funds."
      />

      {revealed ? (
        <ExportBox kind="wallet" />
      ) : (
        <View style={styles.placeholderBox}>
          <Text style={styles.placeholderText}>
            Tap "Reveal" to display your seed phrase.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.button,
          (busy || !protectionEnabled) && styles.buttonDisabled,
        ]}
        onPress={handleToggle}
        disabled={busy || !protectionEnabled}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>
            {protectionEnabled ? (revealed ? 'Hide' : 'Reveal') : 'Securing...'}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={styles.footer}>
        Write down this phrase somewhere SAFE and OFFLINE. Never share it or
        post it anywhere public. This phrase is your ultimate backup to restore
        your wallet.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  headerSpacer: {
    width: 56,
  },
  back: {
    fontSize: 15,
    color: '#6366f1',
    width: 56,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  placeholderBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 12,
    minHeight: 200,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#a5b4fc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
})
