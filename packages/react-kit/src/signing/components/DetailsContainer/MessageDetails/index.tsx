import { DataRow } from '../../DataRow'
import { DetailsContainer } from '..'

export interface MessageDetailsProps {
  details: Record<string, string>
}

export function MessageDetails({ details }: MessageDetailsProps) {
  return (
    <DetailsContainer title="Message Details" iconName="message">
      {Object.entries(details).map(([label, value]) => (
        <DataRow key={label} label={label} value={value} />
      ))}
    </DetailsContainer>
  )
}
