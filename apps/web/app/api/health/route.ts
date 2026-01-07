import { NextResponse } from 'next/server';
import { checkOllamaHealth } from '@/lib/ollama';

export const runtime = 'edge';

// CORS headers
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
    try {
        const isOnline = await checkOllamaHealth();
        return NextResponse.json({
            status: isOnline ? 'online' : 'offline',
            service: 'ollama'
        }, { headers: CORS_HEADERS });
    } catch (e) {
        return NextResponse.json(
            { status: 'error', error: String(e) },
            { status: 500, headers: CORS_HEADERS }
        );
    }
}
