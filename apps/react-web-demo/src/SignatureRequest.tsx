import type { PendingRequest } from '@zerodev/wallet-react'
import { usePendingRequest } from '@zerodev/wallet-react'
import { type ReactNode, useEffect } from 'react'

type RenderProps = {
  pendingRequest: PendingRequest
  confirm: () => void
  reject: () => void
}

type UncontrolledProps = {
  children?: (props: RenderProps) => ReactNode
}

type ControlledProps = {
  method: string
  params: unknown
  onConfirm: () => void
  onReject: () => void
}

type Props = UncontrolledProps | ControlledProps

function isControlled(props: Props): props is ControlledProps {
  return 'onConfirm' in props
}

export function SignatureRequest(props: Props) {
  if (isControlled(props)) {
    return <ControlledView {...props} />
  }
  return <UncontrolledView>{props.children}</UncontrolledView>
}

function UncontrolledView({ children }: UncontrolledProps) {
  const { pendingRequest, confirm, reject, register, deregister } =
    usePendingRequest()

  useEffect(() => {
    register()
    return deregister
  }, [register, deregister])

  if (!pendingRequest) return null

  if (children) {
    return <>{children({ pendingRequest, confirm, reject })}</>
  }

  return (
    <DefaultUI
      method={pendingRequest.method}
      kind={pendingRequest.kind}
      params={pendingRequest.params}
      onConfirm={confirm}
      onReject={reject}
    />
  )
}

function ControlledView({
  method,
  params,
  onConfirm,
  onReject,
}: ControlledProps) {
  return (
    <DefaultUI
      method={method}
      params={params}
      onConfirm={onConfirm}
      onReject={onReject}
      note="Controlled mode — driven by props"
    />
  )
}

function DefaultUI({
  method,
  kind,
  params,
  onConfirm,
  onReject,
  note,
}: {
  method: string
  kind?: string
  params: unknown
  onConfirm: () => void
  onReject: () => void
  note?: string
}) {
  return (
    <div style={cardStyle}>
      <h2 style={{ margin: '0 0 16px' }}>Confirm Request</h2>
      {note && (
        <p style={{ fontSize: 11, color: '#888', margin: '0 0 12px' }}>
          {note}
        </p>
      )}

      <div style={fieldStyle}>
        <strong>Method:</strong> {method}
      </div>
      {kind && (
        <div style={fieldStyle}>
          <strong>Kind:</strong> {kind}
        </div>
      )}

      <pre style={preStyle}>
        {JSON.stringify(
          params,
          (_key, value) =>
            typeof value === 'bigint' ? value.toString() : value,
          2,
        )}
      </pre>

      <div style={buttonRowStyle}>
        <button type="button" onClick={onReject} style={rejectButtonStyle}>
          Reject
        </button>
        <button type="button" onClick={onConfirm} style={confirmButtonStyle}>
          Confirm
        </button>
      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#111827',
  color: '#e0e0e0',
  borderRadius: 12,
  padding: 24,
  marginTop: 24,
  border: '1px solid #333',
}

const fieldStyle: React.CSSProperties = {
  marginBottom: 8,
  fontSize: 14,
}

const preStyle: React.CSSProperties = {
  background: '#0d0d1a',
  padding: 12,
  borderRadius: 8,
  overflow: 'auto',
  fontSize: 12,
  maxHeight: 200,
  margin: '12px 0',
}

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  marginTop: 16,
}

const rejectButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 8,
  border: '1px solid #555',
  background: 'transparent',
  color: '#e0e0e0',
  cursor: 'pointer',
  fontSize: 14,
}

const confirmButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: 8,
  border: 'none',
  background: '#4f46e5',
  color: 'white',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
}
