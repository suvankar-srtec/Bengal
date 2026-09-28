import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class PasswordKeyError extends Error {
  constructor() { super("Manager password display is not configured. Set MANAGER_PASSWORD_KEY on the server."); }
}

function encryptionKey() {
  const value = process.env.MANAGER_PASSWORD_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(value)) throw new PasswordKeyError();
  return Buffer.from(value, "hex");
}

export function encryptManagerPassword(password: string, managerId: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(managerId));
  const encrypted = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("hex"), cipher.getAuthTag().toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptManagerPassword(value: string, managerId: string) {
  const [version, iv, tag, encrypted, extra] = value.split(":");
  if (version !== "v1" || extra !== undefined || !/^[a-f0-9]{24}$/.test(iv ?? "")
    || !/^[a-f0-9]{32}$/.test(tag ?? "") || !/^(?:[a-f0-9]{2})+$/.test(encrypted ?? "")) {
    throw new Error("Invalid encrypted password.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(managerId));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "hex")), decipher.final()]).toString("utf8");
}
