import { NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { emptyTrash } from '@/lib/db';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST() {
    try {
        const db = getDB();
        await emptyTrash(db);
        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
