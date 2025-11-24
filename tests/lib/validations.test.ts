import { describe, it, expect } from 'vitest';
import { bookingSchema, groupBookingSchema } from '@/lib/validations';

describe('Validation Schemas', () => {
  describe('bookingSchema', () => {
    it('should validate correct booking data', () => {
      const validData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(), // Tomorrow + 1 hour
      };

      const result = bookingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject missing resourceId', () => {
      const invalidData = {
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid datetime format', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: 'not-a-date',
        end: new Date(Date.now() + 86400000).toISOString(),
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject end time before start time', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 - 3600000).toISOString(), // Before start
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain('end');
      }
    });

    it('should accept optional items array', () => {
      const validData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        items: [
          { itemId: 'item1', qty: 2 },
          { itemId: 'item2', qty: 1 },
        ],
      };

      const result = bookingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate items have minimum qty of 1', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        items: [{ itemId: 'item1', qty: 0 }], // Invalid qty
      };

      const result = bookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('groupBookingSchema', () => {
    it('should validate correct group booking data', () => {
      const validData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        memberEmails: [
          'student1@sst.scaler.com',
          'student2@sst.scaler.com',
        ],
      };

      const result = groupBookingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject empty memberEmails array', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        memberEmails: [],
      };

      const result = groupBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject invalid email addresses', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        memberEmails: ['not-an-email', 'also-invalid'],
      };

      const result = groupBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject end time before start time', () => {
      const invalidData = {
        resourceId: 'resource123',
        start: new Date(Date.now() + 86400000).toISOString(),
        end: new Date(Date.now() + 86400000 - 3600000).toISOString(),
        memberEmails: ['student1@sst.scaler.com'],
      };

      const result = groupBookingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});

