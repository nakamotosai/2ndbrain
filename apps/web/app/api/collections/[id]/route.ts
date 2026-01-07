import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { deleteCollection } from '@/lib/db';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const db = getDB();
        const id = parseInt(params.id);
        await deleteCollection(db, id);
        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
