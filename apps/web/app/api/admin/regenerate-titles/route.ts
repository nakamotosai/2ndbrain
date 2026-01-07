import { NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { updateNote } from '@/lib/db';
import { generateTitle } from '@/lib/ollama';

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
    console.log('Starting title regeneration...');
    try {
        const db = getDB();

        const { results } = await db.prepare('SELECT id, title, content, summary FROM notes WHERE is_deleted = 0').all<any>();

        console.log(`Found ${results.length} notes`);

        let updatedCount = 0;

        for (const note of results) {
            if (note.title.length > 15 || note.title.includes('一句话核心') || note.title.includes('Twitter')) {
                console.log(`Processing[${note.id}]`);

                const content = note.content || '';
                const textToProcess = content || note.summary || '';

                if (textToProcess) {
                    try {
                        const newTitle = await generateTitle(textToProcess);
                        if (newTitle) {
                            await updateNote(db, note.id, { title: newTitle });
                            console.log(`Updated[${note.id}]-> ${newTitle} `);
                            updatedCount++;
                        }
                    } catch (err) {
                        console.error(`Error generating for [${note.id}]: ${err} `);
                    }
                } else {
                    console.log(`No content found for [${note.id}]`);
                }
            }
        }
        return NextResponse.json({ success: true, updated: updatedCount }, { headers: CORS_HEADERS });
    } catch (e) {
        console.error(`Fatal Error: ${e} `);
        return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS_HEADERS });
    }
}
