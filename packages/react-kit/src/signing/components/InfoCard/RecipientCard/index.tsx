import { useMutation, useQuery } from '@tanstack/react-query'

import defaultAvatar from '../../../../../../../assets/images/avatar.png'
import { Icon } from '../../../../shared/components/Icon'
import { Text } from '../../../../shared/components/Text'
import { WrappedPressable } from '../../../../shared/components/WrappedPressable'
import { Wrapper } from '../../../../shared/components/Wrapper'
import {
  addContactMutation,
  contactsQuery,
} from '../../../../shared/queries/contactsQueries'
import { shortenHex } from '../../../../shared/utils/common'
import { InfoCard } from '..'

export function RecipientCard({ address }: { address: `0x${string}` }) {
  const { data: contacts = [] } = useQuery(contactsQuery)
  const { mutate: addContact } = useMutation(addContactMutation)

  const savedContact = contacts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase(),
  )
  const displayName = savedContact ? savedContact.name : 'Unknown recipient'
  const imageSource = savedContact?.imageSource ?? defaultAvatar

  const handleSave = () => {
    window.alert(
      'TODO: Should display save contact modal prepopulated with address',
    )
    addContact({ name: 'New Contact', address })
  }

  const rightElement = savedContact ? (
    <Wrapper className="h-[52px] w-[52px] rounded-2xl p-1 flex items-center justify-center">
      <Icon name="checks" className="h-6 w-6 text-greyScale/50" />
    </Wrapper>
  ) : (
    <WrappedPressable onClick={handleSave} className="px-4 py-2">
      <Text className="font-medium text-greyScale">Save</Text>
    </WrappedPressable>
  )

  return (
    <InfoCard
      title={displayName}
      subtitle={shortenHex(address)}
      imageSource={imageSource}
      rightElement={rightElement}
      imageStyle="filled"
    />
  )
}
