import { NextRequest, NextResponse } from 'next/server';
import { updateNote } from '@/lib/db';
import { activeProcessing } from '@/app/api/ingest/route';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

// 取消AI处理
export async function POST(request: NextRequest) {
    try {
        const { noteId } = await request.json();

        if (!noteId) {
            return NextResponse.json(
                { error: 'noteId is required' },
                { status: 400, headers: CORS_HEADERS }
            );
        }

        const controller = activeProcessing.get(noteId);

        if (controller) {
            controller.abort();
            activeProcessing.delete(noteId);

            // 更新数据库状态
            updateNote(noteId, { ai_status: 'cancelled' });

            console.log(`AI 处理已取消 [Note ${noteId}]`);

            return NextResponse.json(
                { success: true, message: 'AI处理已取消' },
                { headers: CORS_HEADERS }
            );
        } else {
            // 没有正在进行的处理，可能已完成
            return NextResponse.json(
                { success: true, message: '没有进行中的AI处理' },
                { headers: CORS_HEADERS }
            );
        }
    } catch (error) {
        console.error('取消AI处理失败:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
