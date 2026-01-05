'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, Trash2, RefreshCw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { NoteReader } from './components/NoteReader';

interface Tag {
  id: number;
  name: string;
  color?: string;
}

interface Note {
  id: number;
  title: string;
  summary?: string;
  source_type?: string;
  created_at?: string;
  tags: Tag[];
  sort_order?: number;
  is_deleted?: boolean;
  is_archived?: boolean;
}

interface Collection {
  id: number;
  name: string;
  count: number;
}

interface FilterState {
  type: 'all' | 'tag' | 'source' | 'collection' | 'archive' | 'trash';
  value?: string | number;
}

import { SettingsModal } from './components/SettingsModal';
import { SearchModal } from './components/SearchModal';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isAiOnline, setIsAiOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [fontStyle, setFontStyle] = useState<'sans' | 'serif'>('sans');

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'collections' | 'tags' | 'trash' | 'appearance'>('general');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 用于跟踪已知的最大ID，以便检测新笔记
  const lastKnownMaxIdRef = useRef<number>(0);

  // Data Fetching
  const fetchNotes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      let query = '';
      if (filter.type === 'tag') query = `?tag=${filter.value}`;
      else if (filter.type === 'source') query = `?source=${filter.value}`;
      else if (filter.type === 'collection') query = `?collectionId=${filter.value}`;
      else if (filter.type === 'archive') query = `?archived=true`;
      else if (filter.type === 'trash') query = `?trash=true`;

      const res = await fetch(`/api/notes${query}`);
      const data = await res.json();
      if (data.notes) {
        const fetchedNotes = data.notes as Note[];
        setNotes(fetchedNotes);

        // 检测是否有新笔记（ID更大的笔记）
        if (fetchedNotes.length > 0) {
          const currentMaxId = Math.max(...fetchedNotes.map(n => n.id));

          // 如果有新笔记（ID比之前的最大ID还大），自动选中它
          if (lastKnownMaxIdRef.current > 0 && currentMaxId > lastKnownMaxIdRef.current) {
            const newestNote = fetchedNotes.find(n => n.id === currentMaxId);
            if (newestNote) {
              console.log('检测到新笔记，自动选中:', newestNote.title);
              setSelectedNoteId(currentMaxId);
            }
          }

          lastKnownMaxIdRef.current = currentMaxId;
        }
      }
    } catch (error) {
      console.error('Failed to fetch notes:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filter]);

  const fetchTags = async () => {
    try {
      const res = await fetch('/api/notes?tags=true');
      const data = await res.json();
      if (data.tags) setTags(data.tags);
    } catch (e) { console.error(e); }
  };

  const fetchCollections = async () => {
    try {
      const res = await fetch('/api/collections');
      const data = await res.json();
      setCollections(data);
    } catch (e) { console.error(e); }
  };

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      setIsAiOnline(true);
    } catch (e) { setIsAiOnline(false); }
  };

  useEffect(() => {
    fetchNotes();
    fetchTags();
    fetchCollections();
    checkHealth();
  }, [filter, fetchNotes]);

  // Handlers
  const handleFilterSelect = (type: 'all' | 'tag' | 'source' | 'collection' | 'archive' | 'trash', value?: string | number) => {
    setFilter({ type, value });
    setSelectedNoteId(null);
    // 重置已知ID，避免切换过滤器时误判新笔记
    lastKnownMaxIdRef.current = 0;
  };

  const handleCreateCollection = async (name: string) => {
    try {
      await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      fetchCollections();
    } catch (e) { console.error(e); }
  };

  const handleNoteSelect = (note: Note) => {
    setSelectedNoteId(note.id);
  };

  const handleDeleteNote = async (id: number) => {
    // Determine if we are permanently deleting
    const isPermanent = filter.type === 'trash';

    if (isPermanent && !confirm('此操作无法撤销，确定永久删除吗？')) return;

    // Optimistic Update
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

    try {
      const query = isPermanent ? `?id=${id}&permanent=true` : `?id=${id}`;
      await fetch(`/api/notes${query}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      fetchNotes(true); // Revert/Refresh on error
    }
  };

  const handleEmptyTrash = async () => {
    if (!confirm('确定清空回收站吗？此操作无法撤销。')) return;
    setLoading(true);
    try {
      await fetch('/api/notes?action=emptyTrash', { method: 'DELETE' });
      await fetchNotes();
    } catch (e) {
      console.error(e);
      alert('清空失败');
    } finally {
      setLoading(false);
    }
  };

  const handleMoveNote = async (id: number, direction: 'up' | 'down') => {
    // ... (unchanged)
    // Optimistic update
    const index = notes.findIndex(n => n.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= notes.length) return;

    const newNotes = [...notes];
    const temp = newNotes[index];
    newNotes[index] = newNotes[targetIndex];
    newNotes[targetIndex] = temp;
    setNotes(newNotes);

    // Persist
    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newNotes[direction === 'up' ? targetIndex : index].id, sort_order: newNotes[direction === 'up' ? targetIndex : index].sort_order })
      });
    } catch (e) {
      console.error(e);
      fetchNotes(); // Revert on fail
    }
  };

  const handleArchiveNote = async (id: number) => {
    // Optimistic Update
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_archived: true })
      });
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

  const handleRestoreNote = async (id: number) => {
    // Optimistic Update
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

    // If restore from trash, we might need a special patch or just is_deleted=0?
    // The backend PATCH currently handles 'restore: true' as specific logic for restoration?
    // Checking route.ts: if (body.restore) restoreNote(id);
    // restoreNote sets is_deleted=0.
    // What about archived notes?
    // handleRestoreNote used to send {is_archived: false}.
    // If the note is is_deleted, we should send {restore: true}.

    // We need to know if it is deleted or not.
    // If we are in 'trash' view, it is definitely deleted.

    try {
      if (filter.type === 'trash') {
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, restore: true })
        });
      } else {
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_archived: false })
        });
      }
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

  const handleAddToCollection = async (noteId: number, collectionId: number) => {
    try {
      const res = await fetch(`/api/collections/${collectionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId })
      });
      if (res.ok) {
        alert('已添加到收藏集');
      }
    } catch (e) { console.error(e); }
  };

  // ...

  // Inside render:
  // NoteList rendering needs to be passed in full
  /*
  <NoteList
    notes={notes}
    collections={collections}
    selectedNoteId={selectedNoteId}
    onNoteSelect={handleNoteSelect}
    loading={loading}
    onDeleteNote={handleDeleteNote}
    onArchiveNote={handleArchiveNote}
    onRestoreNote={handleRestoreNote}
    onAddToCollection={handleAddToCollection}
  />
  */

  const getHeaderTitle = () => {
    if (filter.type === 'tag') return `#${filter.value}`;
    if (filter.type === 'source') {
      if (filter.value === 'twitter') return '推文 (Twitter)';
      if (filter.value === 'youtube') return '视频 (Youtube)';
      if (filter.value === 'web') return '网页 (Web)';
      return filter.value;
    }
    if (filter.type === 'collection') {
      const col = collections.find(c => c.id === filter.value);
      return col ? `📁 ${col.name}` : '收藏集';
    }
    if (filter.type === 'archive') return '归档箱';
    if (filter.type === 'trash') return '回收站';
    return '全部笔记';
  };

  const handleOpenSettings = (tab: 'general' | 'collections' | 'tags' | 'trash' | 'appearance' = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const handleAutoOrganize = async () => {
    if (!filter.value || filter.type !== 'source') return;
    if (!confirm('确定要使用 AI 自动整理当前来源的笔记吗？这将创建新的收藏集。')) return;

    setLoading(true);
    try {
      const res = await fetch('/api/ai/organize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: filter.value })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`整理完成！创建/更新了 ${data.collections} 个收藏集。`);
        fetchCollections();
        fetchNotes();
      } else {
        alert('整理失败: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('请求失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReorder = async (newNotes: Note[]) => {
    // Optimistic update
    setNotes(newNotes);

    // Calculate new sort orders
    // The top item should have the highest sort_order.
    // We can just assign sort_order based on reverse index.
    // To preserve the spread, we might want to get max sort_order?
    // Simply: max - index works if we re-normalize.

    // Better strategy for "just works":
    // Assign sort_order = (TotalCount - index) * 1000 (spacing for future inserts?)
    // Or just simple decreasing integer.
    const updates = newNotes.map((note, index) => ({
      id: note.id,
      sort_order: (newNotes.length - index) // Top item has highest number
    }));

    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error('Failed to reorder:', e);
      // Revert is hard without keeping 'prev' state or just refetching.
      fetchNotes(true);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = () => setIsDragging(true);
  const handleDragEnd = () => setIsDragging(false);

  // Polling for auto-refresh
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (!isDragging) {
      interval = setInterval(() => {
        fetchNotes(true);
        fetchCollections();
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [filter, fetchNotes, isDragging]);

  // Shortcut for Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Add to Collection from Search
  const handleBatchAddToCollection = async (noteIds: number[]) => {
    const collectionName = prompt('添加到哪个收藏集？(输入名称，新建或现有)');
    if (!collectionName) return;

    // Find or create collection
    let targetCol = collections.find(c => c.name === collectionName);
    if (!targetCol) {
      if (confirm(`收藏集 "${collectionName}" 不存在，要创建吗？`)) {
        await handleCreateCollection(collectionName);
        // Refresh collections to get the new ID
        // Quick fetch to update local state
        const res = await fetch('/api/collections');
        const newCols = await res.json();
        setCollections(newCols); // Update state directly
        targetCol = newCols.find((c: any) => c.name === collectionName);
      } else {
        return;
      }
    }

    if (targetCol) {
      for (const id of noteIds) {
        await handleAddToCollection(id, targetCol.id);
      }
      alert('已添加');
      setIsSearchOpen(false);
    }
  };

  // Remove Note from Collection
  const handleRemoveFromCollection = async (noteId: number) => {
    if (filter.type !== 'collection' || !filter.value) return;
    const collectionId = Number(filter.value);

    // Optimistic Update
    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (selectedNoteId === noteId) setSelectedNoteId(null);

    try {
      await fetch(`/api/collections/${collectionId}/notes?noteId=${noteId}`, {
        method: 'DELETE'
      });
      fetchCollections(); // Update counts
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

  // Sync Font Style with Body
  useEffect(() => {
    document.body.setAttribute('data-font', fontStyle);
  }, [fontStyle]);

  return (
    <main className="h-screen flex bg-theme-primary text-theme-primary overflow-hidden transition-colors duration-300">
      {/* Sidebar - 左侧导航 */}
      <Sidebar
        tags={tags}
        collections={collections}
        currentFilter={filter}
        onFilterSelect={handleFilterSelect}
        onCreateCollection={handleCreateCollection}
        isAiOnline={isAiOnline}
        onOpenSettings={handleOpenSettings}
        onSearch={() => setIsSearchOpen(true)}
      />

      {/* Note List - 中间列表 */}
      <div className="w-80 h-full border-r border-theme flex flex-col bg-theme-secondary/30">
        <header className="p-4 border-b border-theme flex justify-between items-center shrink-0">
          <div>
            <h2 className="font-semibold text-theme-primary">
              {getHeaderTitle()}
            </h2>
            <p className="text-xs text-theme-secondary mt-1">
              {notes.length} 条笔记
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filter.type === 'trash' && (
              <button
                onClick={handleEmptyTrash}
                disabled={notes.length === 0}
                className="flex items-center gap-1 text-xs bg-red-500/10 text-red-500 px-2 py-1.5 rounded hover:bg-red-500/20 transition-colors disabled:opacity-50"
                title="清空回收站"
              >
                <Trash2 size={14} />
                <span>清空</span>
              </button>
            )}

            <button
              onClick={() => fetchNotes(false)}
              className="p-1 text-theme-secondary hover:text-theme-primary transition-colors"
              title="刷新"
            >
              <RefreshCw size={14} />
            </button>

            {filter.type === 'source' && isAiOnline && (
              <button
                onClick={handleAutoOrganize}
                className="flex items-center gap-1 text-xs bg-accent/10 text-accent px-2 py-1.5 rounded hover:bg-accent/20 transition-colors"
                title="使用 AI 自动分类整理"
              >
                <Sparkles size={14} />
                <span>自动整理</span>
              </button>
            )}
          </div>
        </header>
        <NoteList
          notes={notes}
          collections={collections}
          selectedNoteId={selectedNoteId}
          onNoteSelect={handleNoteSelect}
          loading={loading}
          isCollectionMode={filter.type === 'collection'}
          onDeleteNote={filter.type === 'collection' ? handleRemoveFromCollection : handleDeleteNote}
          onArchiveNote={filter.type === 'trash' ? undefined : handleArchiveNote}
          onRestoreNote={handleRestoreNote}
          onAddToCollection={handleAddToCollection}
          onReorder={handleReorder}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        />
      </div>

      {/* Note Reader - 右侧阅读器 */}
      <NoteReader
        noteId={selectedNoteId}
        collections={collections}
        onAddToCollection={handleAddToCollection}
        fontStyle={fontStyle}
        onToggleFont={setFontStyle}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTab={settingsTab}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onAddToCollection={handleBatchAddToCollection}
      />
    </main>
  );

}
