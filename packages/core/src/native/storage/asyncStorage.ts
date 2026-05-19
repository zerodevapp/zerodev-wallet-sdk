import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage'
import * as AsyncStorageNS from '@react-native-async-storage/async-storage'
import type { StorageAdapter } from '../../storage/manager.js'

// CJS package whose `.d.ts` declares `export default AsyncStorage`. Our tsconfig
// keeps `esModuleInterop: false` (and `verbatimModuleSyntax: true`), so a plain
// `import AsyncStorage from '...'` types as the module namespace instead of
// the default. Unwrap explicitly. At runtime Metro returns the default object
// either way; this only affects the static type.
const AsyncStorage: AsyncStorageStatic = (
  AsyncStorageNS as unknown as { default: AsyncStorageStatic }
).default

export const asyncStorageAdapter: StorageAdapter = {
  getItem: (key) => AsyncStorage.getItem(key),
  setItem: (key, value) => AsyncStorage.setItem(key, value),
  removeItem: (key) => AsyncStorage.removeItem(key),
}
