import * as Clipboard from 'expo-clipboard'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useConnection, useDisconnect, useEnsName } from 'wagmi'

function truncateAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

const statusColors: Record<string, string> = {
  connected: '#22c55e',
  connecting: '#f59e0b',
  reconnecting: '#f59e0b',
  disconnected: '#ef4444',
}

export function ConnectionStatusBar() {
  const { address, status } = useConnection()
  const disconnect = useDisconnect()
  const { data: ensName } = useEnsName({
    address,
    query: { enabled: !!address },
  })

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View
          style={[
            styles.dot,
            { backgroundColor: statusColors[status] ?? '#9ca3af' },
          ]}
        />
        <Text style={styles.status}>{status}</Text>
      </View>
      {address && (
        <View style={styles.row}>
          <TouchableOpacity onPress={() => Clipboard.setStringAsync(address)}>
            <Text style={styles.address}>
              {truncateAddress(address)} <Text style={styles.copy}>copy</Text>
            </Text>
          </TouchableOpacity>
          {ensName && <Text style={styles.ens}>{ensName}</Text>}
          <TouchableOpacity onPress={() => disconnect.mutate()}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  status: {
    fontSize: 13,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  address: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#334155',
  },
  copy: {
    fontSize: 11,
    color: '#6366f1',
  },
  ens: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  disconnectText: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '500',
  },
})
