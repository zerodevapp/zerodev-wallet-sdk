/**
 * @zerodev/wallet-react-kit
 * React UI components and enhanced connector for ZeroDev Wallet SDK
 */

// Auth components
export type { CodeInputProps } from './auth/components/CodeInput'
export { CodeInput } from './auth/components/CodeInput'

// Signing
export { SignatureRequest } from './components/SignatureRequest/index.js'
export type {
  SigningConfig,
  ZeroDevKitConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'

// Connector
export { zeroDevKitWallet } from './connector.js'
export { usePendingRequest } from './hooks/usePendingRequest.js'

// Shared components
export type { ButtonProps } from './shared/components/Button'
export { Button } from './shared/components/Button'
export type { InputProps } from './shared/components/Input'
export { Input } from './shared/components/Input'
export type {
  StateImageName,
  StatusViewProps,
} from './shared/components/StatusView'
export { StatusView } from './shared/components/StatusView'
export type { WrapperProps, WrapperVariant } from './shared/components/Wrapper'
export { Wrapper } from './shared/components/Wrapper'

export type { PendingRequest, Request, RequestMethod } from './types.js'
