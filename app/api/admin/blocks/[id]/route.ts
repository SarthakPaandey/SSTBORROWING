import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { logAuditEvent, getActorFromSession } from '@/lib/audit';
import { Resource } from '@/models/Resource';
import mongoose from 'mongoose';

// Dynamic route: uses auth headers/cookies for admin auth
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid block ID format');
    }

    const block = await Block.findById(params.id);

    if (!block) {
      throw new NotFoundError('Block');
    }

    // Check if we should delete the entire recurring series
    const { searchParams } = new URL(req.url);
    const deleteSeries = searchParams.get('deleteSeries') === 'true';

    if (deleteSeries && block.recurringGroupId) {
      // Delete all blocks in the series
      const deleteResult = await Block.deleteMany({ recurringGroupId: block.recurringGroupId });

      // Get resource name for audit
      const resource = await Resource.findById(block.resourceId);

      // Log audit event for series deletion
      await logAuditEvent({
        action: 'DELETE_RECURRING_BLOCK',
        actor: getActorFromSession(admin),
        target: {
          type: 'BLOCK',
          id: block.recurringGroupId,
          name: resource?.name || 'Unknown Resource',
        },
        details: {
          resourceId: block.resourceId,
          pattern: block.recurringPattern,
          blocksDeleted: deleteResult.deletedCount,
        },
      });

      return NextResponse.json({
        message: `Deleted ${deleteResult.deletedCount} blocks in the series`,
        deletedCount: deleteResult.deletedCount,
      });
    }

    // Delete single block
    await Block.findByIdAndDelete(params.id);

    return NextResponse.json({
      message: 'Block deleted successfully',
    });
  } catch (error) {
    console.error('Delete block error:', error);
    return handleApiError(error);
  }
}
