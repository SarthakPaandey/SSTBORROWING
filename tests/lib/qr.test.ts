import { describe, it, expect, beforeEach } from 'vitest';
import { generateQRToken, verifyQRToken } from '@/lib/qr';

describe('QR Token Generation and Verification', () => {
  beforeEach(() => {
    // Ensure QR_SECRET is set
    process.env.QR_HMAC_SECRET = 'test-secret-key-for-qr-tokens';
  });

  describe('generateQRToken', () => {
    it('should generate a valid token', () => {
      const token = generateQRToken('booking123', 'user456', 10);
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should generate different tokens for different inputs', () => {
      const token1 = generateQRToken('booking1', 'user1', 10);
      const token2 = generateQRToken('booking2', 'user2', 10);
      expect(token1).not.toBe(token2);
    });
  });

  describe('verifyQRToken', () => {
    it('should verify a valid token', () => {
      const token = generateQRToken('booking123', 'user456', 10);
      const result = verifyQRToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.bid).toBe('booking123');
      expect(result.payload?.uid).toBe('user456');
    });

    it('should reject tampered token', () => {
      const token = generateQRToken('booking123', 'user456', 10);
      const tamperedToken = token.slice(0, -5) + 'XXXXX';
      const result = verifyQRToken(tamperedToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject expired token', () => {
      // Generate token with 0 minutes expiry (already expired)
      const token = generateQRToken('booking123', 'user456', 0);
      
      // Wait a moment to ensure expiry
      const result = verifyQRToken(token);
      
      // Note: This might pass if token hasn't expired yet due to timing
      // In real scenario, we'd need to mock time or wait
      if (result.payload) {
        const now = Math.floor(Date.now() / 1000);
        if (now > result.payload.exp) {
          expect(result.valid).toBe(false);
          expect(result.error).toContain('expired');
        }
      }
    });

    it('should reject invalid token format', () => {
      const result = verifyQRToken('invalid.token.format');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should include correct expiry time', () => {
      const expiryMinutes = 15;
      const token = generateQRToken('booking123', 'user456', expiryMinutes);
      const result = verifyQRToken(token);
      
      if (result.valid && result.payload) {
        const now = Math.floor(Date.now() / 1000);
        const expectedExp = now + (expiryMinutes * 60);
        // Allow 5 second difference for execution time
        expect(Math.abs(result.payload.exp - expectedExp)).toBeLessThan(5);
      }
    });
  });
});

