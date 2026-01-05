import { NextRequest, NextResponse } from 'next/server';

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
    try {
        const id = parseInt(params.id);
        const { deleteCollection } = await import('@/lib/db');
        deleteCollection(id);
        return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500, headers: CORS_HEADERS });
    }
}
