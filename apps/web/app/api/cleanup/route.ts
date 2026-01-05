import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// 清理空的收藏夹和标签
export async function POST() {
    try {
        const db = getDb();

        // 1. 删除空的收藏夹（没有任何笔记关联的）
        const emptyCollections = db.prepare(`
            SELECT c.id, c.name FROM collections c
            LEFT JOIN note_collections nc ON c.id = nc.collection_id
            GROUP BY c.id
            HAVING COUNT(nc.note_id) = 0
        `).all() as { id: number; name: string }[];

        for (const col of emptyCollections) {
            db.prepare('DELETE FROM collections WHERE id = ?').run(col.id);
        }

        // 2. 删除空的标签（没有任何非删除笔记关联的）
        const emptyTags = db.prepare(`
            SELECT t.id, t.name FROM tags t
            LEFT JOIN note_tags nt ON t.id = nt.tag_id
            LEFT JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
            GROUP BY t.id
            HAVING COUNT(n.id) = 0
        `).all() as { id: number; name: string }[];

        for (const tag of emptyTags) {
            // 先删除关联记录
            db.prepare('DELETE FROM note_tags WHERE tag_id = ?').run(tag.id);
            // 再删除标签
            db.prepare('DELETE FROM tags WHERE id = ?').run(tag.id);
        }

        return NextResponse.json({
            success: true,
            cleaned: {
                collections: emptyCollections.map(c => c.name),
                tags: emptyTags.map(t => t.name)
            },
            message: `已清理 ${emptyCollections.length} 个空收藏夹，${emptyTags.length} 个空标签`
        });
    } catch (error) {
        console.error('清理失败:', error);
        return NextResponse.json(
            { error: '清理失败', details: String(error) },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        const db = getDb();

        // 统计空的收藏夹
        const emptyCollections = db.prepare(`
            SELECT c.id, c.name FROM collections c
            LEFT JOIN note_collections nc ON c.id = nc.collection_id
            GROUP BY c.id
            HAVING COUNT(nc.note_id) = 0
        `).all() as { id: number; name: string }[];

        // 统计空的标签
        const emptyTags = db.prepare(`
            SELECT t.id, t.name FROM tags t
            LEFT JOIN note_tags nt ON t.id = nt.tag_id
            LEFT JOIN notes n ON nt.note_id = n.id AND n.is_deleted = 0
            GROUP BY t.id
            HAVING COUNT(n.id) = 0
        `).all() as { id: number; name: string }[];

        return NextResponse.json({
            emptyCollections: emptyCollections.map(c => c.name),
            emptyTags: emptyTags.map(t => t.name),
            summary: `发现 ${emptyCollections.length} 个空收藏夹，${emptyTags.length} 个空标签`
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
