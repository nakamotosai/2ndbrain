import type { VectorizeIndex } from '@cloudflare/workers-types';

export interface NoteVector {
    id: number;        // Corresponds to SQLite note_id
    vector: number[];  // Embedding vector
    title: string;
    summary: string;
}

// 添加笔记嵌入向量
export async function addNoteEmbedding(index: VectorizeIndex, note: NoteVector): Promise<void> {
    await index.upsert([
        {
            id: note.id.toString(),
            values: note.vector,
            metadata: {
                title: note.title,
                summary: note.summary,
            },
        },
    ]);
}

// 向量搜索 - 查找相似笔记
export async function searchSimilarNotes(
    index: VectorizeIndex,
    queryVector: number[],
    limit = 5
): Promise<Array<{ id: number; title: string; summary: string; score: number }>> {
    const results = await index.query(queryVector, {
        topK: limit,
        returnMetadata: true,
    });

    return results.matches.map((match) => ({
        id: parseInt(match.id),
        title: (match.metadata?.title as string) || '',
        summary: (match.metadata?.summary as string) || '',
        score: match.score,
    }));
}

// 删除笔记嵌入
export async function deleteNoteEmbedding(index: VectorizeIndex, noteId: number): Promise<void> {
    await index.deleteByIds([noteId.toString()]);
}

// 获取所有嵌入数量 (Vectorize logic varies, usually verify via specific API if needed, 
// here we might just omit or implement if critical. D1 doesn't have a direct 'count' for Vectorize easily exposed without query)
export async function getEmbeddingCount(index: VectorizeIndex): Promise<number> {
    // Vectorize binding doesn't expose a simple count method in standard workers types universally without query/describe.
    // For now, we'll return a placeholder or remove this if unused.
    // Assuming we don't strictly need it for core functionality locally.
    return 0; // Placeholder
}
