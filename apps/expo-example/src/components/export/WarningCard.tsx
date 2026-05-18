import { StyleSheet, Text, View } from 'react-native'

type Props = {
  title: string
  body: string
}

export function WarningCard({ title, body }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400e',
  },
  body: {
    fontSize: 14,
    color: '#92400e',
    lineHeight: 20,
  },
})
