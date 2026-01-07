import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';
import { getNotes, getNoteById, getNoteTags, getNotesByTag, getAllTags, getDeletedNotes, getArchivedNotes, getNotesByCollection, getNotesBySource, getNoteCollections, deleteNote, restoreNote, updateNote, updateNoteSortOrder, emptyTrash } from '@/lib/db';

export const runtime = 'edge';

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
        const db = getDB();
        const { searchParams } = new URL(request.url);

        // 获取单个笔记详情
        const noteId = searchParams.get('id');
        if (noteId) {
            const note = await getNoteById(db, parseInt(noteId));
            if (!note) {
                return NextResponse.json(
                    { error: '笔记不存在' },
                    { status: 404, headers: CORS_HEADERS }
                );
            }

            const tags = await getNoteTags(db, parseInt(noteId));
            const collections = await getNoteCollections(db, parseInt(noteId));

            return NextResponse.json(
                { ...note, tags, collections },
                { headers: CORS_HEADERS }
            );
        }

        // 获取标签统计
        const tagsOnly = searchParams.get('tags');
        if (tagsOnly === 'true') {
            const tags = await getAllTags(db);
            return NextResponse.json({ tags }, { headers: CORS_HEADERS });
        }

        // 核心过滤逻辑
        let notes: any[] = [];

        const trash = searchParams.get('trash');
        const archived = searchParams.get('archived');
        const collectionId = searchParams.get('collectionId');
        const source = searchParams.get('source');
        const tagFilter = searchParams.get('tag');

        if (trash === 'true') {
            notes = await getDeletedNotes(db);
        } else if (archived === 'true') {
            notes = await getArchivedNotes(db);
        } else if (collectionId) {
            notes = await getNotesByCollection(db, parseInt(collectionId));
        } else if (source) {
            notes = await getNotesBySource(db, source);
        } else if (tagFilter) {
            notes = await getNotesByTag(db, tagFilter);
        } else {
            const page = parseInt(searchParams.get('page') || '1');
            const limit = parseInt(searchParams.get('limit') || '50');
            const offset = (page - 1) * limit;
            notes = await getNotes(db, limit, offset);
        }

        // 统一附加标签信息
        const notesWithTags = await Promise.all(notes.map(async note => ({
            ...note,
            tags: await getNoteTags(db, Number(note.id)),
        })));

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

// 删除笔记 (Soft Delete)
export async function DELETE(request: NextRequest) {
    try {
        const db = getDB();
        const { searchParams } = new URL(request.url);
        const idStr = searchParams.get('id');
        const action = searchParams.get('action');
        const permanent = searchParams.get('permanent') === 'true';

        if (action === 'emptyTrash') {
            await emptyTrash(db);
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        if (!idStr) {
            return NextResponse.json({ error: 'ID is required' }, { status: 400, headers: CORS_HEADERS });
        }
        const noteId = parseInt(idStr);

        await deleteNote(db, noteId, permanent);

        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}

// RESTORE or Reorder
export async function PATCH(request: NextRequest) {
    try {
        const db = getDB();
        const body = await request.json() as any;

        if (Array.isArray(body)) {
            await updateNoteSortOrder(db, body);
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        const { id, sort_order, restore } = body;

        if (id && restore) {
            await restoreNote(db, id);
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        if (id && sort_order !== undefined) {
            await updateNote(db, id, { sort_order });
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        if (id && body.is_archived !== undefined) {
            await updateNote(db, id, { is_archived: !!body.is_archived });
            return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
        }

        return NextResponse.json({ error: 'Invalid data' }, { status: 400, headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}
