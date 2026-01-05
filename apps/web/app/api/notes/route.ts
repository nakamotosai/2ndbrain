import { NextRequest, NextResponse } from 'next/server';
import { getNotes, getNoteById, getNoteTags, getNotesByTag, getAllTags } from '@/lib/db';
import { readMarkdown, parseMarkdown } from '@/lib/storage';

// CORS 配置
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, DELETE, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// 获取笔记列表或单个笔记详情
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Dynamic imports to ensure we get latest DB functions
        const { getNoteById, getNotes, getDeletedNotes, getNotesByTag, getNotesByCollection, getNotesBySource, getNoteTags, getAllTags } = await import('@/lib/db');
        const { readMarkdown, parseMarkdown } = await import('@/lib/storage');

        // 获取单个笔记详情
        const noteId = searchParams.get('id');
        if (noteId) {
            const note = getNoteById(parseInt(noteId));
            if (!note) {
                return NextResponse.json(
                    { error: '笔记不存在' },
                    { status: 404, headers: CORS_HEADERS }
                );
            }

            // 获取完整内容
            let content = '';
            if (note.content_path) {
                const markdown = readMarkdown(note.content_path);
                if (markdown) {
                    const { body } = parseMarkdown(markdown);
                    content = body;
                }
            }

            // 获取标签
            const tags = getNoteTags(parseInt(noteId));

            return NextResponse.json(
                { ...note, content, tags },
                { headers: CORS_HEADERS }
            );
        }

        // 获取标签统计
        const tagsOnly = searchParams.get('tags');
        if (tagsOnly === 'true') {
            const tags = getAllTags();
            return NextResponse.json({ tags }, { headers: CORS_HEADERS });
        }

        // 核心过滤逻辑
        let notes: any[] = [];

        const trash = searchParams.get('trash');
        const collectionId = searchParams.get('collectionId');
        const source = searchParams.get('source'); // 'twitter', 'youtube', 'web'
        const tagFilter = searchParams.get('tag');

        if (trash === 'true') {
            notes = getDeletedNotes();
        } else if (collectionId) {
            notes = getNotesByCollection(parseInt(collectionId));
        } else if (source) {
            notes = getNotesBySource(source);
        } else if (tagFilter) {
            notes = getNotesByTag(tagFilter);
        } else {
            // 默认分页获取列表
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '50');
            const offset = (page - 1) * limit;
            notes = getNotes(limit, offset);
        }

        // 统一附加标签信息
        const notesWithTags = notes.map(note => ({
            ...note,
            tags: getNoteTags(Number(note.id)),
        }));

        return NextResponse.json(
            {
                notes: notesWithTags,
                page: 1,
                hasMore: false,
            },
            { headers: CORS_HEADERS }
        );

    } catch (error) {
        console.error('Notes API 错误:', error);
        return NextResponse.json(
            { error: '获取笔记失败', details: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}

// 删除笔记 (Soft Delete) - 同时取消AI处理
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const permanent = searchParams.get('permanent') === 'true';

        if (!id) {
            return NextResponse.json({ error: 'ID required' }, { status: 400, headers: CORS_HEADERS });
        }

        const noteId = parseInt(id);

        // 尝试取消正在进行的AI处理
        try {
            const { activeProcessing } = await import('@/app/api/ingest/route');
            const controller = activeProcessing.get(noteId);
            if (controller) {
                controller.abort();
                activeProcessing.delete(noteId);
                console.log(`删除笔记时取消AI处理 [Note ${noteId}]`);
            }
        } catch (e) {
            // 忽略错误，继续删除
            console.log('取消AI处理时出错（可忽略）:', e);
        }

        const { deleteNote } = await import('@/lib/db');
        deleteNote(noteId, permanent);

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}

// RESTORE or Reorder
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, sort_order, restore } = body;

        // Restore logic
        if (id && restore) {
            const { restoreNote } = await import('@/lib/db');
            restoreNote(id);
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        if (id && sort_order !== undefined) {
            const { updateNote } = await import('@/lib/db');
            updateNote(id, { sort_order });
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        return NextResponse.json({ error: 'Invalid data' }, { status: 400, headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}
