import { DataRow } from '../../DataRow'
import { Section } from '..'

export interface MessageDetailsProps {
  details: Record<string, string>
}

export function MessageDetails({ details }: MessageDetailsProps) {
  return (
    <Section title="Message Details" iconName="message">
      {Object.entries(details).map(([label, value]) => (
        <DataRow key={label} label={label} value={value} />
      ))}
    </Section>
  )
}
