import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { SystemConfig, EDITABLE_POLICIES, EditablePolicyKey } from '@/models/SystemConfig';
import { POLICIES } from '@/lib/policies';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';

/**
 * GET /api/admin/config
 * Returns all editable policy values with their current settings
 * (either from DB or fallback to hardcoded defaults)
 */
export async function GET() {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        // Fetch all stored configs
        const storedConfigs = await SystemConfig.find({});
        const configMap = new Map(storedConfigs.map(c => [c.key, c]));

        // Build response with all editable policies
        const policies = Object.entries(EDITABLE_POLICIES).map(([key, meta]) => {
            const stored = configMap.get(key);
            const defaultValue = POLICIES[key as keyof typeof POLICIES] as number;

            return {
                key,
                value: stored?.value ?? defaultValue,
                defaultValue,
                description: meta.description,
                helpText: meta.helpText,
                category: meta.category,
                min: meta.min,
                max: meta.max,
                isCustom: !!stored,
                updatedBy: stored?.updatedBy,
                updatedAt: stored?.updatedAt,
            };
        });

        // Group by category
        const grouped = {
            limits: policies.filter(p => p.category === 'limits'),
            durations: policies.filter(p => p.category === 'durations'),
            penalties: policies.filter(p => p.category === 'penalties'),
            general: policies.filter(p => p.category === 'general'),
        };

        return NextResponse.json({
            policies,
            grouped,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * POST /api/admin/config
 * Updates one or more policy values
 * Body: { updates: [{ key: string, value: number }] }
 */
export async function POST(req: NextRequest) {
    try {
        const admin = await requireAuth(['ADMIN']);
        await connectDB();

        const { updates } = await req.json();

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            throw new ValidationError('Updates array is required');
        }

        const results: Array<{ key: string; value: number; success: boolean; error?: string }> = [];

        for (const update of updates) {
            const { key, value } = update;

            // Validate key exists in editable policies
            if (!EDITABLE_POLICIES[key as EditablePolicyKey]) {
                results.push({ key, value, success: false, error: 'Invalid policy key' });
                continue;
            }

            const meta = EDITABLE_POLICIES[key as EditablePolicyKey];

            // Validate value is a number
            if (typeof value !== 'number' || isNaN(value)) {
                results.push({ key, value, success: false, error: 'Value must be a number' });
                continue;
            }

            // Validate value is within range
            if (value < meta.min || value > meta.max) {
                results.push({
                    key,
                    value,
                    success: false,
                    error: `Value must be between ${meta.min} and ${meta.max}`
                });
                continue;
            }

            // Upsert the config
            await SystemConfig.findOneAndUpdate(
                { key },
                {
                    key,
                    value,
                    description: meta.description,
                    category: meta.category,
                    updatedBy: admin.id,
                },
                { upsert: true, new: true }
            );

            results.push({ key, value, success: true });
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: failCount === 0,
            message: `Updated ${successCount} policy(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
            results,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * DELETE /api/admin/config
 * Resets a policy to its default value by removing it from the database
 * Body: { key: string }
 */
export async function DELETE(req: NextRequest) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        const { key } = await req.json();

        if (!key || !EDITABLE_POLICIES[key as EditablePolicyKey]) {
            throw new ValidationError('Invalid policy key');
        }

        await SystemConfig.findOneAndDelete({ key });

        const defaultValue = POLICIES[key as keyof typeof POLICIES];

        return NextResponse.json({
            success: true,
            message: `Policy "${key}" reset to default value: ${defaultValue}`,
            defaultValue,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
