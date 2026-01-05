// 测试脚本：验证数据层初始化
import { getDb, createNote, getNotes, getOrCreateTag, addTagToNote, getNoteTags } from '../lib/db';
import { getVectorDb, addNoteEmbedding, searchSimilarNotes, getEmbeddingCount } from '../lib/vector';
import { saveMarkdown, readMarkdown, parseMarkdown, listArchives } from '../lib/storage';
import { checkOllamaHealth, generateEmbedding, getOllamaConfig } from '../lib/ollama';

async function testDataLayer() {
    console.log('🧪 开始测试数据层...\n');

    // ==================== 1. 测试 SQLite ====================
    console.log('📦 测试 SQLite...');
    try {
        const db = getDb();
        console.log('  ✅ SQLite 连接成功');

        // 插入测试笔记
        const noteId = createNote({
            title: '测试笔记',
            summary: '这是一个测试笔记的摘要',
            content_path: 'test-note.md',
            source_url: 'https://example.com',
            source_type: 'manual',
        });
        console.log(`  ✅ 创建笔记成功, ID: ${noteId}`);

        // 创建标签
        const tagId = getOrCreateTag('测试');
        addTagToNote(noteId, tagId);
        console.log(`  ✅ 创建标签成功, ID: ${tagId}`);

        // 读取笔记
        const notes = getNotes(10, 0);
        console.log(`  ✅ 读取笔记成功, 数量: ${notes.length}`);

        // 读取标签
        const tags = getNoteTags(noteId);
        console.log(`  ✅ 读取笔记标签成功, 标签: ${tags.map(t => t.name).join(', ')}`);
    } catch (error) {
        console.error('  ❌ SQLite 测试失败:', error);
    }

    // ==================== 2. 测试文件存储 ====================
    console.log('\n📁 测试文件存储...');
    try {
        const content = '# 测试标题\n\n这是测试内容。';
        const filename = saveMarkdown(999, '测试文件', content);
        console.log(`  ✅ 保存 Markdown 成功: ${filename}`);

        const readContent = readMarkdown(filename);
        if (readContent) {
            const { metadata, body } = parseMarkdown(readContent);
            console.log(`  ✅ 读取 Markdown 成功, 标题: ${metadata.title}`);
        }

        const archives = listArchives();
        console.log(`  ✅ 列出存档成功, 数量: ${archives.length}`);
    } catch (error) {
        console.error('  ❌ 文件存储测试失败:', error);
    }

    // ==================== 3. 测试 LanceDB ====================
    console.log('\n🔍 测试 LanceDB...');
    try {
        await getVectorDb();
        console.log('  ✅ LanceDB 连接成功');

        // 创建测试向量 (768 维，模拟 nomic-embed-text)
        const testVector = Array.from({ length: 768 }, () => Math.random());

        await addNoteEmbedding({
            id: 1,
            vector: testVector,
            title: '测试笔记',
            summary: '这是测试摘要',
        });
        console.log('  ✅ 添加嵌入向量成功');

        const count = await getEmbeddingCount();
        console.log(`  ✅ 当前嵌入数量: ${count}`);

        // 搜索测试
        const results = await searchSimilarNotes(testVector, 3);
        console.log(`  ✅ 向量搜索成功, 结果数: ${results.length}`);
    } catch (error) {
        console.error('  ❌ LanceDB 测试失败:', error);
    }

    // ==================== 4. 测试 Ollama ====================
    console.log('\n🤖 测试 Ollama...');
    try {
        const config = getOllamaConfig();
        console.log(`  📋 配置: ${config.baseUrl}`);
        console.log(`  📋 对话模型: ${config.chatModel}`);
        console.log(`  📋 嵌入模型: ${config.embedModel}`);

        const isOnline = await checkOllamaHealth();
        if (isOnline) {
            console.log('  ✅ Ollama 在线');

            // 测试嵌入向量生成
            try {
                const embedding = await generateEmbedding('测试文本');
                console.log(`  ✅ 嵌入向量生成成功, 维度: ${embedding.length}`);
            } catch (e) {
                console.log(`  ⚠️  嵌入向量生成失败 (可能需要先运行 ollama pull ${config.embedModel})`);
            }
        } else {
            console.log('  ⚠️  Ollama 离线 (请启动 ollama serve)');
        }
    } catch (error) {
        console.error('  ❌ Ollama 测试失败:', error);
    }

    console.log('\n✨ 数据层测试完成！');
}

// 运行测试
testDataLayer().catch(console.error);
