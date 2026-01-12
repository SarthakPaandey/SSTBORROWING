import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';

/**
 * Lookup a book by ISBN across all library resources
 * Used for borrowing and return flows
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    await connectDB();

    const { isbn } = await req.json();

    if (!isbn) {
      throw new ValidationError('ISBN is required');
    }

    // Normalize ISBN (remove hyphens and spaces)
    const normalizedIsbn = isbn.replace(/[-\s]/g, '');

    // Find book by ISBN across all library resources
    const book = await EquipmentItem.findOne({
      isbn: normalizedIsbn,
    }).populate('resourceId', 'name type');

    if (!book) {
      throw new NotFoundError('Book with this ISBN not found in library');
    }

    const resource = await Resource.findById(book.resourceId);
    if (!resource || resource.type !== 'LIBRARY') {
      throw new NotFoundError('Book resource not found');
    }

    return NextResponse.json({
      book: {
        _id: book._id,
        name: book.name,
        author: book.author,
        isbn: book.isbn,
        imageUrl: book.imageUrl,
        qtyTotal: book.qtyTotal,
        qtyAvailable: book.qtyAvailable,
        resourceId: book.resourceId,
        resourceName: resource.name,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

