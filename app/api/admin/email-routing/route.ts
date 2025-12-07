import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EmailRouting, EmailRoutingCategory, EMAIL_ROUTING_CATEGORIES } from '@/models/EmailRouting';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';

/**
 * GET /api/admin/email-routing
 * Returns all email routing rules with category metadata
 */
export async function GET() {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        // Fetch all stored routing rules
        const storedRules = await EmailRouting.find({});
        const rulesMap = new Map(storedRules.map(r => [r.category, r]));

        // Build response with all categories (showing empty for unconfigured)
        const categories = Object.entries(EMAIL_ROUTING_CATEGORIES).map(([category, meta]) => {
            const stored = rulesMap.get(category as EmailRoutingCategory);
            return {
                category,
                label: meta.label,
                description: meta.description,
                emails: stored?.emails || [],
                enabled: stored?.enabled ?? false,
                isConfigured: !!stored,
                updatedAt: stored?.updatedAt,
            };
        });

        return NextResponse.json({ categories });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * POST /api/admin/email-routing
 * Create or update an email routing rule
 * Body: { category: string, emails: string[], enabled: boolean }
 */
export async function POST(req: NextRequest) {
    try {
        const admin = await requireAuth(['ADMIN']);
        await connectDB();

        const { category, emails, enabled } = await req.json();

        // Validate category
        if (!category || !EMAIL_ROUTING_CATEGORIES[category as EmailRoutingCategory]) {
            throw new ValidationError('Invalid category');
        }

        // Validate emails
        if (!emails || !Array.isArray(emails)) {
            throw new ValidationError('Emails must be an array');
        }

        // Filter out empty emails and validate format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validEmails = emails
            .map((e: string) => e.trim().toLowerCase())
            .filter((e: string) => e.length > 0);

        for (const email of validEmails) {
            if (!emailRegex.test(email)) {
                throw new ValidationError(`Invalid email format: ${email}`);
            }
        }

        if (validEmails.length === 0) {
            throw new ValidationError('At least one valid email address is required');
        }

        // Upsert the routing rule
        const rule = await EmailRouting.findOneAndUpdate(
            { category },
            {
                category,
                emails: validEmails,
                enabled: enabled !== false, // Default to true
                updatedBy: admin.id,
            },
            { upsert: true, new: true }
        );

        return NextResponse.json({
            success: true,
            message: `Email routing for ${EMAIL_ROUTING_CATEGORIES[category as EmailRoutingCategory].label} updated`,
            rule,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * DELETE /api/admin/email-routing
 * Remove an email routing rule (falls back to DEFAULT or all admins)
 * Body: { category: string }
 */
export async function DELETE(req: NextRequest) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        const { category } = await req.json();

        if (!category || !EMAIL_ROUTING_CATEGORIES[category as EmailRoutingCategory]) {
            throw new ValidationError('Invalid category');
        }

        await EmailRouting.findOneAndDelete({ category });

        return NextResponse.json({
            success: true,
            message: `Email routing for ${EMAIL_ROUTING_CATEGORIES[category as EmailRoutingCategory].label} removed`,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
