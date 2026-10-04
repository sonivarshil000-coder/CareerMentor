import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("ADSK", "ascii");
const FORMAT_VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + IV_LENGTH + TAG_LENGTH;

export function decodeFileEncryptionKey(encodedKey: string): Buffer {
  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32) {
    throw new Error("FILE_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptResumeBytes(plaintext: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("A 32-byte AES-256 key is required.");
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(MAGIC);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([
    MAGIC,
    Buffer.from([FORMAT_VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
}

export function decryptResumeBytes(encrypted: Buffer, key: Buffer): Buffer {
  if (key.length !== 32) throw new Error("A 32-byte AES-256 key is required.");
  if (
    encrypted.length < HEADER_LENGTH ||
    !encrypted.subarray(0, MAGIC.length).equals(MAGIC) ||
    encrypted[MAGIC.length] !== FORMAT_VERSION
  ) {
    throw new Error("The stored resume has an unsupported encryption format.");
  }

  const ivStart = MAGIC.length + 1;
  const iv = encrypted.subarray(ivStart, ivStart + IV_LENGTH);
  const tagStart = ivStart + IV_LENGTH;
  const tag = encrypted.subarray(tagStart, tagStart + TAG_LENGTH);
  const ciphertext = encrypted.subarray(HEADER_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
