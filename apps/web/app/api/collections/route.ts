import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
    try {
        const { getCollections } = await import('@/lib/db');
        const collections = getCollections();
        return NextResponse.json(collections, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { name, description } = await request.json();
        if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400, headers: CORS_HEADERS });

        const { createCollection } = await import('@/lib/db');
        const id = createCollection(name, description);
        return NextResponse.json({ success: true, id }, { status: 201, headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}
