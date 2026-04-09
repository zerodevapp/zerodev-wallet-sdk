import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react'
import type { StoreApi } from 'zustand'
import { createStore, type State } from '../store'
import type { AuthConfig } from './types'

const AuthStoreContext = createContext<StoreApi<State> | null>(null)

export function useAuthStore() {
  const store = useContext(AuthStoreContext)
  if (!store) {
    throw new Error('useAuthStore must be used within AuthProvider')
  }
  return store
}

interface AuthProviderProps {
  config: AuthConfig
  children: ReactNode
}

export function AuthProvider({ config, children }: AuthProviderProps) {
  const storeRef = useRef<StoreApi<State>>(createStore())

  if (!storeRef.current) {
    storeRef.current = createStore()
  }

  useEffect(() => {
    storeRef.current?.getState().initializeAuth(config)
  }, [config])

  return (
    <AuthStoreContext.Provider value={storeRef.current}>
      {children}
    </AuthStoreContext.Provider>
  )
}
