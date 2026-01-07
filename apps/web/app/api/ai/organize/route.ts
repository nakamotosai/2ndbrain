import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { getNotesBySource, createCollection, addNoteToCollection, getOrCreateTag, addTagToNote } from '@/lib/db';
import { chat } from '@/lib/ollama';

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
        const { source } = await request.json() as any;
        if (!source) return NextResponse.json({ error: 'Source required' }, { status: 400, headers: CORS_HEADERS });

        const notes = await getNotesBySource(db, source);
        if (notes.length === 0) {
            return NextResponse.json({ message: 'No notes found', collections: 0 }, { headers: CORS_HEADERS });
        }

        const recentNotes = notes.slice(0, 10);
        const summaryText = recentNotes.map(n => `- [${n.id}] ${n.title}: ${n.summary || ''}`).join('\n');

        const prompt = `
        Analyze these notes and group them into logical collections.
        Return ONLY a JSON object mapping Collection Name to arrays of Note IDs.
        Example: { "Tech News": [1, 2], "Ideas": [3] }
        
        Notes:
        ${summaryText}
        `;

        const response = await chat([
            { role: 'system', content: 'You are a helpful organizer. output JSON only.' },
            { role: 'user', content: prompt }
        ]);

        let organization = {};
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                organization = JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse AI organization', e);
            return NextResponse.json({ error: 'AI parsing failed' }, { status: 500, headers: CORS_HEADERS });
        }

        let createdCount = 0;
        for (const [colName, ids] of Object.entries(organization)) {
            const collectionId = await createCollection(db, colName);
            createdCount++;
            if (Array.isArray(ids)) {
                for (const nid of ids) {
                    await addNoteToCollection(db, Number(nid), collectionId);
                }
            }
        }

        return NextResponse.json({ success: true, collections: createdCount }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
