import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits standard for GCM
const SALT = "workspace-secrets-storage-salt-v1";
const KEY_LENGTH = 32; // 256 bits

// In-memory key cache keyed by secret string
const keyCache = new Map<string, Buffer>();

function getDerivedKey(masterSecret: string): Buffer {
  let key = keyCache.get(masterSecret);
  if (!key) {
    key = scryptSync(masterSecret, SALT, KEY_LENGTH);
    keyCache.set(masterSecret, key);
  }
  return key;
}

export type EncryptedPayload = {
  encryptedValue: string;
  iv: string;
  authTag: string;
};

/**
 * Encrypts a secret value using AES-256-GCM.
 */
export function encryptSecret(plaintext: string, masterSecret: string): EncryptedPayload {
  const key = getDerivedKey(masterSecret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return {
    encryptedValue: encrypted,
    iv: iv.toString("hex"),
    authTag,
  };
}

/**
 * Decrypts an AES-256-GCM payload.
 */
export function decryptSecret(payload: EncryptedPayload, masterSecret: string): string {
  const key = getDerivedKey(masterSecret);
  const iv = Buffer.from(payload.iv, "hex");
  const authTag = Buffer.from(payload.authTag, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(payload.encryptedValue, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
