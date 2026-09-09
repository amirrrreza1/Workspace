import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret } from "./crypto.js";

describe("crypto utilities", () => {
  const masterKey = "my-super-secure-master-key-12345";

  it("encrypts and decrypts secret plaintext accurately", () => {
    const original = "postgres://admin:secret123@db.internal:5432/mydb?ssl=true";
    const encrypted = encryptSecret(original, masterKey);

    expect(encrypted.encryptedValue).not.toBe(original);
    expect(encrypted.iv).toHaveLength(24); // 12 bytes in hex
    expect(encrypted.authTag).toHaveLength(32); // 16 bytes in hex

    const decrypted = decryptSecret(encrypted, masterKey);
    expect(decrypted).toBe(original);
  });

  it("fails decryption if wrong master key is used", () => {
    const encrypted = encryptSecret("sensitive_token", masterKey);
    expect(() => decryptSecret(encrypted, "wrong-master-key")).toThrow();
  });

  it("fails decryption if ciphertext or auth tag is tampered", () => {
    const encrypted = encryptSecret("sensitive_token", masterKey);
    const tampered = { ...encrypted, authTag: "0".repeat(32) };
    expect(() => decryptSecret(tampered, masterKey)).toThrow();
  });
});
