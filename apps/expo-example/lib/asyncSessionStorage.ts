import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StorageAdapter } from '@zerodev/wallet-core'

export const asyncSessionStorage: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}
