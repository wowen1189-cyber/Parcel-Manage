import { createHash, randomBytes } from "node:crypto";

// API keys: "pm_" and 40 random characters. Only the SHA-256 is stored; the prefix lets people tell keys apart.
export { API_SCOPES, type ApiScope } from "./scopes";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newApiKey(): { key: string; hash: string; prefix: string } {
  const bytes = randomBytes(40);
  const key = `pm_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
  return { key, hash: hashApiKey(key), prefix: key.slice(0, 10) };
}

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** The key from "Authorization: Bearer pm_…", or null. */
export function bearerKey(header: string | null): string | null {
  const m = header?.match(/^Bearer\s+(pm_[A-Za-z0-9]{40})\s*$/);
  return m ? m[1] : null;
}
