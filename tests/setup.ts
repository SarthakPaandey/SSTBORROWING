// Test setup file
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Mock environment variables for testing
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/test-sst-booking';
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-key-for-testing-only';
process.env.QR_HMAC_SECRET = process.env.QR_HMAC_SECRET || 'test-qr-secret-key';
process.env.CRON_SECRET = process.env.CRON_SECRET || 'test-cron-secret';
process.env.ALLOWED_STUDENT_DOMAIN = process.env.ALLOWED_STUDENT_DOMAIN || 'sst.scaler.com';
process.env.ALLOWED_ADMIN_DOMAIN = process.env.ALLOWED_ADMIN_DOMAIN || 'scaler.com';

// Suppress console errors in tests unless needed
const originalError = console.error;
console.error = (...args: any[]) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('Error:'))
  ) {
    return;
  }
  originalError(...args);
};

