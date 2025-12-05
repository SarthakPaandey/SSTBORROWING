import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Validates the guard access key without revealing the actual key to the client.
 * This prevents attackers from seeing the guard login form unless they have
 * the correct access key.
 */
export async function POST(req: NextRequest) {
  try {
    const { accessKey } = await req.json();

    if (!accessKey || typeof accessKey !== 'string') {
      // Still perform a dummy comparison to prevent timing attacks
      // that could detect the absence of a key
      timingSafeCompare('', process.env.GUARD_ACCESS_KEY || '');
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    const guardAccessKey = process.env.GUARD_ACCESS_KEY;
    
    if (!guardAccessKey) {
      console.error('[Auth] GUARD_ACCESS_KEY is not configured!');
      // Perform dummy comparison to maintain consistent timing
      timingSafeCompare(accessKey, 'dummy-key-placeholder');
      return NextResponse.json({ valid: false }, { status: 200 });
    }

    // Use timing-safe comparison that doesn't leak key length
    const isValid = timingSafeCompare(accessKey, guardAccessKey);

    return NextResponse.json({ valid: isValid }, { status: 200 });
  } catch (error) {
    console.error('[Auth] Error validating guard key:', error);
    return NextResponse.json({ valid: false }, { status: 200 });
  }
}

/**
 * Timing-safe string comparison that doesn't leak length information.
 * Uses HMAC comparison to ensure constant-time execution regardless of
 * input lengths or content differences.
 */
function timingSafeCompare(a: string, b: string): boolean {
  // Use a fixed-length hash comparison to prevent length leakage
  // HMAC with a constant key ensures both inputs are processed to same length
  const key = 'timing-safe-comparison-key';
  const hashA = crypto.createHmac('sha256', key).update(a).digest();
  const hashB = crypto.createHmac('sha256', key).update(b).digest();
  
  // crypto.timingSafeEqual is truly constant-time
  return crypto.timingSafeEqual(hashA, hashB);
}

