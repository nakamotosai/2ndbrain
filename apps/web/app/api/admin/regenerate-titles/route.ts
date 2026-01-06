import { NextResponse } from 'next/server';
import { updateNote } from '@/lib/db';
import { generateTitle } from '@/lib/ollama';

export const runtime = 'edge';

// Helper to get DB from env
const getDB = () => {
    // @ts-ignore
    const db = process.env.DB as unknown as D1Database;
    if (!db) {
        throw new Error('Database binding (DB) not found.');
    }
    return db;
}

export async function POST() {
    console.log('Starting title regeneration...');
    try {
        const db = getDB();

        // Get all active notes
        // Note: D1 .all() syntax
        const { results } = await db.prepare('SELECT id, title, content, summary FROM notes WHERE is_deleted = 0').all<any>();

        console.log(`Found ${results.length} notes`);

        let updatedCount = 0;

        for (const note of results) {
            // Check conditions
            if (note.title.length > 15 || note.title.includes('一句话核心') || note.title.includes('Twitter')) {
                console.log(`Processing[${note.id}]`);

                // Content is now in DB
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
        return NextResponse.json({ success: true, updated: updatedCount });
    } catch (e) {
        console.error(`Fatal Error: ${e} `);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
