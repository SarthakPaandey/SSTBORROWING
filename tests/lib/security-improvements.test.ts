import { describe, it, expect, vi } from 'vitest';
import { requireAuth } from '@/lib/auth/guards';
import { User } from '@/models/User';
import { AuthenticationError, AuthorizationError } from '@/lib/errors';
import { connectDB } from '@/lib/db';

// Mock NextAuth
vi.mock('next-auth/next', () => ({
    getServerSession: vi.fn(),
}));

// Mock DB connection
vi.mock('@/lib/db', () => ({
    connectDB: vi.fn(),
}));

// Mock User model
const { mockUserFindById } = vi.hoisted(() => {
    return { mockUserFindById: vi.fn() };
});

vi.mock('@/models/User', () => ({
    User: {
        findById: mockUserFindById,
    },
}));

import { getServerSession } from 'next-auth/next';

describe('Security Improvements Tests', () => {
    describe('Stale Session Detection', () => {
        it('should reject suspended users even with valid JWT', async () => {
            // Mock suspended user in DB
            mockUserFindById.mockReturnValue({
                select: vi.fn().mockResolvedValue({
                    id: 'suspended-user-id',
                    role: 'STUDENT',
                    suspendedUntil: new Date(Date.now() + 86400000), // Tomorrow
                    penaltyPoints: 100,
                }),
            });

            // Mock valid session
            (getServerSession as any).mockResolvedValue({
                user: {
                    id: 'suspended-user-id',
                    email: 'suspended@test.com',
                    role: 'STUDENT',
                }
            });

            // Should throw because user is suspended in DB
            await expect(requireAuth()).rejects.toThrow(AuthorizationError);
            await expect(requireAuth()).rejects.toThrow('suspended');
        });

        it('should reject users whose role changed since token issued', async () => {
            // Mock user with STUDENT role in DB
            mockUserFindById.mockReturnValue({
                select: vi.fn().mockResolvedValue({
                    id: 'demoted-user-id',
                    role: 'STUDENT',
                    penaltyPoints: 0,
                }),
            });

            // Mock session with ADMIN role (old token)
            (getServerSession as any).mockResolvedValue({
                user: {
                    id: 'demoted-user-id',
                    email: 'demoted@test.com',
                    role: 'ADMIN', // Token says admin
                }
            });

            // Should throw because role mismatch
            await expect(requireAuth()).rejects.toThrow(AuthorizationError);
            await expect(requireAuth()).rejects.toThrow('permissions have changed');
        });

        it('should accept valid users with matching session', async () => {
            // Mock valid user in DB
            mockUserFindById.mockReturnValue({
                select: vi.fn().mockResolvedValue({
                    id: 'valid-user-id',
                    role: 'STUDENT',
                    penaltyPoints: 0,
                }),
            });

            (getServerSession as any).mockResolvedValue({
                user: {
                    id: 'valid-user-id',
                    email: 'valid@test.com',
                    name: 'Valid User',
                    role: 'STUDENT',
                }
            });

            const result = await requireAuth();
            expect(result.id).toBe('valid-user-id');
            expect(result.role).toBe('STUDENT');
        });
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
