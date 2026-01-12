import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';

interface OpenLibraryBook {
  title?: string;
  authors?: Array<{ name: string }>;
  covers?: number[];
  isbn_13?: string[];
  isbn_10?: string[];
  publish_date?: string;
  publishers?: string[];
  number_of_pages?: number;
}

interface OpenLibraryResponse {
  [key: string]: OpenLibraryBook;
}

/**
 * Fetch book details from Open Library API by ISBN
 * Used when adding new books to the library
 */
export async function POST(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    const { isbn } = await req.json();

    if (!isbn) {
      throw new ValidationError('ISBN is required');
    }

    // Normalize ISBN (remove hyphens and spaces)
    const normalizedIsbn = isbn.replace(/[-\s]/g, '');

    // Open Library API endpoint
    // Format: https://openlibrary.org/api/books?bibkeys=ISBN:9780385537858&format=json&jscmd=data
    const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${normalizedIsbn}&format=json&jscmd=data`;

    try {
      const response = await fetch(openLibraryUrl, {
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Open Library API returned ${response.status}`);
      }

      const data: OpenLibraryResponse = await response.json();
      const bookKey = `ISBN:${normalizedIsbn}`;
      const bookData = data[bookKey];

      if (!bookData) {
        return NextResponse.json({
          found: false,
          message: 'Book not found in Open Library database',
        });
      }

      // Extract book information
      const title = bookData.title || 'Unknown Title';
      const authors = bookData.authors?.map(a => a.name).join(', ') || 'Unknown Author';
      const coverId = bookData.covers?.[0];
      const coverUrl = coverId
        ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
        : undefined;

      return NextResponse.json({
        found: true,
        book: {
          title,
          author: authors,
          isbn: normalizedIsbn,
          coverUrl,
          publishDate: bookData.publish_date,
          publisher: bookData.publishers?.[0],
          pages: bookData.number_of_pages,
        },
      });
    } catch (apiError) {
      console.error('Open Library API error:', apiError);
      return NextResponse.json({
        found: false,
        message: 'Failed to fetch book details from Open Library',
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
      });
    }
  } catch (error) {
    return handleApiError(error);
  }
}

