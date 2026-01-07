import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { updateNote } from '@/lib/db';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
    try {
        const db = getDB();
        const { noteId } = await request.json() as any;

        if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400, headers: CORS_HEADERS });

        await updateNote(db, noteId, { ai_status: 'cancelled' });

        return NextResponse.json({ success: true, message: 'Marked as cancelled' }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
