import { Section, Text } from '@zerodev/react-ui'
import type { Hex } from 'viem'
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
      <div className="zd:flex zd:flex-col zd:gap-2 zd:pt-4">
        <div className="zd:flex zd:flex-col zd:items-center zd:justify-center zd:gap-2 zd:pb-2">
          <Text className="zd:text-h2">Signature Request</Text>
          <Text className="zd:text-center">
            Review request details before you confirm.
          </Text>
        </div>
        <Section title="Message Details" iconName="message">
          <Text className="zd:break-all">{message ?? data}</Text>
        </Section>
      </div>
    </SigningLayout>
  )
}
