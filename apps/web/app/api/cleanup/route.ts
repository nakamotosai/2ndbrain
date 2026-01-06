import { NextResponse } from 'next/server';
import { emptyTrash } from '@/lib/db';

export const runtime = 'edge';

const getDB = () => {
    // @ts-ignore
    const db = process.env.DB as unknown as D1Database;
    if (!db) throw new Error('DB binding not found');
    return db;
}

export async function POST() {
    try {
        const db = getDB();
        await emptyTrash(db);
        return NextResponse.json({ success: true });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
