// Ollama API 客户端
// 默认配置
const getBaseUrl = () => {
    // @ts-ignore
    return process.env.OLLAMA_URL || 'http://localhost:11434';
};

const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'qwen3:8b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// Helper for fetch with timeout
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 10000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// 健康检查 - 确认 Ollama 是否在线
export async function checkOllamaHealth(): Promise<boolean> {
    try {
        const baseUrl = getBaseUrl();
        if (baseUrl.includes('localhost') && process.env.NODE_ENV === 'production') {
            console.warn('Production Edge environment cannot access localhost. Set OLLAMA_URL to a Tunnel URL.');
        }

        const res = await fetchWithTimeout(`${baseUrl}/api/tags`, {
            method: 'GET',
        }, 3000); // 3秒超时
        return res.ok;
    } catch (e: any) {
        console.warn('Ollama Health Check Failed:', e.message);
        return false;
    }
}

// 生成嵌入向量
export async function generateEmbedding(text: string): Promise<number[]> {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: EMBED_MODEL,
            prompt: text,
        }),
    });

    if (!res.ok) {
        throw new Error(`Embedding failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    return data.embedding;
}

// 生成聊天回复 (非流式)
export async function chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
    const baseUrl = getBaseUrl();
    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: false,
        }),
    });

    if (!res.ok) {
        throw new Error(`Chat failed: ${res.status} ${res.statusText}`);
    }

    const data = await res.json() as any;
    return data.message?.content || '';
}

// 摘要生成 (实用导师模式)
export async function summarize(content: string): Promise<string> {
    // Note: Search functionality disabled for Edge compatibility.
    // 'duck-duck-scrape' is not Edge compatible.
    const searchContext = '';

    const messages = [
        {
            role: 'system' as const,
            content: `你是一位资深行业导师，专门帮助用户理解和运用推文中的信息。你的风格是直接、实用、像私教一样耐心。
**核心要求**：
- 你是在**教导用户**，而非让用户自己思考
- **禁止**提问题让用户思考（如"值得思考的是..."）
- **禁止**空泛的哲学式总结
- **必须**提供具体、可操作的信息
**输出格式**：
**一句话核心**：用一句话说清楚这条推文讲的是什么赚钱/学习机会
**背景知识**：
- 解释推文中出现的专业术语、平台、工具
- 补充相关行业背景（这个领域的现状，谁在做，市场规模等）
**操作指南**：
- 如果推文涉及赚钱/变现，列出具体步骤和注意事项
- 如果推文是信息分享，说明如何验证和使用这些信息
- 给出你作为导师的建议：适合谁做？难度如何？风险在哪？
**延伸资源**：（可选）
- 推荐相关工具、网站、学习资源
请用 Markdown 格式输出，层级清晰。不要使用一级标题。`,
        },
        {
            role: 'user' as const,
            content: `推文内容：
${content}
参考资料（实时搜索）：
${searchContext || '无额外参考资料'}`,
        },
    ];

    let summary = await chat(messages);
    return summary;
}

// 自动标签生成
export async function generateTags(content: string): Promise<string[]> {
    try {
        const messages = [
            {
                role: 'system' as const,
                content: '你是一个内容分类助手。请为以下内容生成3-5个相关标签，用逗号分隔，只返回标签，不要其他解释。标签应简短有意义（2-6个字）。',
            },
            {
                role: 'user' as const,
                content: content.substring(0, 2000), // 限制长度避免超时
            },
        ];

        const response = await chat(messages);
        const tags = response
            .replace(/[\n\r]/g, ',') // 换行也当作分隔符
            .split(/[,，、]/) // 支持更多分隔符
            .map(tag => tag.trim().replace(/^[#＃]/, '')) // 去掉可能的#号
            .filter(tag => tag.length >= 2 && tag.length <= 10); // 2-10个字符

        if (tags.length === 0) {
            return ['Uncategorized'];
        }

        return tags.slice(0, 5); // 最多5个标签
    } catch (error) {
        console.error('生成标签失败:', error);
        return ['Uncategorized']; // Fallback
    }
}

// 标题生成
export async function generateTitle(content: string): Promise<string> {
    try {
        const messages = [
            {
                role: 'system' as const,
                content: '你是一个专业的编辑。请为以下内容生成一个简短的标题（12个字以内）。只返回标题文本，不要包含任何标点符号或前缀。',
            },
            {
                role: 'user' as const,
                content: content.substring(0, 2000),
            },
        ];

        const response = await chat(messages);
        return response.replace(/["《》]/g, '').trim().substring(0, 20); // 稍微宽容一点限制，防止截断
    } catch (error) {
        console.error('生成标题失败:', error);
        return '';
    }
}

// Chat Stream Implementation
export async function* chatStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): AsyncGenerator<string, void, unknown> {
    const baseUrl = getBaseUrl();
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: true,
        }),
    });

    if (!response.ok || !response.body) {
        throw new Error(`Chat API error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Keep the last partial line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    yield json.message.content;
                }
                if (json.done) return;
            } catch (e) {
                // Ignore incomplete JSON
            }
        }
    }
}
