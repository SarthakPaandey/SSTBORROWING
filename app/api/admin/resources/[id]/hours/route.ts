import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * GET /api/admin/resources/[id]/hours
 * Get the operating hours for a specific resource
 */
export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        if (!mongoose.Types.ObjectId.isValid(params.id)) {
            throw new ValidationError('Invalid resource ID');
        }

        const resource = await Resource.findById(params.id);
        if (!resource) {
            throw new NotFoundError('Resource');
        }

        // Return operating hours or defaults
        const operatingHours = resource.operatingHours || {
            useCustom: false,
            schedule: [
                { open: false, startHour: 8, endHour: 20 }, // Sunday
                { open: true, startHour: 8, endHour: 20 },  // Monday
                { open: true, startHour: 8, endHour: 20 },  // Tuesday
                { open: true, startHour: 8, endHour: 20 },  // Wednesday
                { open: true, startHour: 8, endHour: 20 },  // Thursday
                { open: true, startHour: 8, endHour: 20 },  // Friday
                { open: true, startHour: 8, endHour: 18 },  // Saturday
            ],
        };

        return NextResponse.json({
            resourceId: resource._id,
            resourceName: resource.name,
            operatingHours,
            dayNames: DAY_NAMES,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * PUT /api/admin/resources/[id]/hours
 * Update operating hours for a specific resource
 */
export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        if (!mongoose.Types.ObjectId.isValid(params.id)) {
            throw new ValidationError('Invalid resource ID');
        }

        const resource = await Resource.findById(params.id);
        if (!resource) {
            throw new NotFoundError('Resource');
        }

        const { operatingHours } = await req.json();

        if (!operatingHours) {
            throw new ValidationError('operatingHours is required');
        }

        // Validate schedule array
        if (!operatingHours.schedule || !Array.isArray(operatingHours.schedule) || operatingHours.schedule.length !== 7) {
            throw new ValidationError('schedule must be an array of 7 days');
        }

        // Validate each day
        for (let i = 0; i < 7; i++) {
            const day = operatingHours.schedule[i];
            if (typeof day.open !== 'boolean') {
                throw new ValidationError(`${DAY_NAMES[i]}: open must be a boolean`);
            }
            if (day.open) {
                if (typeof day.startHour !== 'number' || day.startHour < 0 || day.startHour > 23) {
                    throw new ValidationError(`${DAY_NAMES[i]}: startHour must be 0-23`);
                }
                if (typeof day.endHour !== 'number' || day.endHour < 1 || day.endHour > 24) {
                    throw new ValidationError(`${DAY_NAMES[i]}: endHour must be 1-24`);
                }
                if (day.endHour <= day.startHour) {
                    throw new ValidationError(`${DAY_NAMES[i]}: endHour must be greater than startHour`);
                }
            }
        }

        resource.operatingHours = {
            useCustom: operatingHours.useCustom ?? true,
            schedule: operatingHours.schedule,
        };

        await resource.save();

        return NextResponse.json({
            success: true,
            message: `Operating hours updated for ${resource.name}`,
            operatingHours: resource.operatingHours,
        });
    } catch (error) {
        return handleApiError(error);
    }
}

/**
 * DELETE /api/admin/resources/[id]/hours
 * Reset operating hours to use system defaults
 */
export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        if (!mongoose.Types.ObjectId.isValid(params.id)) {
            throw new ValidationError('Invalid resource ID');
        }

        const resource = await Resource.findById(params.id);
        if (!resource) {
            throw new NotFoundError('Resource');
        }

        // Remove custom hours to use system defaults
        resource.operatingHours = undefined;
        await resource.save();

        return NextResponse.json({
            success: true,
            message: `Operating hours reset to system defaults for ${resource.name}`,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
