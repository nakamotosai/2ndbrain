import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const collectionId = parseInt(params.id);
        const { noteId } = await request.json();

        if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400, headers: CORS_HEADERS });

        const { addNoteToCollection } = await import('@/lib/db');
        addNoteToCollection(noteId, collectionId);

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const collectionId = parseInt(params.id);
        const { searchParams } = new URL(request.url);
        const noteId = searchParams.get('noteId');

        if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400, headers: CORS_HEADERS });

        const { removeNoteFromCollection } = await import('@/lib/db');
        removeNoteFromCollection(parseInt(noteId), collectionId);

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}
