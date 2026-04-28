import type { ReactNode } from 'react'
import { ScreenWrapper } from '../shared/components/ScreenWrapper'
import type { PendingRequest, Request } from '../types.js'
import { renderRequestContent } from './components/renderRequestContent.js'
import { usePendingRequest } from './hooks/usePendingRequest.js'

type RenderPropArgs = {
  pendingRequest: PendingRequest | null
  confirm: () => void
  reject: () => void
}

export type SignatureRequestProps =
  | {
      request?: never
      onConfirm?: never
      onReject?: never
      children?: (args: RenderPropArgs) => ReactNode
    }
  | {
      request: Request
      onConfirm: () => void
      onReject: () => void
      children?: never
    }

export function SignatureRequest(props: SignatureRequestProps = {}) {
  if (props.request) {
    return (
      <ControlledSignatureRequest
        request={props.request}
        onConfirm={props.onConfirm}
        onReject={props.onReject}
      />
    )
  }
  return (
    <UncontrolledSignatureRequest>
      {props.children}
    </UncontrolledSignatureRequest>
  )
}

function ControlledSignatureRequest({
  request,
  onConfirm,
  onReject,
}: {
  request: Request
  onConfirm: () => void
  onReject: () => void
}) {
  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div style={{ paddingTop }}>
          {renderRequestContent(request, onConfirm, onReject)}
        </div>
      )}
    </ScreenWrapper>
  )
}

function UncontrolledSignatureRequest({
  children,
}: {
  children: ((args: RenderPropArgs) => ReactNode) | undefined
}) {
  const { pendingRequest, pendingRequests, confirm, reject } =
    usePendingRequest()

  if (typeof children === 'function') {
    return children({ pendingRequest, confirm, reject })
  }

  if (!pendingRequest) return null
  return (
    <ScreenWrapper>
      {({ paddingTop }) => (
        <div style={{ paddingTop }}>
          {renderRequestContent(pendingRequest, confirm, reject)}
          {pendingRequests.length > 1 && (
            <p className="text-xs text-gray-500 mt-3">
              +{pendingRequests.length - 1} more pending{' '}
              {pendingRequests.length - 1 === 1 ? 'request' : 'requests'}
            </p>
          )}
        </div>
      )}
    </ScreenWrapper>
  )
}
