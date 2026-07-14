import { DataRow } from '@zerodev/react-ui'
import { shortenHex } from '../../../shared/utils/common'
import type { TypedDataField, TypedDataV4 } from './types'

const INDENT_CLASS = ['', 'zd:pl-2', 'zd:pl-4', 'zd:pl-6', 'zd:pl-8'] as const

function indentClass(level: number): string {
  return INDENT_CLASS[level] ?? INDENT_CLASS.at(-1) ?? ''
}

function formatValue(value: unknown, fieldType: string): string {
  if (value == null) return ''

  if (fieldType === 'bool') {
    return (value as boolean) ? 'True' : 'False'
  }

  if (typeof value === 'object') return ''

  const str =
    typeof value === 'bigint'
      ? value.toString()
      : String(value as string | number)

  if (fieldType === 'address') {
    return shortenHex(str)
  }

  if (fieldType.startsWith('bytes')) {
    return shortenHex(str)
  }

  return str
}

/** Returns the base type name stripped of any `[]` suffix. */
function baseType(fieldType: string): string {
  return fieldType.endsWith('[]') ? fieldType.slice(0, -2) : fieldType
}

interface Row {
  key: string
  label: string
  value?: string
  className: string
}

function buildRows(
  data: Record<string, unknown>,
  typeName: string,
  types: TypedDataV4['types'],
  level: number,
): Row[] {
  const fields = types[typeName] as TypedDataField[] | undefined
  if (!fields) return []

  const rows: Row[] = []

  for (const field of fields) {
    const value = data[field.name]

    // Array field
    if (Array.isArray(value)) {
      const elementType = baseType(field.type)
      const isStruct = elementType in types

      rows.push({
        key: `${level}-${field.name}-header`,
        label: field.name,
        className: indentClass(level),
      })
      for (let i = 0; i < value.length; i++) {
        if (isStruct) {
          rows.push({
            key: `${field.name}-${i}-header`,
            label: `[${i + 1}]`,
            className: indentClass(level + 1),
          })
          rows.push(
            ...buildRows(
              value[i] as Record<string, unknown>,
              elementType,
              types,
              level + 2,
            ),
          )
        } else {
          rows.push({
            key: `${field.name}-${i}`,
            label: `[${i + 1}]`,
            value: formatValue(value[i], elementType),
            className: indentClass(level + 1),
          })
        }
      }
      continue
    }

    // Nested struct
    if (
      baseType(field.type) in types &&
      typeof value === 'object' &&
      value !== null
    ) {
      rows.push({
        key: `${level}-${field.name}-header`,
        label: field.name,
        className: indentClass(level),
      })
      rows.push(
        ...buildRows(
          value as Record<string, unknown>,
          field.type,
          types,
          level + 1,
        ),
      )
      continue
    }

    // Primitive
    rows.push({
      key: `${level}-${field.name}`,
      label: field.name,
      value: formatValue(value, field.type),
      className: indentClass(level),
    })
  }

  return rows
}

export function TypedDataMessage({
  message,
  primaryType,
  types,
}: {
  message: Record<string, unknown>
  primaryType: string
  types: TypedDataV4['types']
}) {
  const rows = buildRows(message, primaryType, types, 0)

  return (
    <>
      {rows.map((row) => (
        <DataRow
          key={row.key}
          label={row.label}
          value={row.value}
          className={row.className}
        />
      ))}
    </>
  )
}
