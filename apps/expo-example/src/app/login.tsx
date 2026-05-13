import { ScrollView, StyleSheet, View } from 'react-native'
import { EmailAuth } from '@/components/EmailAuth'
import { GoogleAuth } from '@/components/GoogleAuth'
import { PasskeyAuth } from '@/components/PasskeyAuth'

export default function LoginScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <GoogleAuth />
        <PasskeyAuth />
        <EmailAuth />
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
