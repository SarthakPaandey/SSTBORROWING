import crypto from 'crypto';
import QRCode from 'qrcode';

const envSecret = process.env.QR_HMAC_SECRET;

if (!envSecret) {
  throw new Error('QR_HMAC_SECRET environment variable is not defined');
}

const QR_SECRET: string = envSecret;

export interface QRPayload {
  bid: string; // booking ID
  uid: string; // user ID
  iat: number; // issued at
  exp: number; // expires at
  n: string; // nonce
}

export function generateQRToken(bookingId: string, userId: string, expiresInMinutes: number): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresInMinutes * 60);
  const nonce = crypto.randomBytes(8).toString('hex');

  const payload: QRPayload = {
    bid: bookingId,
    uid: userId,
    iat: now,
    exp,
    n: nonce,
  };

  const data = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', QR_SECRET)
    .update(data)
    .digest('hex');

  const token = Buffer.from(`${data}.${signature}`).toString('base64url');

  return token;
}

export function verifyQRToken(token: string): { valid: boolean; payload?: QRPayload; error?: string } {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [data, signature] = decoded.split('.');

    if (!data || !signature) {
      return { valid: false, error: 'Invalid token format' };
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', QR_SECRET)
      .update(data)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }

    const payload: QRPayload = JSON.parse(data);

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) {
      return { valid: false, error: 'Token expired' };
    }

    return { valid: true, payload };
  } catch (error) {
    return { valid: false, error: 'Failed to verify token' };
  }
}

export async function generateQRCodeImage(token: string): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(token, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    return dataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code image');
  }
}
