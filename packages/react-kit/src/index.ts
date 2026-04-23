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
export type { AlertViewProps } from './shared/components/AlertView'
export { AlertView } from './shared/components/AlertView'
export type { BadgeProps } from './shared/components/Badge'
export { Badge } from './shared/components/Badge'
export type { ButtonProps } from './shared/components/Button'
export { Button } from './shared/components/Button'
export { Icon } from './shared/components/Icon'
export type { IconButtonProps } from './shared/components/IconButton'
export { IconButton } from './shared/components/IconButton'
export type { InputProps } from './shared/components/Input'
export { Input } from './shared/components/Input'
export type { ListItemProps } from './shared/components/ListItem'
export { ListItem } from './shared/components/ListItem'
export type {
  StateImageName,
  StatusViewProps,
} from './shared/components/StatusView'
export { StatusView } from './shared/components/StatusView'
export type { ToggleButtonProps } from './shared/components/ToggleButton'
export { ToggleButton } from './shared/components/ToggleButton'
export type { WrapperProps, WrapperVariant } from './shared/components/Wrapper'
export { Wrapper } from './shared/components/Wrapper'

// Signing
export { SignatureRequest } from './signing'
export type { DetailsContainerProps } from './signing/components/DetailsContainer'
export { DetailsContainer } from './signing/components/DetailsContainer'
export type { InfoCardProps } from './signing/components/InfoCard'
export { InfoCard } from './signing/components/InfoCard'
export type {
  GasFee,
  GasTier,
  TxGasFeesProps,
} from './signing/components/TxGasFees'
export { TxGasFees } from './signing/components/TxGasFees'
export { usePendingRequest } from './signing/hooks/usePendingRequest.js'

export type { PendingRequest, Request, RequestMethod } from './types.js'
