import { NextResponse } from 'next/server';
import { getDb, updateNote } from '@/lib/db';
import { generateTitle } from '@/lib/ollama';
import { readMarkdown, parseMarkdown } from '@/lib/storage';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST() {
    const logPath = path.join(process.cwd(), 'debug_log.txt');
    const log = (msg: string) => fs.appendFileSync(logPath, msg + '\n');

    log('Starting title regeneration...');
    try {
        const db = getDb();
        log('DB connected');

        // Get all notes
        const notes = db.prepare('SELECT id, title, content_path, summary FROM notes WHERE is_deleted = 0').all() as any[];
        log(`Found ${notes.length} notes`);

        let updatedCount = 0;

        for (const note of notes) {
            if (note.title.length > 15 || note.title.includes('一句话核心') || note.title.includes('Twitter')) {
                log(`Processing[${note.id}]`);

                let content = '';
                // Try reading file content
                if (note.content_path) {
                    try {
                        const raw = readMarkdown(note.content_path);
                        if (raw) {
                            const parsed = parseMarkdown(raw);
                            content = parsed.body;
                        }
                    } catch (e) {
                        log(`Failed to read file for [${note.id}]: ${e} `);
                    }
                }

                // Fallback to summary
                const textToProcess = content || note.summary || '';

                if (textToProcess) {
                    try {
                        const newTitle = await generateTitle(textToProcess);
                        if (newTitle) {
                            updateNote(note.id, { title: newTitle });
                            log(`Updated[${note.id}]-> ${newTitle} `);
                            updatedCount++;
                        }
                    } catch (err) {
                        log(`Error generating for [${note.id}]: ${err} `);
                    }
                } else {
                    log(`No content found for [${note.id}]`);
                }
            }
        }
        return NextResponse.json({ success: true, updated: updatedCount });
    } catch (e) {
        log(`Fatal Error: ${e} `);
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
