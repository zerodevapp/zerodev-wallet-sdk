import { type Abi, type Address, parseAbi } from "viem";
import { arbitrumSepolia, sepolia } from "viem/chains";

/**
 * Registry of test contracts deployed for the Testing Lab.
 *
 * This is the SINGLE SOURCE OF TRUTH for the addresses/ABIs used by the
 * Contracts tab — both the balances panel and the interaction test cases read
 * from here. When another project deploys a new test contract, add an entry
 * below (and export a typed const like `TEST_ERC20` if an interaction case
 * needs its ABI with literal types). Everything downstream picks it up.
 */

/**
 * The chains every entry in `TEST_CONTRACTS` is deployed on. Same source on
 * both, but each is an independent deployment — mints, `imageURI` and `message`
 * do not carry across.
 */
export const TEST_CONTRACT_CHAINS = [arbitrumSepolia, sepolia] as const;

export type TestContractKind = "erc20" | "erc721" | "custom";

export interface TestContract {
  /** Stable key, used for React keys and lookups. */
  key: string;
  /** Human-readable name shown in the UI. */
  name: string;
  kind: TestContractKind;
  /** Deployment address per chain id. */
  addresses: Record<number, Address>;
  /** Full ABI (reads + writes). */
  abi: Abi;
}

/** The deployment on `chainId`, or undefined if there isn't one. */
export const addressOn = (
  contract: { addresses: Record<number, Address> },
  chainId: number | undefined,
): Address | undefined =>
  chainId === undefined ? undefined : contract.addresses[chainId];

export const isTestContractChain = (chainId: number | undefined): boolean =>
  TEST_CONTRACT_CHAINS.some((chain) => chain.id === chainId);

/** For prose: "Arbitrum Sepolia or Sepolia". */
export const TEST_CONTRACT_CHAIN_NAMES = TEST_CONTRACT_CHAINS.map(
  (chain) => chain.name,
).join(" or ");

/** ABI for the deployed test ERC20 (reads + the writes exercised by the lab). */
export const testErc20Abi = parseAbi([
  // reads
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  // writes
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 value) returns (bool)",
  "function transfer(address to, uint256 value) returns (bool)",
  "function transferFrom(address from, address to, uint256 value) returns (bool)",
]);

/**
 * Test ERC20. Exported as a typed const so interaction
 * cases (e.g. Erc20ContractTest) get literal ABI types for `writeContract`.
 */
export const TEST_ERC20 = {
  key: "test-erc20",
  name: "Test ERC20",
  kind: "erc20" as const,
  addresses: {
    [arbitrumSepolia.id]: "0x7358eca9B17E833F09E911F46b6AC2cD96c7C806" as Address,
    [sepolia.id]: "0x05358932e81cc0e8324d39187fe8fce0672f1f06" as Address,
  },
  abi: testErc20Abi,
};

/** ABI for the deployed test ERC721 (reads + the writes exercised by the lab). */
export const testErc721Abi = parseAbi([
  // reads
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function imageURI() view returns (string)",
  "function getApproved(uint256 tokenId) view returns (address)",
  "function isApprovedForAll(address owner, address operator) view returns (bool)",
  // writes (mint + setImageURI are open, no access control; ids auto-increment)
  "function mint(address to) returns (uint256)",
  "function setImageURI(string uri)",
  "function approve(address to, uint256 tokenId)",
  "function setApprovalForAll(address operator, bool approved)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
]);

/**
 * Test ERC721 (Test NFT / TNFT) — fully on-chain metadata
 * (base64 data URI) pointing at one shared IPFS image (settable via
 * `setImageURI`). Exported as a typed const so interaction cases get literal
 * ABI types for `writeContract`.
 */
export const TEST_ERC721 = {
  key: "test-erc721",
  name: "Test NFT (TNFT)",
  kind: "erc721" as const,
  addresses: {
    [arbitrumSepolia.id]: "0xc707054cdc1930Eab467F4Edce7443cB45505d57" as Address,
    [sepolia.id]: "0xf29d9b0c4d5ad90722019ff6336c94cb889f0f98" as Address,
  },
  abi: testErc721Abi,
};

/**
 * ABI for the minimal HelloWorld contract — the "arbitrary contract call" UI
 * case. `setMessage` is a plain non-token write, so the review popup renders
 * its generic call view; `MessageSet` gives an event to observe after a write.
 */
export const helloWorldAbi = parseAbi([
  "function message() view returns (uint256)",
  "function readMessage() view returns (uint256)",
  "function setMessage(uint256 newMessage)",
  "event MessageSet(uint256 indexed message)",
]);

/** Minimal custom contract (arbitrary contract call). */
export const TEST_HELLO_WORLD = {
  key: "test-helloworld",
  name: "HelloWorld",
  kind: "custom" as const,
  addresses: {
    [arbitrumSepolia.id]: "0x675b6783E57FbE73207da8b73dDDad7CAd74d6f1" as Address,
    [sepolia.id]: "0x19e1b5c5e4e777e4ad6b5e0a62f4b7385fbbfd24" as Address,
  },
  abi: helloWorldAbi,
};

/**
 * The NFT `zerodev-signer-demo` mints against, kept so the lab exercises the
 * same target the demo did rather than only the lab's own ERC721.
 *
 * Deliberately outside `TEST_CONTRACTS`: that registry is single-chain
 * (`TEST_CONTRACTS_CHAIN`) and this is deployed per chain, so it can't be
 * described by a `TestContract` entry.
 */
export const demoNftAbi = parseAbi([
  "function balanceOf(address owner) external view returns (uint256 balance)",
  "function mint(address _to) public",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

export const DEMO_NFT_ADDRESSES: Record<number, Address> = {
  [sepolia.id]: "0x34bE7f35132E97915633BC1fc020364EA5134863" as Address,
  [arbitrumSepolia.id]: "0x4eae0b2130d5c3be154ebc851cd1dc0cc694b808" as Address,
};

/** All deployed test contracts. Add new deployments here. */
export const TEST_CONTRACTS: TestContract[] = [
  TEST_ERC20,
  TEST_ERC721,
  TEST_HELLO_WORLD,
];

export const getContractsByKind = (kind: TestContractKind): TestContract[] =>
  TEST_CONTRACTS.filter((contract) => contract.kind === kind);
