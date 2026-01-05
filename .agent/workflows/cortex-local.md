---
description: Cortex-Local 多Agent分步工作流
---

# Cortex-Local 多Agent工作流

本项目由4个专业AI Agent角色分步完成，每个角色在独立的对话上下文中执行，避免上下文过长。

---

## 🏗️ Agent 1: Local Architect (本地架构师)

**职责**: 项目初始化、文件系统、嵌入式数据库配置

**启动指令** (新对话中复制使用):
```
你是 Cortex-Local 项目的 Local Architect。

任务: 初始化 Monorepo 并配置本地数据层

目标目录: c:\Users\sai\cortex-local

执行以下步骤:

1. 初始化 pnpm monorepo (package.json + pnpm-workspace.yaml)

2. 创建 apps/web (Next.js 14 App Router):
   - npx create-next-app@14 apps/web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"

3. 创建 apps/web/data 目录结构:
   - data/archives/ (存储 Markdown)
   - data/vectors/ (LanceDB 索引)
   - 添加到 .gitignore

4. 安装数据层依赖:
   - better-sqlite3 (SQLite)
   - vectordb (LanceDB)

5. 创建以下文件:
   - apps/web/lib/db.ts (SQLite 连接，表: notes, tags, sources, note_tags)
   - apps/web/lib/vector.ts (LanceDB 连接，嵌入模型: nomic-embed-text)
   - apps/web/lib/storage.ts (文件系统助手)
   - apps/web/lib/ollama.ts (Ollama 客户端，模型: qwen3:8b)

6. 创建测试脚本验证数据层

完成后报告状态，不要继续其他阶段。
```

**验证标准**:
- `pnpm install` 成功
- `apps/web/data/` 目录存在
- 测试脚本能读写 SQLite 和 LanceDB

---

## 🔌 Agent 2: Extension Lead (扩展主管)

**职责**: Plasmo Chrome 扩展开发

**前置条件**: Agent 1 完成

**启动指令** (新对话中复制使用):
```
你是 Cortex-Local 项目的 Extension Lead。

任务: 开发 Plasmo Chrome 扩展

目标目录: c:\Users\sai\cortex-local

执行以下步骤:

1. 初始化 Plasmo 扩展:
   - cd 到项目根目录
   - npx plasmo init apps/extension --with-src

2. 配置扩展权限 (manifest):
   - host_permissions: twitter.com, x.com, bilibili.com, google.com
   - permissions: activeTab, storage

3. 创建 Twitter 内容脚本 (contents/twitter.ts):
   - 提取推文文本、用户名、时间、互动数据
   - 添加 "保存到 Cortex" 按钮

4. 创建后台服务工作者 (background/index.ts):
   - 接收内容脚本消息
   - 执行 Google 搜索获取上下文 (Top 3 摘要)
   - POST 到 http://localhost:3000/api/ingest

5. 创建弹出设置面板 (popup/index.tsx):
   - Ollama URL 配置 (默认 localhost:11434)
   - 连接状态指示

完成后报告状态，不要继续其他阶段。
```

**验证标准**:
- `pnpm build` 生成扩展包
- 能加载到 Chrome 开发者模式
- Twitter 页面显示保存按钮

---

## 🧠 Agent 3: FullStack Lead (全栈主管)

**职责**: Next.js API 路由开发

**前置条件**: Agent 1 完成

**启动指令** (新对话中复制使用):
```
你是 Cortex-Local 项目的 FullStack Lead。

任务: 实现 Next.js API 层

目标目录: c:\Users\sai\.gemini\antigravity\playground\thermal-feynman\apps\web

执行以下步骤:

1. 创建 POST /api/ingest (app/api/ingest/route.ts):
   - 接收 JSON: { content, source, context }
   - 调用 Ollama (qwen3:8b) 生成摘要和标签
   - 调用 Ollama (nomic-embed-text) 生成嵌入向量
   - 保存 Markdown 到 data/archives/
   - 保存元数据到 SQLite
   - 保存嵌入到 LanceDB
   - CORS: 允许 chrome-extension://*

2. 创建 GET /api/notes (app/api/notes/route.ts):
   - 从 SQLite 获取笔记列表
   - 支持分页 (?page=1&limit=20)
   - 支持标签过滤 (?tag=xxx)

3. 创建 POST /api/chat (app/api/chat/route.ts):
   - 接收 { query }
   - RAG: 向量搜索相似笔记 (Top 5)
   - 构建提示词，调用 Ollama
   - 流式返回回答

4. 创建 GET /api/health (app/api/health/route.ts):
   - 检查 Ollama 连接状态
   - 返回 { ollama: true/false }

使用 curl 测试每个 API 端点。完成后报告状态。
```

**验证标准**:
- 所有 API 返回正确响应
- Ollama 离线时 ingest 返回友好错误
- 数据成功持久化

---

## 🎨 Agent 4: UI Designer (界面设计师)

**职责**: FOLO 三栏布局 UI

**前置条件**: Agent 1 + Agent 3 完成

**启动指令** (新对话中复制使用):
```
你是 Cortex-Local 项目的 UI Designer。

任务: 实现 FOLO 三栏布局界面

目标目录: c:\Users\sai\.gemini\antigravity\playground\thermal-feynman\apps\web

执行以下步骤:

1. 安装 UI 依赖:
   - @radix-ui/react-scroll-area
   - react-markdown, remark-gfm
   - lucide-react (图标)

2. 创建布局组件:
   - components/Sidebar.tsx (左侧导航 + 分类)
   - components/NoteList.tsx (中间笔记列表)
   - components/NoteReader.tsx (右侧 Markdown 阅读器)
   - components/StatusBadge.tsx (AI 在线/离线状态)

3. 更新 app/page.tsx:
   - 三栏响应式布局 (sidebar 可折叠)
   - 从 /api/notes 获取列表
   - 点击笔记显示详情
   - 轮询 /api/health 更新状态徽章

4. 样式优化:
   - 深色模式支持
   - Tailwind 优雅设计
   - 动画过渡效果

完成后启动 dev server 并截图展示。
```

**验证标准**:
- 三栏布局正确显示
- 笔记列表可滚动
- Markdown 正确渲染
- 状态徽章实时更新

---

## 📋 执行顺序

```
┌─────────────────┐
│  Agent 1        │
│  Local Architect│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌───────┐
│Agent 2│ │Agent 3│  (可并行)
│Ext.   │ │API    │
└───┬───┘ └───┬───┘
    │         │
    └────┬────┘
         ▼
┌─────────────────┐
│  Agent 4        │
│  UI Designer    │
└─────────────────┘
```

---

## 使用说明

1. 打开 **新对话**
2. 复制对应 Agent 的 **启动指令**
3. 粘贴发送，让 AI 执行
4. 完成后回到此工作流，继续下一个 Agent
5. 每个 Agent 在独立上下文中运行，避免 token 溢出

// turbo-all
