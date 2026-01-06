import { NextResponse } from 'next/server';
import { checkOllamaHealth } from '@/lib/ollama';

export const runtime = 'edge';

export async function GET() {
    try {
        const isOnline = await checkOllamaHealth();
        return NextResponse.json({
            status: isOnline ? 'online' : 'offline',
            service: 'ollama'
        });
    } catch (e) {
        return NextResponse.json({ status: 'error', error: String(e) }, { status: 500 });
    }
}
