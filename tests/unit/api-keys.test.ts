import { describe, expect, it } from "vitest";
import { bearerKey, hashApiKey, newApiKey } from "@/lib/api/keys";

describe("API keys", () => {
  it("makes long random keys and keeps only the hash", () => {
    const a = newApiKey();
    const b = newApiKey();
    expect(a.key).toMatch(/^pm_[A-Za-z0-9]{40}$/);
    expect(a.key).not.toBe(b.key);
    expect(a.hash).toBe(hashApiKey(a.key));
    expect(a.hash).not.toContain(a.key.slice(3));
    expect(a.prefix).toBe(a.key.slice(0, 10));
  });
  it("reads the key from a Bearer header and nothing else", () => {
    const { key } = newApiKey();
    expect(bearerKey(`Bearer ${key}`)).toBe(key);
    expect(bearerKey(key)).toBeNull();
    expect(bearerKey("Bearer sk_test_123")).toBeNull();
    expect(bearerKey(null)).toBeNull();
  });
});
