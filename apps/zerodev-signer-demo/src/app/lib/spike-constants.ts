import { parseAbi } from 'viem'

export const NFT_ADDRESS = '0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808' as const
export const NFT_ABI = parseAbi(['function mint(address _to) public'])
