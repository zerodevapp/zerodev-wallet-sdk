import type { PartialBy } from "viem";
import type { DoorwaySession } from "../types/session.js";

/**
 * Parses a session from a JWT.
 *
 * @param token - The JWT to parse.
 * @returns {PartialBy<DoorwaySession, "createdAt" | "id" | "stamperType">} - The parsed session.
 */
export function parseSession(
  token: string | DoorwaySession
): PartialBy<DoorwaySession, "createdAt" | "id" | "stamperType"> {
  if (typeof token !== "string") {
    return token;
  }
  const [, payload] = token.split(".");
  if (!payload) {
    throw new Error("Invalid JWT: Missing payload");
  }

  const decoded = JSON.parse(atob(payload));
  const {
    exp,
    public_key: publicKey,
    session_type: sessionType,
    user_id: userId,
    organization_id: organizationId,
  } = decoded;

  if (!exp || !publicKey || !sessionType || !userId || !organizationId) {
    throw new Error("JWT payload missing required fields");
  }

  return {
    sessionType,
    userId,
    organizationId,
    expiry: exp,
    token: publicKey,
  };
}

/**
 * Normalizes a timestamp to milliseconds.
 *
 * @param timestamp - The timestamp to normalize.
 * @returns {number} - The normalized timestamp.
 */
export function normalizeTimestamp(timestamp: number): number {
  return timestamp < 1e10 ? timestamp * 1_000 : timestamp;
}

/**
 * Generates a random buffer of 32 bytes.
 *
 * @returns {ArrayBuffer} - The random buffer.
 */
export const generateRandomBuffer = (): ArrayBuffer => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return arr.buffer;
};

/**
 * Encodes a challenge in base64url format.
 *
 * @param challenge - The challenge to encode.
 * @returns {string} - The encoded challenge.
 */
export const base64UrlEncode = (challenge: ArrayBuffer): string => {
  return Buffer.from(challenge)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
};

/**
 * Compresses an uncompressed P-256 public key into its 33-byte compressed form.
 *
 * @param {Uint8Array} raw - The uncompressed public key (65 bytes, starting with 0x04).
 * @returns {Uint8Array} - The compressed public key (33 bytes, starting with 0x02 or 0x03).
 * @throws {Error} - If the input key is not a valid uncompressed P-256 key.
 */
export function pointEncode(raw: Uint8Array): Uint8Array {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error("Invalid uncompressed P-256 key");
  }

  const x = raw.slice(1, 33);
  const y = raw.slice(33, 65);

  if (x.length !== 32 || y.length !== 32) {
    throw new Error("Invalid x or y length");
  }

  const prefix = (y[31]! & 1) === 0 ? 0x02 : 0x03;

  const compressed = new Uint8Array(33);
  compressed[0] = prefix;
  compressed.set(x, 1);
  return compressed;
}

/**
 * Converts a Uint8Array into a lowercase hex string.
 *
 * @param {Uint8Array} input - The input byte array.
 * @returns {string} - The resulting hex string.
 */
export function uint8ArrayToHexString(input: Uint8Array): string {
  return input.reduce(
    (result, x) => result + x.toString(16).padStart(2, "0"),
    ""
  );
}

/**
 * Generates a compressed public key from a key pair.
 *
 * @returns {Promise<string>} - The compressed public key.
 */
export async function generateCompressedPublicKeyFromKeyPair(keyPair: CryptoKeyPair): Promise<string> {
  const rawPubKey = new Uint8Array(
    await crypto.subtle.exportKey("raw", keyPair.publicKey)
  );
  const compressedPubKey = pointEncode(rawPubKey);
  const compressedHex = uint8ArrayToHexString(compressedPubKey);
  return compressedHex;
}
