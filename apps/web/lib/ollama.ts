// Ollama API 客户端
// 默认配置
const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || 'qwen3:8b';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';

// 健康检查 - 确认 Ollama 是否在线
export async function checkOllamaHealth(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000), // 3秒超时
        });
        return res.ok;
    } catch {
        return false;
    }
}

// 生成嵌入向量
export async function generateEmbedding(text: string): Promise<number[]> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
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

    const data = await res.json();
    return data.embedding;
}

// 生成聊天回复 (非流式)
export async function chat(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<string> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
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

    const data = await res.json();
    return data.message?.content || '';
}

// 生成聊天回复 (流式)
export async function* chatStream(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: true,
        }),
    });

    if (!res.ok) {
        throw new Error(`Chat stream failed: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                    yield json.message.content;
                }
            } catch {
                // 忽略解析错误
            }
        }
    }
}

// 摘要生成 (实用导师模式)
export async function summarize(content: string): Promise<string> {
    const { search } = await import('duck-duck-scrape');
    let searchContext = '';
    let searchResultsList: any[] = [];

    try {
        // Extract keywords for search
        const keywordsRes = await chat([
            { role: 'system', content: 'Extract 3-5 keys search terms from the text to understand the background and trends. Return only keywords separated by spaces.' },
            { role: 'user', content: content.substring(0, 500) }
        ]);

        const searchResults = await search(keywordsRes + " news trends analysis", { safeSearch: 0 }); // safeSearch: 0 (Off) for news
        if (searchResults.results && searchResults.results.length > 0) {
            searchResultsList = searchResults.results.slice(0, 3);
            searchContext = searchResultsList.map(r => `[${r.title}](${r.url}): ${r.description}`).join('\n');
        }
    } catch (e) {
        console.error('Search failed:', e);
    }

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

    // Append search sources if used
    if (searchResultsList.length > 0) {
        summary += '\n\n### 🌐 参考资料\n' + searchResultsList.map(r => `- [${r.title}](${r.url})`).join('\n');
    }

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

        // 如果解析失败，返回未分类
        if (tags.length === 0) {
            console.log('标签解析失败，返回未分类');
            return ['未分类'];
        }

        return tags.slice(0, 5); // 最多5个标签
    } catch (error) {
        console.error('生成标签失败:', error);
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

// 获取配置信息
export function getOllamaConfig() {
    return {
        baseUrl: OLLAMA_BASE_URL,
        chatModel: CHAT_MODEL,
        embedModel: EMBED_MODEL,
    };
}

// 生成补全 (Generate API)
export async function generateCompletion(options: {
    model: string;
    prompt: string;
    format?: 'json';
    stream?: boolean;
    system?: string;
}): Promise<{ response: string }> {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...options,
            stream: false
        }),
    });

    if (!res.ok) {
        throw new Error(`Generate failed: ${res.status} ${res.statusText}`);
    }

    return await res.json();
}
