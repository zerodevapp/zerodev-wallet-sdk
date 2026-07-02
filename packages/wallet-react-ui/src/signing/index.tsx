import type { CSSProperties, ReactNode } from 'react'
import { Screen } from '../shared/components/Screen'
import type { PendingRequest, Request } from '../types.js'
import { renderRequestContent } from './components/renderRequestContent.js'
import { usePendingRequest } from './hooks/usePendingRequest.js'
import { usePendingRequests } from './hooks/usePendingRequests.js'

type RenderPropArgs = {
  pendingRequest: PendingRequest | null
  confirm: () => void
  reject: () => void
}

type StyleProps = {
  className?: string | undefined
  style?: CSSProperties | undefined
}

export type SignatureRequestProps =
  | (StyleProps & {
      request?: never
      onConfirm?: never
      onReject?: never
      children?: (args: RenderPropArgs) => ReactNode
    })
  | (StyleProps & {
      request: Request
      onConfirm: () => void
      onReject: () => void
      children?: never
    })

export function SignatureRequest(props: SignatureRequestProps = {}) {
  if (props.request) {
    return (
      <ControlledSignatureRequest
        request={props.request}
        onConfirm={props.onConfirm}
        onReject={props.onReject}
        className={props.className}
        style={props.style}
      />
    )
  }
  return (
    <UncontrolledSignatureRequest
      className={props.className}
      style={props.style}
    >
      {props.children}
    </UncontrolledSignatureRequest>
  )
}

function ControlledSignatureRequest({
  request,
  onConfirm,
  onReject,
  className,
  style,
}: {
  request: Request
  onConfirm: () => void
  onReject: () => void
} & StyleProps) {
  return (
    <Screen className={className} style={style}>
      {renderRequestContent(request, onConfirm, onReject)}
    </Screen>
  )
}

function UncontrolledSignatureRequest({
  children,
  className,
  style,
}: {
  children: ((args: RenderPropArgs) => ReactNode) | undefined
} & StyleProps) {
  const { pendingRequest, confirm, reject } = usePendingRequest()
  const pendingRequests = usePendingRequests()

  if (typeof children === 'function') {
    return children({ pendingRequest, confirm, reject })
  }

  if (!pendingRequest) return null
  return (
    <Screen className={className} style={style}>
      {renderRequestContent(pendingRequest, confirm, reject)}
      {pendingRequests.length > 1 && (
        <p className="zd:text-xs zd:text-gray-500 zd:mt-3">
          +{pendingRequests.length - 1} more pending{' '}
          {pendingRequests.length - 1 === 1 ? 'request' : 'requests'}
        </p>
      )}
    </Screen>
  )
}
