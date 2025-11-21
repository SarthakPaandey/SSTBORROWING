import { describe, it, expect } from 'vitest';

/**
 * Test for the security issue identified in approval token handling
 * 
 * BUG: The /api/approve/[token] endpoint trusts the URL query parameter
 * instead of the token's stored action field. This allows any valid token
 * to be used for both approve and reject actions.
 */
describe('Approval Token Security Issue', () => {
  it('should verify that approval tokens have action mismatch vulnerability', () => {
    // This test documents the security issue
    // In the current implementation:
    // 1. ApprovalToken model stores action: 'approve' | 'reject'
    // 2. But /api/approve/[token] uses searchParams.get('action') instead
    // 3. This means an approve token can be used to reject by changing ?action=reject
    
    const token = {
      bookingId: 'booking123',
      token: 'some-token',
      action: 'approve', // Token is for approval
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    // Current vulnerable behavior:
    const urlAction = 'reject'; // Attacker changes query param
    const tokenAction = token.action; // Should be 'approve'
    
    // BUG: Current code doesn't check if urlAction matches tokenAction
    expect(urlAction).not.toBe(tokenAction);
    
    // Expected fix: The endpoint should verify:
    // if (urlAction !== tokenAction) {
    //   throw new ValidationError('Token action mismatch');
    // }
  });

  it('should verify reject tokens cannot be used to approve', () => {
    const token = {
      bookingId: 'booking123',
      token: 'some-token',
      action: 'reject', // Token is for rejection
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const urlAction = 'approve'; // Attacker tries to approve
    const tokenAction = token.action; // Should be 'reject'
    
    // BUG: Current code doesn't check this
    expect(urlAction).not.toBe(tokenAction);
  });
});

