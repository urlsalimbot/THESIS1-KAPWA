import * as crypto from 'crypto';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_DIGITS = 6;

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buf: Buffer): string {
  const bits: string[] = [];
  for (const b of buf) bits.push(b.toString(2).padStart(8, '0'));
  const allBits = bits.join('');
  const result: string[] = [];
  for (let i = 0; i < allBits.length; i += 5) {
    const chunk = allBits.slice(i, i + 5).padEnd(5, '0');
    result.push(BASE32[parseInt(chunk, 2)]);
  }
  return result.join('');
}

function base32Decode(s: string): Buffer {
  const cleaned = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bits = cleaned.split('').map(c => BASE32.indexOf(c).toString(2).padStart(5, '0')).join('');
  const bytes: number[] = [];
  for (let i = 0; i + 7 < bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTOTPSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

export function generateTOTPUri(secret: string, label: string, issuer: string): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

interface TOTPVerifyOptions {
  token: string;
  secret: string;
  window?: number;
}

export function verifyTOTP({ token, secret, window: w = 1 }: TOTPVerifyOptions): boolean {
  const secretBuf = base32Decode(secret);
  const now = Math.floor(Date.now() / 1000);
  const counter = Math.floor(now / TOTP_PERIOD_SECONDS);

  if (token.length !== TOTP_DIGITS || !/^\d{6}$/.test(token)) return false;

  for (let offset = -w; offset <= w; offset++) {
    const c = counter + offset;
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeBigUInt64BE(BigInt(c));
    const hmac = crypto.createHmac('sha1', secretBuf).update(counterBuf).digest();
    const offsetBits = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offsetBits] & 0x7f) << 24) |
      (hmac[offsetBits + 1] << 16) |
      (hmac[offsetBits + 2] << 8) |
      hmac[offsetBits + 3];
    const totp = String(code % 1000000).padStart(6, '0');
    if (totp === token) return true;
  }
  return false;
}
