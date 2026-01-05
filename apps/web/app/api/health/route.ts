import { NextResponse } from 'next/server';
import { checkOllamaHealth, getOllamaConfig } from '@/lib/ollama';
import { getDb } from '@/lib/db';
import { getEmbeddingCount } from '@/lib/vector';

// 健康检查端点
export async function GET() {
    try {
        // 检查各组件状态
        const [ollamaOnline, vectorCount] = await Promise.all([
            checkOllamaHealth(),
            getEmbeddingCount().catch(() => 0),
        ]);

        // 测试 SQLite 连接
        let sqliteOnline = false;
        let noteCount = 0;
        try {
            const db = getDb();
            const result = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number };
            noteCount = result.count;
            sqliteOnline = true;
        } catch {
            sqliteOnline = false;
        }

        const config = getOllamaConfig();

        return NextResponse.json({
            status: ollamaOnline && sqliteOnline ? 'healthy' : 'degraded',
            components: {
                ollama: {
                    online: ollamaOnline,
                    url: config.baseUrl,
                    chatModel: config.chatModel,
                    embedModel: config.embedModel,
                },
                sqlite: {
                    online: sqliteOnline,
                    noteCount,
                },
                lancedb: {
                    online: true, // LanceDB 是文件型，总是可用
                    vectorCount,
                },
            },
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        return NextResponse.json(
            {
                status: 'error',
                error: String(error),
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}
