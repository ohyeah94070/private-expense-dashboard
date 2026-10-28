import { createCipheriv, pbkdf2Sync, randomBytes, randomInt } from "node:crypto";
import { writeFile } from "node:fs/promises";

const rawInput = await new Promise((resolve, reject) => {
  const chunks = [];
  process.stdin.on("data", chunk => chunks.push(chunk));
  process.stdin.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  process.stdin.on("error", reject);
});
const input = JSON.parse(rawInput);
if (!input.raw || typeof input.raw !== "object") throw new Error("Missing Sheet data");
const expected = ["Stmt", "Budget", "Income & Transfers", "Large exp."];
if (!expected.every(name => Array.isArray(input.raw[name]))) throw new Error("Missing required Sheet tabs");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const generatedKey = Array.from({length:12}, () => alphabet[randomInt(alphabet.length)]).join("");
const recoveryKey = process.env.EXPENSE_SNAPSHOT_KEY || generatedKey;
if (!/^[A-Z]{12}$/.test(recoveryKey)) throw new Error("Recovery key must be exactly 12 uppercase letters");
const salt = randomBytes(16), iv = randomBytes(12), iterations = 600000;
const key = pbkdf2Sync(recoveryKey, salt, iterations, 32, "sha256");
const cipher = createCipheriv("aes-256-gcm", key, iv);
const createdAt = new Date().toISOString();
const source = Object.fromEntries(expected.map(name => [name, input.raw[name]]));
const plaintext = Buffer.from(JSON.stringify({ raw: source, createdAt }), "utf8");
const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
const snapshot = {
  version: 1,
  kdf: { name: "PBKDF2", hash: "SHA-256", iterations, salt: salt.toString("base64") },
  cipher: { name: "AES-256-GCM", iv: iv.toString("base64"), data: ciphertext.toString("base64") }
};
await writeFile(new URL("../snapshot.enc.json", import.meta.url), JSON.stringify(snapshot) + "\n");
console.log("Snapshot encrypted" + (process.env.EXPENSE_SNAPSHOT_KEY ? " with supplied key." : "; recovery key: " + recoveryKey));
console.log("Snapshot rows: " + expected.map(name => name + "=" + input.raw[name].length).join(", "));
