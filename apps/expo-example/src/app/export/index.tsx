import { useRouter } from 'expo-router'
import type { ReactNode } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { WarningCard } from '@/components/export/WarningCard'
import { useExportConsent } from './_layout'

export default function ExportConsentScreen() {
  const router = useRouter()
  const { consented, setConsented } = useExportConsent()

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Export Wallet Keys</Text>
          <View style={styles.headerSpacer} />
        </View>

        <WarningCard
          title="Warning!"
          body="Your wallet keys grant full control over your wallet and all its assets. Sharing or losing them can lead to permanent loss of funds."
        />

        <Checkbox checked={consented} onChange={setConsented}>
          I understand the implications and confirm I want to reveal my keys.
        </Checkbox>

        <PrimaryButton
          disabled={!consented}
          onPress={() => router.push('/export/private-key')}
        >
          Show Private Key
        </PrimaryButton>

        <PrimaryButton
          disabled={!consented}
          onPress={() => router.push('/export/wallet')}
          variant="secondary"
        >
          Show Seed Phrase
        </PrimaryButton>

        <Text style={styles.footer}>
          This will not export any settings or other app data.
        </Text>
      </ScrollView>
    </View>
  )
}

function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <TouchableOpacity
      style={styles.checkboxRow}
      onPress={() => onChange(!checked)}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked && <Text style={styles.checkboxMark}>✓</Text>}
      </View>
      <Text style={styles.checkboxLabel}>{children}</Text>
    </TouchableOpacity>
  )
}

function PrimaryButton({
  disabled,
  onPress,
  variant = 'primary',
  children,
}: {
  disabled?: boolean
  onPress: () => void
  variant?: 'primary' | 'secondary'
  children: ReactNode
}) {
  const isSecondary = variant === 'secondary'
  return (
    <TouchableOpacity
      style={[
        styles.button,
        isSecondary && styles.buttonSecondary,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          isSecondary ? styles.buttonSecondaryText : styles.buttonText,
          disabled && styles.buttonTextDisabled,
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#fff',
  },
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
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  checkboxMark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  buttonDisabled: {
    backgroundColor: '#e2e8f0',
    borderColor: '#e2e8f0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonSecondaryText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextDisabled: {
    color: '#94a3b8',
  },
  footer: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
  },
})
