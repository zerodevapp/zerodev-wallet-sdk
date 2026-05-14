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
  },
})
