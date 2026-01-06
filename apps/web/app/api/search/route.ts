import { NextRequest, NextResponse } from 'next/server';
import { searchNotes } from '@/lib/db';
import { searchSimilarNotes } from '@/lib/vector';
import { generateEmbedding } from '@/lib/ollama';

export const runtime = 'edge';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

const getEnv = () => {
    // @ts-ignore
    const db = process.env.DB as unknown as D1Database;
    // @ts-ignore
    const vectorize = process.env.VECTORIZE as unknown as VectorizeIndex;
    if (!db || !vectorize) throw new Error('Bindings not found');
    return { db, vectorize };
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(request: NextRequest) {
    try {
        const { db, vectorize } = getEnv();
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('q');
        const type = searchParams.get('type') || 'semantic'; // 'semantic' or 'keyword'

        if (!query) {
            return NextResponse.json({ error: 'Query required' }, { status: 400 });
        }

        let results: any[] = [];

        if (type === 'keyword') {
            results = await searchNotes(db, query);
        } else {
            // Semantic Search
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
