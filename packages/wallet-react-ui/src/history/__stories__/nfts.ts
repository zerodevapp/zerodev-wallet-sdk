import { scenario } from './goldens'

/** NFTs on either side: received, sent, approved, swapped for a token and
 * for another NFT, minted for ETH and for a token, in quantity, and a
 * withdrawal receipt whose name is its bare token id. */
export const nfts = scenario([
  'nftReceive',
  'nftSend',
  'approveNft',
  'approveCollection',
  'swapNftForToken',
  'swapNftForNft',
  'mint',
  'mintManyNfts',
  'mintNftQuantity',
  'mintNftForToken',
  'withdrawNftReceipt',
])
