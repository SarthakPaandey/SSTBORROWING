import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '@/lib/auth/guards';
import { User } from '@/models/User';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { connectDB } from '@/lib/db';

// Mock NextAuth
vi.mock('next-auth/next', () => ({
    getServerSession: vi.fn(),
}));

import { getServerSession } from 'next-auth/next';

describe('Security Improvements Tests', () => {
    describe('Stale Session Detection', () => {
        it('should reject suspended users even with valid JWT', async () => {
            await connectDB();

            // Create suspended user
            const suspendedUser = await User.create({
                name: 'Suspended User',
                email: 'suspended@test.com',
                role: 'STUDENT',
                penaltyPoints: 100,
                suspendedUntil: new Date(Date.now() + 86400000), // Tomorrow
            });

            // Mock valid session
            (getServerSession as any).mockResolvedValue({
                user: {
                    id: suspendedUser.id,
                    email: 'suspended@test.com',
                    role: 'STUDENT',
                }
            });

            // Should throw because user is suspended in DB
            await expect(requireAuth()).rejects.toThrow(AuthorizationError);
            await expect(requireAuth()).rejects.toThrow('suspended');

            // Cleanup
            await User.findByIdAndDelete(suspendedUser.id);
        }, 15000); // 15 second timeout

        it('should reject users whose role changed since token issued', async () => {
            await connectDB();

            // Create user
            const user = await User.create({
                name: 'Demoted User',
                email: 'demoted@test.com',
                role: 'STUDENT', // Currently student in DB
                penaltyPoints: 0,
            });

            // Mock session with ADMIN role (old token)
            (getServerSession as any).mockResolvedValue({
                user: {
                    id: user.id,
                    email: 'demoted@test.com',
                    role: 'ADMIN', // Token says admin
                }
            });

            // Should throw because role mismatch
            await expect(requireAuth()).rejects.toThrow(AuthorizationError);
            await expect(requireAuth()).rejects.toThrow('permissions have changed');

            // Cleanup
            await User.findByIdAndDelete(user.id);
        }, 15000); // 15 second timeout

        it('should accept valid users with matching session', async () => {
            await connectDB();

            const validUser = await User.create({
                name: 'Valid User',
                email: 'valid@test.com',
                role: 'STUDENT',
                penaltyPoints: 0,
            });

            (getServerSession as any).mockResolvedValue({
                user: {
                    id: validUser.id,
                    email: 'valid@test.com',
                    name: 'Valid User',
                    role: 'STUDENT',
                }
            });

            const result = await requireAuth();
            expect(result.id).toBe(validUser.id);
            expect(result.role).toBe('STUDENT');

            // Cleanup
            await User.findByIdAndDelete(validUser.id);
        }, 15000); // 15 second timeout
    });

    describe('Typed Error Classes', () => {
        it('should throw AuthenticationError with 401 status', () => {
            const error = new AuthenticationError('Not logged in');
            expect(error.statusCode).toBe(401);
            expect(error.message).toContain('logged in');
        });

        it('should throw AuthorizationError with 403 status', () => {
            const error = new AuthorizationError('Insufficient permissions');
            expect(error.statusCode).toBe(403);
            expect(error.message).toContain('permissions');
        });

        it('should be catchable by type', () => {
            try {
                throw new AuthorizationError();
            } catch (error) {
                expect(error instanceof AuthorizationError).toBe(true);
                expect(error instanceof AuthenticationError).toBe(false);
            }
        });
    });
});
