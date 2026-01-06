import { NextRequest, NextResponse } from 'next/server';
import { createCollection, getCollections } from '@/lib/db';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const getDB = () => {
    // @ts-ignore
    const db = process.env.DB as unknown as D1Database;
    if (!db) throw new Error('DB binding not found');
    return db;
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
    try {
        const db = getDB();
        const collections = await getCollections(db);
        return NextResponse.json(collections, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function POST(request: NextRequest) {
    try {
        const db = getDB();
        const { name, description } = await request.json() as any;
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

        const id = await createCollection(db, name, description);
        return NextResponse.json({ id, name, description }, { status: 201, headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
