import fs from 'fs';
import path from 'path';

// 存档目录路径
const ARCHIVES_PATH = path.join(process.cwd(), 'data', 'archives');

// 确保目录存在
if (!fs.existsSync(ARCHIVES_PATH)) {
    fs.mkdirSync(ARCHIVES_PATH, { recursive: true });
}

// 生成唯一文件名
function generateFilename(noteId: number, title: string): string {
    const sanitized = title
        .toLowerCase()
        .replace(/[^a-z0-9\u4e00-\u9fa5]/g, '-')  // 保留中英文，其他替换为横线
        .replace(/-+/g, '-')
        .substring(0, 50);
    const timestamp = Date.now();
    return `${noteId}-${sanitized}-${timestamp}.md`;
}

// 保存 Markdown 内容
export function saveMarkdown(noteId: number, title: string, content: string): string {
    const filename = generateFilename(noteId, title);
    const filePath = path.join(ARCHIVES_PATH, filename);

    // 添加 YAML frontmatter
    const fullContent = `---
id: ${noteId}
title: "${title}"
created: ${new Date().toISOString()}
---

${content}`;

    fs.writeFileSync(filePath, fullContent, 'utf-8');
    return filename;
}

// 读取 Markdown 内容
export function readMarkdown(filename: string): string | null {
    const filePath = path.join(ARCHIVES_PATH, filename);

    if (!fs.existsSync(filePath)) {
        return null;
    }

    return fs.readFileSync(filePath, 'utf-8');
}

// 解析 Markdown 内容 (去除 frontmatter)
export function parseMarkdown(content: string): { metadata: Record<string, string>; body: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { metadata: {}, body: content };
    }

    const metadata: Record<string, string> = {};
    const frontmatter = match[1];

    frontmatter.split('\n').forEach(line => {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value = line.substring(colonIndex + 1).trim();
            // 移除引号
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            metadata[key] = value;
        }
    });

    const body = content.substring(match[0].length);
    return { metadata, body };
}

// 删除 Markdown 文件
export function deleteMarkdown(filename: string): boolean {
    const filePath = path.join(ARCHIVES_PATH, filename);

    if (!fs.existsSync(filePath)) {
        return false;
    }

    fs.unlinkSync(filePath);
    return true;
}

// 列出所有存档文件
export function listArchives(): string[] {
    if (!fs.existsSync(ARCHIVES_PATH)) {
        return [];
    }

    return fs.readdirSync(ARCHIVES_PATH)
        .filter(file => file.endsWith('.md'))
        .sort((a, b) => {
            // 按修改时间倒序
            const statA = fs.statSync(path.join(ARCHIVES_PATH, a));
            const statB = fs.statSync(path.join(ARCHIVES_PATH, b));
            return statB.mtime.getTime() - statA.mtime.getTime();
        });
}

// 获取存档目录路径
export function getArchivesPath(): string {
    return ARCHIVES_PATH;
}
