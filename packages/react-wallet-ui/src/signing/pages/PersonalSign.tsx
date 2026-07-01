import { Text } from '@zerodev/react-ui'
import type { Hex } from 'viem'
import { Section } from '../components/Section'
import { SigningLayout } from '../components/SigningLayout'
import { decodePersonalSignMessage } from '../utils/personalSign.js'

interface PersonalSignProps {
  data: Hex
  address: Hex
  confirm: () => void
  reject: () => void
}

export function PersonalSign({ data, confirm, reject }: PersonalSignProps) {
  const message = decodePersonalSignMessage(data)

  return (
    <SigningLayout onConfirm={confirm} onReject={reject}>
      <div className="flex flex-col gap-2 pt-4">
        <div className="flex flex-col items-center justify-center gap-2 pb-2">
          <Text className="text-h2">Signature Request</Text>
          <Text className="text-center">
            Review request details before you confirm.
          </Text>
        </div>
        <Section title="Message Details" iconName="message">
          <Text className="break-all">{message ?? data}</Text>
        </Section>
      </div>
    </SigningLayout>
  )
}
