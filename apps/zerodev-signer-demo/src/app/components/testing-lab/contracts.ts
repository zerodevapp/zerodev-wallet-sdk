import { type Abi, type Address, parseAbi } from "viem";
import { arbitrumSepolia } from "viem/chains";

/**
 * Registry of test contracts deployed for the Testing Lab.
 *
 * This is the SINGLE SOURCE OF TRUTH for the addresses/ABIs used by the
 * Contracts tab — both the balances panel and the interaction test cases read
 * from here. When another project deploys a new test contract, add an entry
 * below (and export a typed const like `TEST_ERC20` if an interaction case
 * needs its ABI with literal types). Everything downstream picks it up.
 */

export type TestContractKind = "erc20" | "erc721" | "custom";

export interface TestContract {
  /** Stable key, used for React keys and lookups. */
  key: string;
  /** Human-readable name shown in the UI. */
  name: string;
  kind: TestContractKind;
  address: Address;
  /** Chain the contract is deployed on. */
  chainId: number;
  /** Full ABI (reads + writes). */
  abi: Abi;
}

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
 * Test ERC20 on Arbitrum Sepolia. Exported as a typed const so interaction
 * cases (e.g. Erc20ContractTest) get literal ABI types for `writeContract`.
 */
export const TEST_ERC20 = {
  key: "test-erc20-arb-sepolia",
  name: "Test ERC20",
  kind: "erc20" as const,
  address: "0x7358eca9B17E833F09E911F46b6AC2cD96c7C806" as Address,
  chainId: arbitrumSepolia.id,
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
 * Test ERC721 (Test NFT / TNFT) on Arbitrum Sepolia — fully on-chain metadata
 * (base64 data URI) pointing at one shared IPFS image (settable via
 * `setImageURI`). Exported as a typed const so interaction cases get literal
 * ABI types for `writeContract`.
 */
export const TEST_ERC721 = {
  key: "test-erc721-arb-sepolia",
  name: "Test NFT (TNFT)",
  kind: "erc721" as const,
  address: "0xc707054cdc1930Eab467F4Edce7443cB45505d57" as Address,
  chainId: arbitrumSepolia.id,
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

/** Minimal custom contract on Arbitrum Sepolia (arbitrary contract call). */
export const TEST_HELLO_WORLD = {
  key: "test-helloworld-arb-sepolia",
  name: "HelloWorld",
  kind: "custom" as const,
  address: "0x675b6783E57FbE73207da8b73dDDad7CAd74d6f1" as Address,
  chainId: arbitrumSepolia.id,
  abi: helloWorldAbi,
};

/** All deployed test contracts. Add new deployments here. */
export const TEST_CONTRACTS: TestContract[] = [
  TEST_ERC20,
  TEST_ERC721,
  TEST_HELLO_WORLD,
];

export const getContractsByKind = (kind: TestContractKind): TestContract[] =>
  TEST_CONTRACTS.filter((contract) => contract.kind === kind);
