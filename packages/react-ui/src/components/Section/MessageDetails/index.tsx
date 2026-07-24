import { DataRow } from '../../DataRow'
import { Section } from '..'

export interface MessageDetailsProps {
  details: Record<string, string>
}

/** Turn `"fromAddress"` into `"From Address"`; leaves already-cased strings
 * (starting with uppercase) as-is so callers can pass display labels through
 * unchanged. */
function camelCaseToTitle(str: string): string {
  if (str.length === 0 || str.at(0) === str.at(0)?.toUpperCase()) {
    return str
  }
  const words = str.replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return words
    .split(' ')
    .map((word) => (word.at(0) ?? '').toUpperCase() + word.slice(1))
    .join(' ')
}

export function MessageDetails({ details }: MessageDetailsProps) {
  return (
    <Section title="Message Details" iconName="message">
      {Object.entries(details).map(([label, value]) => (
        // Object keys are raw camelCase (e.g. "fromAddress"); the primitive
        // DataRow renders labels verbatim, so title-case them here.
        <DataRow key={label} label={camelCaseToTitle(label)} value={value} />
      ))}
    </Section>
  )
}
