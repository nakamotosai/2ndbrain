import { NextRequest, NextResponse } from 'next/server';
import { searchNotes, getNoteTags } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get('q');

        if (!q || q.trim().length === 0) {
            return NextResponse.json({ notes: [] });
        }

        // Dynamic import to allow hot reload of DB changes if needed
        const { searchNotes, getNoteTags } = await import('@/lib/db');

        const notes = searchNotes(q);

        // Attach tags
        const notesWithTags = notes.map(note => ({
            ...note,
            tags: getNoteTags(Number(note.id))
        }));

        return NextResponse.json({ notes: notesWithTags });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}
