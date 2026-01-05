import { NextRequest, NextResponse } from 'next/server';
import { createCollection, addNoteToCollection, getCollections, getNotesBySource } from '@/lib/db';
import { generateCompletion } from '@/lib/ollama';

export async function POST(req: NextRequest) {
    try {
        const { source } = await req.json(); // 'twitter' | 'youtube' | 'web'

        // 1. Fetch unorganized notes (or all notes for the source)
        // For MVP, let's fetch ALL notes of that source and reorganize them.
        // Optimization: Only fetch notes where collection_id is null? 
        // But our schema is many-to-many.
        // Let's fetch all notes of that source.

        // We need a db function to getNotesBySource. 
        // We already have `getNotesBySource(source)` in db.ts but it returns filtered list.
        // We will reuse that.

        const { getNotesBySource } = await import('@/lib/db');
        const notes = getNotesBySource(source as string);

        if (notes.length === 0) {
            return NextResponse.json({ message: 'No notes to organize' });
        }

        // 2. Prepare prompt for Ollama
        const notesList = notes.map(n => `- ID: ${n.id}\n  Title: ${n.title}\n  Summary: ${n.summary || ''}`).join('\n');

        const prompt = `
        You are an expert content organizer. 
        Analyze the following list of ${source} notes and group them into logical topic collections.
        
        Rules:
        1. Create 3-8 distinct collections based on the topics found.
        2. Assign each note to EXACTLY ONE collection.
        3. Return JSON ONLY in this format: 
        {
          "collections": [
            { "name": "Collection Name", "note_ids": [1, 2] }
          ]
        }
        4. Collection names should be concise (2-5 words) and in Chinese.
        
        Notes:
        ${notesList}
        `;

        // 3. Call Ollama
        const response = await generateCompletion({
            model: process.env.OLLAMA_CHAT_MODEL || 'qwen2.5-coder:7b',
            prompt: prompt,
            format: 'json',
            stream: false
        }) as any;

        let result;
        try {
            result = JSON.parse(response.response);
        } catch (e) {
            console.error('Failed to parse AI response', response.response);
            return NextResponse.json({ error: 'AI response parsing failed' }, { status: 500 });
        }

        // 4. content application
        const collections = result.collections || [];

        // Get existing collections to avoid duplicates (by name)
        const existingCollections = getCollections();

        for (const col of collections) {
            let collectionId = existingCollections.find(c => c.name === col.name)?.id;

            if (!collectionId) {
                // Create new collection (returns number directly)
                collectionId = createCollection(col.name);
            }

            // Add notes
            for (const noteId of col.note_ids) {
                addNoteToCollection(noteId, collectionId);
                // Optional: Update note validation status?
            }
        }

        return NextResponse.json({ success: true, collections: collections.length });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
