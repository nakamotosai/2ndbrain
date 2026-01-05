import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs';

// 向量数据库路径
const VECTOR_DB_PATH = path.join(process.cwd(), 'data', 'vectors');

// 确保目录存在
if (!fs.existsSync(VECTOR_DB_PATH)) {
    fs.mkdirSync(VECTOR_DB_PATH, { recursive: true });
}

// LanceDB 连接 (单例)
let db: lancedb.Connection | null = null;

export async function getVectorDb(): Promise<lancedb.Connection> {
    if (!db) {
        db = await lancedb.connect(VECTOR_DB_PATH);
    }
    return db;
}

// 笔记向量记录结构
export interface NoteVector {
    id: number;        // 对应 SQLite 中的 note_id
    vector: number[];  // 嵌入向量
    title: string;
    summary: string;
}

const TABLE_NAME = 'notes_embeddings';

// 获取或创建表
async function getTable(): Promise<lancedb.Table | null> {
    const database = await getVectorDb();
    const tables = await database.tableNames();

    if (tables.includes(TABLE_NAME)) {
        return database.openTable(TABLE_NAME);
    }
    return null;
}

// 添加笔记嵌入向量
export async function addNoteEmbedding(note: NoteVector): Promise<void> {
    const database = await getVectorDb();
    const tables = await database.tableNames();

    const record = {
        id: note.id,
        vector: note.vector,
        title: note.title,
        summary: note.summary,
    };

    if (!tables.includes(TABLE_NAME)) {
        // 首次创建表
        await database.createTable(TABLE_NAME, [record]);
    } else {
        const table = await database.openTable(TABLE_NAME);
        await table.add([record]);
    }
}

// 向量搜索 - 查找相似笔记
export async function searchSimilarNotes(
    queryVector: number[],
    limit = 5
): Promise<Array<{ id: number; title: string; summary: string; score: number }>> {
    const table = await getTable();
    if (!table) return [];

    const results = await table
        .vectorSearch(queryVector)
        .limit(limit)
        .toArray();

    return results.map((r) => ({
        id: r.id as number,
        title: r.title as string,
        summary: r.summary as string,
        score: r._distance as number,
    }));
}

// 删除笔记嵌入
export async function deleteNoteEmbedding(noteId: number): Promise<void> {
    const table = await getTable();
    if (!table) return;

    await table.delete(`id = ${noteId}`);
}

// 获取所有嵌入数量
export async function getEmbeddingCount(): Promise<number> {
    const table = await getTable();
    if (!table) return 0;

    return await table.countRows();
}
