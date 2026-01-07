import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare';
import { searchNotes } from '@/lib/db';
import { searchSimilarNotes } from '@/lib/vector';
import { generateEmbedding } from '@/lib/ollama';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
    try {
        const { DB: db, VECTORIZE: vectorize } = getCloudflareEnv();
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'semantic';

        if (!query) {
            return NextResponse.json({ error: 'Query required' }, { status: 400, headers: CORS_HEADERS });
        }

        let results: any[] = [];

        if (type === 'keyword') {
            results = await searchNotes(db, query);
        } else {
            try {
                const vector = await generateEmbedding(query);
                const matches = await searchSimilarNotes(vectorize, vector, 10);
                results = matches;
            } catch (aiErr) {
                console.warn('AI Search failed, falling back to keyword:', aiErr);
                results = await searchNotes(db, query);
            }
        }

        return NextResponse.json({ results }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
