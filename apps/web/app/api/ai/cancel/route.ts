import { NextRequest, NextResponse } from 'next/server';
import { updateNote } from '@/lib/db';

export const runtime = 'edge';

const getDB = () => {
    // @ts-ignore
    const db = process.env.DB as unknown as D1Database;
    if (!db) throw new Error('DB binding not found');
    return db;
}

export async function POST(request: NextRequest) {
    try {
        const db = getDB();
        const { noteId } = await request.json() as any;

        if (!noteId) return NextResponse.json({ error: 'Note ID required' }, { status: 400 });

        // On Edge/Serverless, we can't easily abort a running process on another isolate.
        // Best effort: Mark as cancelled in DB so the background process checks it and stops (if polling).
        // Our 'ingest' route checks 'signal.aborted' but that's local to the request.
        // We will update the status to 'cancelled'.

        await updateNote(db, noteId, { ai_status: 'cancelled' });

        return NextResponse.json({ success: true, message: 'Marked as cancelled' });
    } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
    }
}
