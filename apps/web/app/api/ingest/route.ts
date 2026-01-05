import { NextRequest, NextResponse } from 'next/server';
import { createNote, getOrCreateTag, addTagToNote, addSource, updateNote, getNoteById, type Note } from '@/lib/db';
import { addNoteEmbedding } from '@/lib/vector';
import { saveMarkdown } from '@/lib/storage';
import { summarize, generateTags, generateEmbedding, checkOllamaHealth, generateTitle } from '@/lib/ollama';

// CORS 配置 - 允许 Chrome 扩展访问
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

// 存储正在进行的AI处理任务
// key: noteId, value: AbortController
export const activeProcessing = new Map<number, AbortController>();

// 处理 CORS 预检请求
export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// 接收并处理内容
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { content, title, source_url, source_type = 'extension', context } = body;

        if (!content) {
            return NextResponse.json(
                { error: '内容不能为空' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        // 1. 立即保存原始数据
        // 生成临时标题（如果未提供）
        const tempTitle = title || '新笔记 (正在处理...)';

        // 写入数据库 (初始状态)
        const noteId = createNote({
            title: tempTitle,
            summary: '', // 稍后 AI 填充
            content_path: '',
            source_url,
            source_type,
            ai_status: 'pending'
        });

        // 保存 Markdown 文件
        const filename = saveMarkdown(noteId, tempTitle, content);

        // 更新 content_path
        updateNote(noteId, { content_path: filename });

        // 2. 创建 AbortController 用于取消
        const abortController = new AbortController();
        activeProcessing.set(noteId, abortController);

        // 3. 异步触发 AI 处理 (不等待完成即返回响应)
        processAI(noteId, content, context, tempTitle, abortController.signal)
            .catch(err => {
                if (err.name === 'AbortError') {
                    console.log(`AI 处理已取消 [Note ${noteId}]`);
                    updateNote(noteId, { ai_status: 'cancelled' });
                } else {
                    console.error(`后台 AI 处理失败 [Note ${noteId}]:`, err);
                    updateNote(noteId, { ai_status: 'failed' });
                }
            })
            .finally(() => {
                activeProcessing.delete(noteId);
            });

        return NextResponse.json(
            {
                success: true,
                noteId,
                title: tempTitle,
                status: 'pending',
                message: '已保存，正在后台进行 AI 分析'
            },
            { status: 201, headers: CORS_HEADERS }
        );
    } catch (error) {
        console.error('Ingest 错误:', error);
        return NextResponse.json(
            { error: '处理失败', details: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}

// 后台 AI 处理逻辑
async function processAI(
    noteId: number,
    content: string,
    context: any[],
    originalTitle: string,
    signal: AbortSignal
) {
    console.log(`开始 AI 处理 [Note ${noteId}]...`);

    // 检查是否已取消
    if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    // 检查笔记是否还存在（可能已被删除）
    const existingNote = getNoteById(noteId);
    if (!existingNote || existingNote.is_deleted) {
        console.log(`笔记 ${noteId} 已删除，跳过AI处理`);
        throw new DOMException('Note deleted', 'AbortError');
    }

    // 检查 Ollama 状态
    const isOllamaOnline = await checkOllamaHealth();

    // 再次检查是否已取消
    if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    let summary = '';
    let tags: string[] = [];
    let embedding: number[] = [];
    let noteTitle = '';

    if (isOllamaOnline) {
        try {
            // 生成摘要、标签、向量 - 这些是独立的，可以并行
            const results = await Promise.all([
                summarize(content),
                generateTags(content),
                generateEmbedding(content.substring(0, 2000)),
            ]);

            // 检查是否已取消
            if (signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }

            [summary, tags, embedding] = results;

            // 根据摘要生成更好的标题
            // Note: Parallel execution for speed
            const [generatedTitle] = await Promise.all([
                generateTitle(content)
            ]);

            noteTitle = generatedTitle || originalTitle;
        } catch (aiError: any) {
            if (aiError.name === 'AbortError') {
                throw aiError;
            }
            console.error('AI 处理部分失败:', aiError);
            summary = content.substring(0, 100) + '...';
            tags = ['未分类'];
        }
    } else {
        summary = content.substring(0, 100) + '...';
        tags = ['未分类'];
    }

    // 最后检查是否已取消
    if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
    }

    // 再次检查笔记是否还存在
    const noteStillExists = getNoteById(noteId);
    if (!noteStillExists || noteStillExists.is_deleted) {
        console.log(`笔记 ${noteId} 已删除，跳过保存结果`);
        throw new DOMException('Note deleted', 'AbortError');
    }

    // 更新数据库
    updateNote(noteId, {
        summary,
        title: noteTitle || `笔记 ${new Date().toLocaleDateString()}`,
        ai_status: 'completed',
        updated_at: new Date().toISOString()
    });

    // 关联标签
    for (const tagName of tags) {
        const tagId = getOrCreateTag(tagName);
        addTagToNote(noteId, tagId);
    }

    // 保存搜索上下文
    if (context && Array.isArray(context)) {
        for (const source of context) {
            addSource(noteId, {
                title: source.title,
                url: source.url,
                snippet: source.snippet,
            });
        }
    }

    // 保存向量
    if (embedding.length > 0) {
        await addNoteEmbedding({
            id: noteId,
            vector: embedding,
            title: noteTitle || 'Note',
            summary,
        });
    }

    console.log(`AI 处理完成 [Note ${noteId}]`);
}
