import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Environment variable values are encrypted at rest with AES-256-GCM. The key comes from
 * ARCHITECT_SECRET when it's set (any random string; it isn't a third-party key), or a fixed
 * development key otherwise. Values only reach the browser when someone asks to reveal one.
 */

const DEV_SECRET = "architect-development-secret-change-me";

function key() {
  return createHash("sha256").update(process.env.ARCHITECT_SECRET || DEV_SECRET).digest();
}

/** "v1:<iv>:<tag>:<ciphertext>", all base64url. */
export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptSecret(stored: string) {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== "v1" || !iv || !tag || data === undefined) throw new Error("Unknown secret format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** "sk-demo-0000" → "••••••••0000". */
export function maskSecret(plain: string) {
  return `••••••••${plain.slice(-4)}`;
}
