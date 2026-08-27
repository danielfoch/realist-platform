import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const PREFIX = "enc:v1";

function key(secret: string): Buffer {
  if (secret.length < 16) throw new Error("Meetup token encryption secret must be at least 16 characters");
  return createHash("sha256").update(secret).digest();
}

export function encryptMeetupToken(value: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(":");
}

export function decryptMeetupToken(value: string, secret: string): string {
  if (!value.startsWith(`${PREFIX}:`)) return value;
  const [prefix, version, ivText, tagText, ciphertextText, ...rest] = value.split(":");
  if (`${prefix}:${version}` !== PREFIX || !ivText || !tagText || !ciphertextText || rest.length) {
    throw new Error("Stored Meetup token is malformed");
  }
  const decipher = createDecipheriv("aes-256-gcm", key(secret), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
