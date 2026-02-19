import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWebStorageAdapter } from './adapters.js'

// Create a mock Storage implementation
function createMockStorage(): Storage {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
    key: vi.fn((index: number) => {
      const keys = Array.from(store.keys())
      return keys[index] ?? null
    }),
    get length() {
      return store.size
    },
  }
}

describe('createWebStorageAdapter', () => {
  let mockStorage: Storage

  beforeEach(() => {
    mockStorage = createMockStorage()
  })

  describe('getItem', () => {
    it('retrieves item from storage', () => {
      const adapter = createWebStorageAdapter(mockStorage)
      mockStorage.setItem('test-key', 'test-value')

      const result = adapter.getItem('test-key')

      expect(result).toBe('test-value')
      expect(mockStorage.getItem).toHaveBeenCalledWith('test-key')
    })

    it('returns null for non-existent key', () => {
      const adapter = createWebStorageAdapter(mockStorage)

      const result = adapter.getItem('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('setItem', () => {
    it('stores item in storage', () => {
      const adapter = createWebStorageAdapter(mockStorage)

      adapter.setItem('test-key', 'test-value')

      expect(mockStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value')
      expect(mockStorage.getItem('test-key')).toBe('test-value')
    })

    it('overwrites existing items', () => {
      const adapter = createWebStorageAdapter(mockStorage)

      adapter.setItem('key', 'value1')
      adapter.setItem('key', 'value2')

      expect(mockStorage.getItem('key')).toBe('value2')
    })
  })

  describe('removeItem', () => {
    it('removes item from storage', () => {
      const adapter = createWebStorageAdapter(mockStorage)
      mockStorage.setItem('to-remove', 'value')

      adapter.removeItem('to-remove')

      expect(mockStorage.removeItem).toHaveBeenCalledWith('to-remove')
      expect(mockStorage.getItem('to-remove')).toBeNull()
    })

    it('does not throw for non-existent key', () => {
      const adapter = createWebStorageAdapter(mockStorage)

      expect(() => adapter.removeItem('nonexistent')).not.toThrow()
    })
  })

  describe('synchronous operations', () => {
    it('all operations are synchronous', () => {
      const adapter = createWebStorageAdapter(mockStorage)

      // All these should be sync (no promises)
      const setResult = adapter.setItem('key', 'value')
      const getResult = adapter.getItem('key')
      const removeResult = adapter.removeItem('key')

      expect(setResult).toBeUndefined()
      expect(getResult).toBe('value')
      expect(removeResult).toBeUndefined()
    })
  })
})
