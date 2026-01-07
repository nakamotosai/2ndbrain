import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { addNoteToCollection, removeNoteFromCollection } from '@/lib/db';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = getDB();
        const collectionId = parseInt(params.id);
        const { noteId } = await request.json() as any;

        await addNoteToCollection(db, noteId, collectionId);
        return NextResponse.json({ success: true }, { status: 201, headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = getDB();
        const collectionId = parseInt(params.id);
        const { searchParams } = new URL(request.url);
        const noteId = parseInt(searchParams.get('noteId') || '0');

        if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400, headers: CORS_HEADERS });

        await removeNoteFromCollection(db, noteId, collectionId);
        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
