import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare';
import { createNote, getOrCreateTag, addTagToNote, addSource, updateNote, getNoteById, type Note } from '@/lib/db';
import { addNoteEmbedding } from '@/lib/vector';
import { summarize, generateTags, generateEmbedding, checkOllamaHealth, generateTitle } from '@/lib/ollama';

export const runtime = 'edge';

// CORS 配置
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
        const { DB: db, VECTORIZE: vectorize } = getCloudflareEnv();
        const body = await request.json() as any;
        const { content, title, source_url, source_type = 'extension', context } = body;

        if (!content) {
            return NextResponse.json(
                { error: 'Content cannot be empty' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // 1. Save initial Note to D1
        const tempTitle = title || 'New Note (Processing...)';

        const noteId = await createNote(db, {
            title: tempTitle,
            summary: '',
            content: content,
            source_url,
            source_type,
            ai_status: 'pending'
        });

        // 2. Process AI
        try {
            await processAI(db, vectorize, noteId, content, context, tempTitle);
        } catch (aiErr) {
            console.error('AI Processing Error:', aiErr);
            await updateNote(db, noteId, { ai_status: 'failed' });
        }

        return NextResponse.json(
            {
                success: true,
                noteId,
                title: tempTitle,
                status: 'completed',
                message: 'Saved and processed.'
            },
            { status: 201, headers: CORS_HEADERS }
        );
    } catch (error) {
        console.error('Ingest Error:', error);
        return NextResponse.json(
            { error: 'Processing failed', details: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}

async function processAI(
    db: D1Database,
    vectorize: VectorizeIndex,
    noteId: number,
    content: string,
    context: any[],
    originalTitle: string
) {
    const isOllamaOnline = await checkOllamaHealth();

    let summary = '';
    let tags: string[] = [];
    let embedding: number[] = [];
    let noteTitle = '';

    if (isOllamaOnline) {
        try {
            const results = await Promise.all([
                summarize(content),
                generateTags(content),
                generateEmbedding(content.substring(0, 2000)),
            ]);

            [summary, tags, embedding] = results;
            noteTitle = await generateTitle(content);
            if (!noteTitle) noteTitle = originalTitle;

        } catch (aiError) {
            console.error('Partial AI Failure:', aiError);
            summary = content.substring(0, 100) + '...';
            tags = ['Uncategorized'];
        }
    } else {
        summary = content.substring(0, 100) + '...';
        tags = ['Uncategorized'];
    }

    // Update Note
    await updateNote(db, noteId, {
        summary,
        title: noteTitle || originalTitle,
        ai_status: 'completed',
        updated_at: new Date().toISOString()
    });

    // Tags
    for (const tagName of tags) {
        const tagId = await getOrCreateTag(db, tagName);
        await addTagToNote(db, noteId, tagId);
    }

    // Context
    if (context && Array.isArray(context)) {
        for (const source of context) {
            await addSource(db, noteId, {
                title: source.title,
                url: source.url,
                snippet: source.snippet,
            });
        }
    }

    // Vectors
    if (embedding.length > 0) {
        await addNoteEmbedding(vectorize, {
            id: noteId,
            vector: embedding,
            title: noteTitle || originalTitle,
            summary,
        });
    }
}
