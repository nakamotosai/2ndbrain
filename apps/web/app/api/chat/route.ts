import { NextRequest, NextResponse } from 'next/server';
import { searchSimilarNotes } from '@/lib/vector';
import { getNoteById } from '@/lib/db';
import { readMarkdown, parseMarkdown } from '@/lib/storage';
import { generateEmbedding, chatStream, checkOllamaHealth } from '@/lib/ollama';

// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// RAG 聊天
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { query, stream = true } = body;

        if (!query) {
            return NextResponse.json(
                { error: '查询不能为空' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // 检查 Ollama 状态
        const isOnline = await checkOllamaHealth();
        if (!isOnline) {
            return NextResponse.json(
                { error: 'AI 离线', offline: true },
                { status: 503, headers: CORS_HEADERS }
            );
        }

        // 1. 生成查询的嵌入向量
        const queryEmbedding = await generateEmbedding(query);

        // 2. 向量搜索相关笔记
        const similarNotes = await searchSimilarNotes(queryEmbedding, 5);

        // 3. 获取笔记完整内容构建上下文
        const contextParts: string[] = [];
        for (const note of similarNotes) {
            const fullNote = getNoteById(note.id);
            if (fullNote?.content_path) {
                const markdown = readMarkdown(fullNote.content_path);
                if (markdown) {
                    const { body } = parseMarkdown(markdown);
                    contextParts.push(`## ${note.title}\n${body.substring(0, 1000)}`);
                }
            } else {
                contextParts.push(`## ${note.title}\n${note.summary}`);
            }
        }

        const context = contextParts.join('\n\n---\n\n');

        // 4. 构建 RAG 提示词
        const messages = [
            {
                role: 'system' as const,
                content: `你是一个智能知识助手。基于用户的知识库内容回答问题。
如果知识库中没有相关信息，请诚实说明。
使用中文回答，保持简洁专业。

## 知识库内容：
${context || '(暂无相关笔记)'}`,
            },
            {
                role: 'user' as const,
                content: query,
            },
        ];

        // 5. 流式返回回答
        if (stream) {
            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    try {
                        // 先发送引用的笔记信息
                        controller.enqueue(
                            encoder.encode(
                                `data: ${JSON.stringify({ type: 'sources', sources: similarNotes })}\n\n`
                            )
                        );

                        // 流式生成回答
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
                    Connection: 'keep-alive',
                },
            });
        }

        // 非流式返回（简化实现）
        let fullResponse = '';
        for await (const chunk of chatStream(messages)) {
            fullResponse += chunk;
        }

        return NextResponse.json(
            {
                answer: fullResponse,
                sources: similarNotes,
            },
            { headers: CORS_HEADERS }
        );
    } catch (error) {
        console.error('Chat API 错误:', error);
        return NextResponse.json(
            { error: '聊天失败', details: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
