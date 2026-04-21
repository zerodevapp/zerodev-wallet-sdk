import type { MutationOptions, UseQueryOptions } from '@tanstack/react-query'

export interface Contact {
  name: string
  address: `0x${string}`
  imageSource?: string
}

const contactsStore: Contact[] = []

export const contactsQuery: UseQueryOptions<Contact[]> = {
  queryKey: ['contacts'],
  queryFn: async () => contactsStore,
}

export const addContactMutation: MutationOptions<Contact, Error, Contact> = {
  mutationFn: async (contact: Contact) => {
    contactsStore.push(contact)
    return contact
  },
}
