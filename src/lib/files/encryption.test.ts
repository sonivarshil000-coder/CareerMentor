import { describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import {
  decryptResumeBytes,
  encryptResumeBytes,
} from "@/lib/files/encryption";

describe("resume encryption", () => {
  const key = randomBytes(32);
  const source = Buffer.from("private resume content");

  it("round trips encrypted file bytes", () => {
    const encrypted = encryptResumeBytes(source, key);
    expect(encrypted.equals(source)).toBe(false);
    expect(decryptResumeBytes(encrypted, key)).toEqual(source);
  });

  it("rejects modified content and the wrong key", () => {
    const encrypted = encryptResumeBytes(source, key);
    const changed = Buffer.from(encrypted);
    changed[changed.length - 1] ^= 1;
    expect(() => decryptResumeBytes(changed, key)).toThrow();
    expect(() => decryptResumeBytes(encrypted, randomBytes(32))).toThrow();
  });
});
