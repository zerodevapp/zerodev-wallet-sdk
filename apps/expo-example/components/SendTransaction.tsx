import { useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { formatEther, parseEther } from 'viem'
import {
  useBalance,
  useConnection,
  useSendTransaction,
  useTransactionConfirmations,
  useWaitForTransactionReceipt,
} from 'wagmi'

export function SendTransaction() {
  const { address } = useConnection()
  const { data: balance, refetch: refetchBalance } = useBalance({ address })
  const {
    mutate: sendTx,
    isPending,
    data: hash,
    error,
  } = useSendTransaction({
    mutation: {
      onError(err) {
        console.error('SendTransaction error:', err)
      },
    },
  })

  const { data: receipt, isLoading: isConfirming } =
    useWaitForTransactionReceipt({ hash })

  const { data: confirmations, refetch: refetchConfirmations } =
    useTransactionConfirmations({ hash })

  const [to, setTo] = useState('0xEDF046f42aC27fD7870169B2E1B8fc2B090b9841')
  const [amount, setAmount] = useState('0')

  const gasCost =
    receipt?.gasUsed && receipt.effectiveGasPrice
      ? formatEther(receipt.gasUsed * receipt.effectiveGasPrice)
      : null

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Send Transaction</Text>

      <View style={styles.balanceRow}>
        <Text style={styles.label}>Balance</Text>
        <View style={styles.balanceRight}>
          <Text style={styles.balance}>
            {balance ? `${formatEther(balance.value)} ${balance.symbol}` : '—'}
          </Text>
          <TouchableOpacity onPress={() => refetchBalance()}>
            <Text style={styles.refreshButton}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.label}>To</Text>
      <TextInput
        style={styles.input}
        value={to}
        onChangeText={setTo}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <Text style={styles.label}>Amount (ETH)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
      />

      <TouchableOpacity
        style={[styles.button, isPending && styles.buttonDisabled]}
        onPress={() =>
          sendTx({
            to: to as `0x${string}`,
            value: parseEther(amount),
          })
        }
        disabled={isPending}
      >
        {isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send</Text>
        )}
      </TouchableOpacity>

      {hash && (
        <View style={styles.receiptContainer}>
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(`https://sepolia.etherscan.io/tx/${hash}`)
            }
          >
            <Text style={styles.hash}>
              {hash.slice(0, 10)}...{hash.slice(-8)} ↗
            </Text>
          </TouchableOpacity>

          <View style={styles.receiptRow}>
            <Text style={styles.label}>Status</Text>
            {isConfirming ? (
              <View style={styles.statusRow}>
                <ActivityIndicator size="small" color="#f59e0b" />
                <Text style={styles.statusPending}>Confirming...</Text>
              </View>
            ) : receipt ? (
              <Text
                style={
                  receipt.status === 'success'
                    ? styles.statusSuccess
                    : styles.statusReverted
                }
              >
                {receipt.status === 'success' ? 'Success' : 'Reverted'}
              </Text>
            ) : null}
          </View>

          {confirmations != null && (
            <View style={styles.receiptRow}>
              <Text style={styles.label}>Confirmations</Text>
              <View style={styles.statusRow}>
                <Text style={styles.receiptValue}>
                  {confirmations.toString()}
                </Text>
                <TouchableOpacity onPress={() => refetchConfirmations()}>
                  <Text style={styles.refreshButton}>Refresh</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {gasCost && (
            <View style={styles.receiptRow}>
              <Text style={styles.label}>Gas fee</Text>
              <Text style={styles.receiptValue}>{gasCost} ETH</Text>
            </View>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error.message}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    gap: 10,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 12,
    borderRadius: 8,
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  balance: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  refreshButton: {
    fontSize: 13,
    color: '#6366f1',
    fontWeight: '500',
  },
  label: {
    fontSize: 13,
    color: '#64748b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#6366f1',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  receiptContainer: {
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptValue: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#334155',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusPending: {
    fontSize: 13,
    color: '#f59e0b',
    fontWeight: '500',
  },
  statusSuccess: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  statusReverted: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
  },
  hash: {
    fontSize: 13,
    fontFamily: 'monospace',
    color: '#166534',
  },
  error: {
    color: '#ef4444',
    fontSize: 14,
    textAlign: 'center',
  },
})
