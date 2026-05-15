import { useRouter } from 'expo-router'
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

export default function ExportUnsupportedWebScreen() {
  const router = useRouter()

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Export disabled</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.body}>
        Wallet export is available only in the native example app.
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
  body: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
})
