import { Link } from 'expo-router'
import { ScrollView, StyleSheet, View } from 'react-native'
import { ChainSwitcher } from '@/components/ChainSwitcher'
import { ConnectionStatusBar } from '@/components/ConnectionStatusBar'
import { SendTransaction } from '@/components/SendTransaction'

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ConnectionStatusBar />
      <ChainSwitcher />
      <ScrollView contentContainerStyle={styles.content}>
        <SendTransaction />
        <Link href="/export" style={styles.exportLink}>
          Export wallet →
        </Link>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: 50,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 20,
    flexGrow: 1,
    gap: 16,
  },
  exportLink: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 8,
  },
})
