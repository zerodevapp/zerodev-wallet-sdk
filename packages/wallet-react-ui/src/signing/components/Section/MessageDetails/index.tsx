import { DataRow } from '@zerodev/react-ui'
import { camelCaseToTitle } from '../../../../shared/utils/common'
import { Section } from '..'

export interface MessageDetailsProps {
  details: Record<string, string>
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
