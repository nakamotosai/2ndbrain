import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 数据库文件路径
const DB_PATH = path.join(process.cwd(), 'data', 'db.sqlite');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// 创建数据库连接 (单例)
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initTables();
  }
  return db;
}

// 初始化表结构
function initTables() {
  const database = db!;

  // 笔记表
  database.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT,
      content_path TEXT NOT NULL,
      source_url TEXT,
      source_type TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ai_status TEXT DEFAULT 'pending',
      sort_order INTEGER DEFAULT 0,
      is_deleted BOOLEAN DEFAULT 0
    )
  `);

  // Migration: Ensure ai_status and sort_order column exists
  try {
    const tableInfo = database.prepare("PRAGMA table_info(notes)").all() as any[];
    const hasAiStatus = tableInfo.some(col => col.name === 'ai_status');
    if (!hasAiStatus) {
      database.exec("ALTER TABLE notes ADD COLUMN ai_status TEXT DEFAULT 'pending'");
    }
    const hasSortOrder = tableInfo.some(col => col.name === 'sort_order');
    if (!hasSortOrder) {
      database.exec("ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0");
      // Initialize sort_order with id (simple default)
      database.exec("UPDATE notes SET sort_order = id WHERE sort_order = 0");
    }
    const hasIsDeleted = tableInfo.some(col => col.name === 'is_deleted');
    if (!hasIsDeleted) {
      database.exec("ALTER TABLE notes ADD COLUMN is_deleted BOOLEAN DEFAULT 0");
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // 标签表
  database.exec(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1'
    )
  `);

  // 笔记-标签关联表
  database.exec(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  // 来源表 (搜索上下文)
  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      title TEXT,
      url TEXT,
      snippet TEXT,
      snippet TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `);

  // 收藏集表 (Collections - Scheme C)
  database.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 笔记-收藏集关联表
  database.exec(`
    CREATE TABLE IF NOT EXISTS note_collections (
      note_id INTEGER NOT NULL,
      collection_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, collection_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `);
}

// ==================== CRUD 操作 ====================

export interface Note {
  id?: number;
  title: string;
  summary?: string;
  content_path: string;
  source_url?: string;
  source_type?: string;
  created_at?: string;
  updated_at?: string;
  ai_status?: 'pending' | 'completed' | 'failed';
  sort_order?: number;
  is_deleted?: boolean;
}

export interface Tag {
  id?: number;
  name: string;
  color?: string;
}

// 创建笔记
export function createNote(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO notes (title, summary, content_path, source_url, source_type, ai_status)
    VALUES (@title, @summary, @content_path, @source_url, @source_type, @ai_status)
  `);
  const result = stmt.run({ ...note, ai_status: note.ai_status || 'pending' });
  // Set initial sort order to equal the ID (puts new items at bottom by default if ASC, or top if DESC logic used)
  // Let's assume larger sort_order = top. So we might want to find max sort_order + 1.
  // For simplicity, let's just update it to match ID after insert, effectively 'chronological' by default.
  // Or better, let's fetch max sort_order.
  const rowId = result.lastInsertRowid as number;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as maxVal FROM notes').get() as { maxVal: number };
  const newOrder = (maxOrder?.maxVal || 0) + 1;
  db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?').run(newOrder, rowId);

  return rowId;
}

export function deleteNote(id: number, permanent = false): void {
  const db = getDb();
  if (permanent) {
    db.prepare('DELETE FROM notes WHERE id = ?').run(id);
  } else {
    db.prepare('UPDATE notes SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }
}

export function restoreNote(id: number): void {
  const db = getDb();
  db.prepare('UPDATE notes SET is_deleted = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
}

export function updateNote(id: number, updates: Partial<Note>): void {
  const db = getDb();
  const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (keys.length === 0) return;

  const setClause = keys.map(k => `${k} = @${k}`).join(', ');
  const stmt = db.prepare(`UPDATE notes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
  stmt.run({ ...updates, id });
}

// 获取所有笔记 - Modified to sort by custom order (DESC) then created_at
export function getNotes(limit = 50, offset = 0): Note[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM notes 
    WHERE is_deleted = 0
    ORDER BY sort_order DESC, created_at DESC 
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as Note[];
}

export function getDeletedNotes(): Note[] {
  const db = getDb();
  const stmt = db.prepare(`
      SELECT * FROM notes 
      WHERE is_deleted = 1
      ORDER BY updated_at DESC
    `);
  return stmt.all() as Note[];
}

// 根据ID获取笔记
export function getNoteById(id: number): Note | undefined {
  const db = getDb();
  // Allow getting deleted notes as well if needed, or filter? 
  // Usually we still want to view it if we have the ID (e.g. from Trash)
  const stmt = db.prepare('SELECT * FROM notes WHERE id = ?');
  return stmt.get(id) as Note | undefined;
}

// 获取笔记的标签
export function getNoteTags(noteId: number): Tag[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT t.* FROM tags t
    JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
  `);
  return stmt.all(noteId) as Tag[];
}

// 创建或获取标签
export function getOrCreateTag(name: string): number {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined;
  if (existing) return existing.id;

  const stmt = db.prepare('INSERT INTO tags (name) VALUES (?)');
  const result = stmt.run(name);
  return result.lastInsertRowid as number;
}

// 关联笔记和标签
export function addTagToNote(noteId: number, tagId: number): void {
  const db = getDb();
  const stmt = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');
  stmt.run(noteId, tagId);
}

// 获取所有标签
export function getAllTags(): Tag[] {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tags ORDER BY name');
  return stmt.all() as Tag[];
}

// 根据标签过滤笔记 - Sync with sort order
export function getNotesByTag(tagName: string): Note[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT n.* FROM notes n
    JOIN note_tags nt ON n.id = nt.note_id
    JOIN tags t ON nt.tag_id = t.id
    WHERE t.name = ? AND n.is_deleted = 0
    ORDER BY n.sort_order DESC, n.created_at DESC
  `);
  return stmt.all(tagName) as Note[];
}

// 保存搜索上下文来源
export function addSource(noteId: number, source: { title?: string; url?: string; snippet?: string }): void {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO sources (note_id, title, url, snippet) VALUES (?, ?, ?, ?)');
  stmt.run(noteId, source.title, source.url, source.snippet);
}

// ==================== Collections Operations ====================

export interface Collection {
  id: number;
  name: string;
  description?: string;
  count?: number; // computed
}

export function createCollection(name: string, description?: string): number {
  const db = getDb();
  const stmt = db.prepare('INSERT INTO collections (name, description) VALUES (?, ?)');
  const result = stmt.run(name, description);
  return result.lastInsertRowid as number;
}

export function getCollections(): Collection[] {
  const db = getDb();
  // Get collections with note count
  const stmt = db.prepare(`
    SELECT c.*, COUNT(nc.note_id) as count 
    FROM collections c
    LEFT JOIN note_collections nc ON c.id = nc.collection_id
    GROUP BY c.id
    ORDER BY c.name
  `);
  return stmt.all() as Collection[];
}

export function deleteCollection(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM collections WHERE id = ?').run(id);
}

export function addNoteToCollection(noteId: number, collectionId: number): void {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO note_collections (note_id, collection_id) VALUES (?, ?)').run(noteId, collectionId);
}

export function removeNoteFromCollection(noteId: number, collectionId: number): void {
  const db = getDb();
  db.prepare('DELETE FROM note_collections WHERE note_id = ? AND collection_id = ?').run(noteId, collectionId);
}

export function getNotesByCollection(collectionId: number): Note[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT n.* FROM notes n
    JOIN note_collections nc ON n.id = nc.note_id
    WHERE nc.collection_id = ? AND n.is_deleted = 0
    ORDER BY n.sort_order DESC, n.created_at DESC
  `);
  return stmt.all(collectionId) as Note[];
}

export function getNotesBySource(sourceType: string): Note[] {
  const db = getDb();
  // Simple partial match or exact match. stored types: 'twitter', 'youtube', 'web'
  // extension sends 'twitter'. ingest defaults to 'extension'.
  // Let's normalize.
  const stmt = db.prepare(`
      SELECT * FROM notes 
      WHERE source_type LIKE ? AND is_deleted = 0
      ORDER BY sort_order DESC, created_at DESC
    `);
  return stmt.all(`%${sourceType}%`) as Note[];
}
