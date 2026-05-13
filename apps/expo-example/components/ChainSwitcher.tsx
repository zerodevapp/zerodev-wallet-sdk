import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useChains, useConnection, useSwitchChain } from 'wagmi'

export function ChainSwitcher() {
  const { chainId } = useConnection()
  const { mutate: switchChain, isPending } = useSwitchChain()
  const chains = useChains()

  return (
    <View style={styles.container}>
      {chains.map((chain) => {
        const isActive = chainId === chain.id
        return (
          <TouchableOpacity
            key={chain.id}
            style={[styles.chip, isActive && styles.chipActive]}
            onPress={() => switchChain({ chainId: chain.id })}
            disabled={isActive || isPending}
          >
            <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
              {chain.name}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#6366f1',
  },
  chipText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
  },
})
