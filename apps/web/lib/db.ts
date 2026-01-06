import type { D1Database } from '@cloudflare/workers-types';

// ==================== Schema & Initialization ====================
// Note: In D1, schema migration is usually done via 'wrangler d1 migrations'
// heavily recommended over runtime 'CREATE TABLE IF NOT EXISTS'.
// However, for this migration, we'll keep the SQL commands for reference 
// or for a simple 'init' endpoint if needed.

export async function initTables(db: D1Database) {
  // 笔记表
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      summary TEXT,
      content TEXT, -- Storing markdown content directly
      source_url TEXT,
      source_type TEXT DEFAULT 'manual',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ai_status TEXT DEFAULT 'pending',
      sort_order INTEGER DEFAULT 0,
      is_archived BOOLEAN DEFAULT 0,
      is_deleted BOOLEAN DEFAULT 0
    )
  `).run();

  // 标签表
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1'
    )
  `).run();

  // 笔记-标签关联表
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS note_tags (
      note_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, tag_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `).run();

  // 来源表 (搜索上下文)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      note_id INTEGER NOT NULL,
      title TEXT,
      url TEXT,
      snippet TEXT,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `).run();

  // 收藏集表
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 笔记-收藏集关联表
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS note_collections (
      note_id INTEGER NOT NULL,
      collection_id INTEGER NOT NULL,
      PRIMARY KEY (note_id, collection_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
    )
  `).run();
}

// ==================== Types ====================

export interface Note {
  id?: number;
  title: string;
  summary?: string;
  content?: string; // New field replacing content_path
  source_url?: string;
  source_type?: string;
  created_at?: string;
  updated_at?: string;
  ai_status?: 'pending' | 'completed' | 'failed' | 'cancelled';
  sort_order?: number;
  is_archived?: boolean | number;
  is_deleted?: boolean | number;
}

export interface Tag {
  id?: number;
  name: string;
  color?: string;
}

export interface Collection {
  id: number;
  name: string;
  description?: string;
  count?: number;
}

// ==================== CRUD Operations ====================

// 创建笔记
export async function createNote(db: D1Database, note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  const { title, summary, content, source_url, source_type, ai_status } = note;

  // 1. Insert Note
  const result = await db.prepare(`
    INSERT INTO notes (title, summary, content, source_url, source_type, ai_status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(title, summary, content || '', source_url, source_type, ai_status || 'pending').run();

  // 2. Get inserted ID (D1 implementation might vary, ensuring we get the ID)
  // 'result.meta.last_row_id' is typical for D1
  const rowId = result.meta.last_row_id;

  if (!rowId) throw new Error("Failed to create note");

  // 3. Set sort_order (simulating the max_order logic)
  const maxOrderResult = await db.prepare('SELECT MAX(sort_order) as maxVal FROM notes').first<{ maxVal: number }>();
  const newOrder = (maxOrderResult?.maxVal || 0) + 1;

  await db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?').bind(newOrder, rowId).run();

  return rowId;
}

export async function deleteNote(db: D1Database, id: number, permanent = false): Promise<void> {
  if (permanent) {
    await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
  } else {
    // Soft delete
    await db.prepare('UPDATE notes SET is_deleted = 1, is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(id)
      .run();
  }
}

export async function restoreNote(db: D1Database, id: number): Promise<void> {
  await db.prepare('UPDATE notes SET is_deleted = 0, is_archived = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(id)
    .run();
}

export async function updateNote(db: D1Database, id: number, updates: Partial<Note>): Promise<void> {
  const keys = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
  if (keys.length === 0) return;

  const values: any[] = [];
  const setClauses = keys.map(k => {
    let val = (updates as any)[k];
    if (typeof val === 'boolean') val = val ? 1 : 0;
    values.push(val);
    return `${k} = ?`;
  });
  values.push(id); // for WHERE clause

  const sql = `UPDATE notes SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  await db.prepare(sql).bind(...values).run();
}

export async function updateNoteSortOrder(db: D1Database, updates: { id: number; sort_order: number }[]): Promise<void> {
  const stmt = db.prepare('UPDATE notes SET sort_order = ? WHERE id = ?');
  const batch = updates.map(u => stmt.bind(u.sort_order, u.id));
  await db.batch(batch);
}

// 获取所有笔记
export async function getNotes(db: D1Database, limit = 50, offset = 0): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT * FROM notes 
    WHERE is_deleted = 0 AND is_archived = 0
    ORDER BY sort_order DESC, created_at DESC 
    LIMIT ? OFFSET ?
  `).bind(limit, offset).all<Note>();
  return results;
}

export async function getArchivedNotes(db: D1Database): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT * FROM notes 
    WHERE is_archived = 1 AND is_deleted = 0
    ORDER BY updated_at DESC
  `).all<Note>();
  return results;
}

export async function emptyTrash(db: D1Database): Promise<void> {
  await db.prepare('DELETE FROM notes WHERE is_deleted = 1').run();
}

export async function getDeletedNotes(db: D1Database): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT * FROM notes 
    WHERE is_deleted = 1
    ORDER BY updated_at DESC
  `).all<Note>();
  return results;
}

export async function getNoteById(db: D1Database, id: number): Promise<Note | null> {
  return await db.prepare('SELECT * FROM notes WHERE id = ?').bind(id).first<Note>();
}

// 标签相关
export async function getNoteTags(db: D1Database, noteId: number): Promise<Tag[]> {
  const { results } = await db.prepare(`
    SELECT t.* FROM tags t
    JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
  `).bind(noteId).all<Tag>();
  return results;
}

export async function getOrCreateTag(db: D1Database, name: string): Promise<number> {
  const existing = await db.prepare('SELECT id FROM tags WHERE name = ?').bind(name).first<{ id: number }>();
  if (existing) return existing.id;

  const result = await db.prepare('INSERT INTO tags (name) VALUES (?)').bind(name).run();
  return result.meta.last_row_id as number;
}

export async function addTagToNote(db: D1Database, noteId: number, tagId: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)').bind(noteId, tagId).run();
}

export async function getAllTags(db: D1Database): Promise<Tag[]> {
  const { results } = await db.prepare('SELECT * FROM tags ORDER BY name').all<Tag>();
  return results;
}

export async function getNotesByTag(db: D1Database, tagName: string): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT n.* FROM notes n
    JOIN note_tags nt ON n.id = nt.note_id
    JOIN tags t ON nt.tag_id = t.id
    WHERE t.name = ? AND n.is_deleted = 0 AND n.is_archived = 0
    ORDER BY n.sort_order DESC, n.created_at DESC
  `).bind(tagName).all<Note>();
  return results;
}

// Source Context
export async function addSource(db: D1Database, noteId: number, source: { title?: string; url?: string; snippet?: string }): Promise<void> {
  await db.prepare('INSERT INTO sources (note_id, title, url, snippet) VALUES (?, ?, ?, ?)').bind(noteId, source.title, source.url, source.snippet).run();
}

// Collections
export async function createCollection(db: D1Database, name: string, description?: string): Promise<number> {
  const result = await db.prepare('INSERT INTO collections (name, description) VALUES (?, ?)').bind(name, description).run();
  return result.meta.last_row_id as number;
}

export async function getCollections(db: D1Database): Promise<Collection[]> {
  const { results } = await db.prepare(`
    SELECT c.*, COUNT(nc.note_id) as count 
    FROM collections c
    LEFT JOIN note_collections nc ON c.id = nc.collection_id
    GROUP BY c.id
    ORDER BY c.name
  `).all<Collection>();
  return results;
}

export async function deleteCollection(db: D1Database, id: number): Promise<void> {
  await db.prepare('DELETE FROM collections WHERE id = ?').bind(id).run();
}

export async function addNoteToCollection(db: D1Database, noteId: number, collectionId: number): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO note_collections (note_id, collection_id) VALUES (?, ?)').bind(noteId, collectionId).run();
}

export async function removeNoteFromCollection(db: D1Database, noteId: number, collectionId: number): Promise<void> {
  await db.prepare('DELETE FROM note_collections WHERE note_id = ? AND collection_id = ?').bind(noteId, collectionId).run();
}

export async function getNotesByCollection(db: D1Database, collectionId: number): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT n.* FROM notes n
    JOIN note_collections nc ON n.id = nc.note_id
    WHERE nc.collection_id = ? AND n.is_deleted = 0 AND n.is_archived = 0
    ORDER BY n.sort_order DESC, n.created_at DESC
  `).bind(collectionId).all<Note>();
  return results;
}

export async function getNoteCollections(db: D1Database, noteId: number): Promise<Collection[]> {
  const { results } = await db.prepare(`
    SELECT c.* FROM collections c
    JOIN note_collections nc ON c.id = nc.collection_id
    WHERE nc.note_id = ?
  `).bind(noteId).all<Collection>();
  return results;
}

export async function getNotesBySource(db: D1Database, sourceType: string): Promise<Note[]> {
  const { results } = await db.prepare(`
    SELECT * FROM notes 
    WHERE source_type LIKE ? AND is_deleted = 0 AND is_archived = 0
    ORDER BY sort_order DESC, created_at DESC
  `).bind(`%${sourceType}%`).all<Note>();
  return results;
}

export async function searchNotes(db: D1Database, query: string): Promise<Note[]> {
  const pattern = `%${query}%`;
  const { results } = await db.prepare(`
    SELECT * FROM notes 
    WHERE (title LIKE ? OR summary LIKE ?) AND is_deleted = 0
    ORDER BY created_at DESC
  `).bind(pattern, pattern).all<Note>();
  return results;
}
