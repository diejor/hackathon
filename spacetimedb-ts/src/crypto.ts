// Replaces the hand-written Sha256.cs and Ed25519.cs: SHA-256 / HMAC-SHA256 and Ed25519 verification from
// the audited pure-JS @noble libraries, plus base64/hex/UTF-8 helpers (the module runtime has no
// btoa/atob/Buffer/crypto, only TextEncoder/TextDecoder).
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 as nobleSha256 } from '@noble/hashes/sha2.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const utf8 = (s: string): Uint8Array => encoder.encode(s);
export const fromUtf8 = (b: Uint8Array): string => decoder.decode(b);

export function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const r = new Uint8Array(a.length + b.length);
  r.set(a, 0);
  r.set(b, a.length);
  return r;
}

export const sha256 = (data: Uint8Array): Uint8Array => nobleSha256(data);
export const hmacSha256 = (key: Uint8Array, message: Uint8Array): Uint8Array => hmac(nobleSha256, key, message);

// Constant-time comparison (doesn't leak how many leading bytes matched).
export function fixedTimeEquals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

// True when `signature` (64 bytes: R || S) is a valid Ed25519 signature of `message` by `publicKey` (32 bytes).
// Strict RFC 8032 rules (zip215: false), like the C# version and libsodium.
export function ed25519Verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, publicKey, { zip215: false });
  } catch {
    return false;
  }
}

// Convert.FromHexString after a Trim; null for odd length or non-hex characters.
export function fromHex(hex: string): Uint8Array | null {
  hex = hex.trim();
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(2 * i, 2 * i + 2), 16);
  return out;
}

export function toHex(b: Uint8Array): string {
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64Encode(b: Uint8Array): string {
  const parts: string[] = [];
  let chunk = '';
  let i = 0;
  for (; i + 2 < b.length; i += 3) {
    const n = (b[i] << 16) | (b[i + 1] << 8) | b[i + 2];
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
    if (chunk.length >= 65536) {
      parts.push(chunk);
      chunk = '';
    }
  }
  const rest = b.length - i;
  if (rest === 1) {
    const n = b[i] << 16;
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + '==';
  } else if (rest === 2) {
    const n = (b[i] << 16) | (b[i + 1] << 8);
    chunk += B64[n >> 18] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + '=';
  }
  parts.push(chunk);
  return parts.join('');
}

// Like Convert.FromBase64String: whitespace is ignored, the length must be a multiple of 4 and padding
// may only come at the end. Throws on anything else.
export function base64Decode(input: string): Uint8Array {
  const s = input.replace(/[ \t\r\n]/g, '');
  if (s.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('invalid base64');
  const pad = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
  const out = new Uint8Array((s.length / 4) * 3 - pad);
  let o = 0;
  for (let i = 0; i < s.length; i += 4) {
    const n =
      (B64.indexOf(s[i]) << 18) |
      (B64.indexOf(s[i + 1]) << 12) |
      ((s[i + 2] === '=' ? 0 : B64.indexOf(s[i + 2])) << 6) |
      (s[i + 3] === '=' ? 0 : B64.indexOf(s[i + 3]));
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}
