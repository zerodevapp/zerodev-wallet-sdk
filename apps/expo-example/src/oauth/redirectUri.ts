import * as Linking from 'expo-linking'

export const REDIRECT_URI =
  process.env.EXPO_PUBLIC_REDIRECT_URI ?? Linking.createURL('oauth-callback')
