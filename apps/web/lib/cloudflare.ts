// Cloudflare Pages bindings helper
// Use getRequestContext() to access bindings in Cloudflare Pages
import { getRequestContext } from '@cloudflare/next-on-pages';
import type { CloudflareEnv } from '@/env';

/**
 * Get Cloudflare environment bindings (D1, Vectorize, etc.)
 * Must be called inside a request handler, not at module initialization
 */
export function getCloudflareEnv(): CloudflareEnv {
    try {
        const ctx = getRequestContext();
        const env = ctx.env as CloudflareEnv;

        if (!env.DB) {
            throw new Error('D1 database binding (DB) not found');
        }
        if (!env.VECTORIZE) {
            throw new Error('Vectorize binding (VECTORIZE) not found');
        }

        return env;
    } catch (error) {
        // Fallback to process.env for local development with setupDevPlatform
        // @ts-ignore
        const db = process.env.DB as unknown as D1Database;
        // @ts-ignore
        const vectorize = process.env.VECTORIZE as unknown as VectorizeIndex;
        // @ts-ignore
        const ollamaUrl = process.env.OLLAMA_URL as string | undefined;

        if (!db || !vectorize) {
            throw new Error('Cloudflare bindings not available. Make sure you are running in a Cloudflare environment.');
        }

        return { DB: db, VECTORIZE: vectorize, OLLAMA_URL: ollamaUrl };
    }
}

/**
 * Get D1 database binding
 */
export function getDB(): D1Database {
    return getCloudflareEnv().DB;
}

/**
 * Get Vectorize index binding
 */
export function getVectorize(): VectorizeIndex {
    return getCloudflareEnv().VECTORIZE;
}
