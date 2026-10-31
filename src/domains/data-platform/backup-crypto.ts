import { gcm } from '@noble/ciphers/aes.js';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

import { BackupError } from './data-transfer';

const FORMAT = 'ironvant-encrypted';
const ITERATIONS = 210000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
export const MIN_PASSWORD_LENGTH = 8;

type EncryptedBackup = {
  format: typeof FORMAT;
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  nonce: string;
  ciphertext: string;
};

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function fromHex(text: string) {
  if (text.length % 2 !== 0 || !/^[0-9a-f]*$/.test(text)) {
    throw new BackupError('damaged');
  }
  const bytes = new Uint8Array(text.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(text.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function deriveKey(password: string, salt: Uint8Array, iterations: number) {
  return pbkdf2Async(sha256, password, salt, { c: iterations, dkLen: KEY_BYTES });
}

export function isEncryptedBackup(text: string) {
  try {
    return (JSON.parse(text) as { format?: unknown })?.format === FORMAT;
  } catch {
    return false;
  }
}

export async function encryptBackup(
  plain: string,
  password: string,
  randomBytes: (count: number) => Uint8Array,
  iterations = ITERATIONS,
) {
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(NONCE_BYTES);
  const key = await deriveKey(password, salt, iterations);
  const ciphertext = gcm(key, nonce).encrypt(new TextEncoder().encode(plain));
  const encrypted: EncryptedBackup = {
    format: FORMAT,
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations,
    salt: toHex(salt),
    nonce: toHex(nonce),
    ciphertext: toHex(ciphertext),
  };
  return JSON.stringify(encrypted);
}

export class WrongPasswordError extends Error {
  constructor() {
    super('The password does not open this backup');
    this.name = 'WrongPasswordError';
  }
}

export async function decryptBackup(text: string, password: string) {
  const { iterations, salt, nonce, ciphertext } = JSON.parse(text) as EncryptedBackup;
  if (!Number.isInteger(iterations) || iterations <= 0) {
    throw new BackupError('damaged');
  }
  const key = await deriveKey(password, fromHex(salt), iterations);
  try {
    return new TextDecoder().decode(gcm(key, fromHex(nonce)).decrypt(fromHex(ciphertext)));
  } catch {
    throw new WrongPasswordError();
  }
}
