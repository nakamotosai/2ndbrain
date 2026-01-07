import { NextRequest, NextResponse } from 'next/server';
import { getCloudflareEnv } from '@/lib/cloudflare';
import { searchSimilarNotes } from '@/lib/vector';
import { getNoteById } from '@/lib/db';
import { generateEmbedding, chatStream, checkOllamaHealth } from '@/lib/ollama';

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
        const { DB: db, VECTORIZE: vectorize } = getCloudflareEnv();
        const body = await request.json() as any;
        const { query, stream = true } = body;

        if (!query) {
            return NextResponse.json({ error: 'Query required' }, { status: 400, headers: CORS_HEADERS });
        }

        const isOnline = await checkOllamaHealth();
        if (!isOnline) {
            return NextResponse.json({ error: 'AI offline', offline: true }, { status: 503, headers: CORS_HEADERS });
        }

        const queryEmbedding = await generateEmbedding(query);
        const similarNotes = await searchSimilarNotes(vectorize, queryEmbedding, 5);

        const contextParts: string[] = [];
        for (const note of similarNotes) {
            const fullNote = await getNoteById(db, note.id);
            if (fullNote) {
                const content = fullNote.content || fullNote.summary || '';
                contextParts.push(`## ${fullNote.title}\n${content.substring(0, 1000)}`);
            }
        }

        const context = contextParts.join('\n\n---\n\n');

        const messages = [
            {
                role: 'system',
                content: `You are a helpful knowledge assistant. Answer based on the Knowledge Base.
If not found, state it clearly.
Answer in Chinese. Keep it concise.

## Knowledge Base:
${context || '(No relevant notes found)'}`
            },
            {
                role: 'user',
                content: query,
            },
        ];

        if (stream) {
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    try {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'sources', sources: similarNotes })}\n\n`)
                        );

                        for await (const chunk of chatStream(messages)) {
                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`)
                            );
                        }

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
                        controller.close();
                    } catch (error) {
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: String(error) })}\n\n`)
                        );
                        controller.close();
                    }
                },
            });

            return new NextResponse(readable, {
                headers: {
                    ...CORS_HEADERS,
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        let fullResponse = '';
        for await (const chunk of chatStream(messages)) {
            fullResponse += chunk;
        }

        return NextResponse.json(
            { answer: fullResponse, sources: similarNotes },
            { headers: CORS_HEADERS }
        );
    } catch (error) {
        console.error('Chat API Error:', error);
        return NextResponse.json(
            { error: 'Chat failed', details: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
