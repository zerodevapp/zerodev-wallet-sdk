/**
 * @zerodev/wallet-react-kit
 * React UI components and enhanced connector for ZeroDev Wallet SDK
 */

export { AuthFlow } from './auth'
// Auth
export type { CodeInputProps } from './auth/components/CodeInput'
export { CodeInput } from './auth/components/CodeInput'
export { useAuth } from './auth/hooks/useAuth'
export type { AuthMethod, AuthStep } from './auth/types'
// Connector
export type {
  SigningConfig,
  ZeroDevKitConfig,
  ZeroDevKitConnectorParams,
} from './connector.js'
export { zeroDevKitWallet } from './connector.js'
// Shared components
export type { ButtonProps } from './shared/components/Button'
export { Button } from './shared/components/Button'
export { Icon } from './shared/components/Icon'
export type { IconButtonProps } from './shared/components/IconButton'
export { IconButton } from './shared/components/IconButton'
export type { InputProps } from './shared/components/Input'
export { Input } from './shared/components/Input'
export type {
  StateImageName,
  StatusViewProps,
} from './shared/components/StatusView'
export { StatusView } from './shared/components/StatusView'
export type { TextProps } from './shared/components/Text'
export { Text } from './shared/components/Text'
export type { WrapperProps, WrapperVariant } from './shared/components/Wrapper'
export { Wrapper } from './shared/components/Wrapper'
// Signing
export { SignatureRequest } from './signing'
export { usePendingRequest } from './signing/hooks/usePendingRequest.js'

export type { PendingRequest, Request, RequestMethod } from './types.js'
