import './global.css'

import { Button } from '@zerodev/wallet-react-native-kit'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>React Native Example</Text>
      <View style={styles.buttonRow}>
        <Button text="Primary Button" action="primary" />
        <Button text="Secondary Button" action="secondary" />
        <Button text="Disabled" action="primary" disabled />
      </View>
      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  buttonRow: {
    width: '100%',
    gap: 12,
  },
})
