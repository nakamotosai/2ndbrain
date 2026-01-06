// Cloudflare Pages Platform Environment
interface CloudflareEnv {
    DB: D1Database;
    VECTORIZE: VectorizeIndex;
    // AI: any; 
    OLLAMA_URL?: string;
}

declare global {
    namespace NodeJS {
        interface ProcessEnv {
            [key: string]: string | undefined;
        }
    }
}

export type { CloudflareEnv };
