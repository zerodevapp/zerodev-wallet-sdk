import { useRouter } from 'expo-router'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

type Props = {
  kind: 'wallet' | 'privateKey'
}

/**
 * Fail-closed screen rendered when `preventScreenCaptureAsync` rejects.
 * Replaces the entire reveal-screen body so the WebView never mounts and
 * the secret can't be screenshotted / recorded.
 */
export function CaptureFailedScreen({ kind }: Props) {
  const router = useRouter()
  const subject = kind === 'wallet' ? 'seed phrase' : 'private key'

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Export disabled</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.block}>
        <Text style={styles.error}>
          Could not enable screen-capture protection on this device. Export of
          the {subject} is disabled to prevent it being captured by a screenshot
          or screen recording.
        </Text>
        <TouchableOpacity
          style={[styles.button, styles.buttonAlt]}
          onPress={() => router.back()}
        >
          <Text style={styles.buttonAltText}>Back</Text>
        </TouchableOpacity>
      </View>
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
  block: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 16,
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  buttonAlt: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  buttonAltText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
})
