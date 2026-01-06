'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles, Trash2, RefreshCw } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { NoteList } from './components/NoteList';
import { NoteReader } from './components/NoteReader';
import { useTheme } from './components/ThemeContext';

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
import { Dashboard } from './components/Dashboard';

export default function Home() {
  const { theme, mounted } = useTheme();
  const isDark = theme === 'dark';

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
  const [showDashboard, setShowDashboard] = useState(false);

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

        if (fetchedNotes.length > 0) {
          const currentMaxId = Math.max(...fetchedNotes.map(n => n.id));
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
    const isPermanent = filter.type === 'trash';
    if (isPermanent && !confirm('此操作无法撤销，确定永久删除吗？')) return;

    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

    try {
      const query = isPermanent ? `?id=${id}&permanent=true` : `?id=${id}`;
      await fetch(`/api/notes${query}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
      fetchNotes(true);
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

  const handleArchiveNote = async (id: number) => {
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
    setNotes(prev => prev.filter(n => n.id !== id));
    if (selectedNoteId === id) setSelectedNoteId(null);

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

  // 批量归档
  const handleBatchArchive = async (ids: number[]) => {
    if (ids.length === 0) return;
    if (!confirm(`确定归档 ${ids.length} 条笔记吗？`)) return;

    // Optimistic update
    setNotes(prev => prev.filter(n => !ids.includes(n.id)));
    if (selectedNoteId && ids.includes(selectedNoteId)) {
      setSelectedNoteId(null);
    }

    try {
      for (const id of ids) {
        await fetch('/api/notes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, is_archived: true })
        });
      }
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

  // 批量删除
  const handleBatchDelete = async (ids: number[]) => {
    if (ids.length === 0) return;
    const isPermanent = filter.type === 'trash';
    const message = isPermanent
      ? `确定永久删除 ${ids.length} 条笔记吗？此操作无法撤销。`
      : `确定将 ${ids.length} 条笔记移入回收站吗？`;
    if (!confirm(message)) return;

    // Optimistic update
    setNotes(prev => prev.filter(n => !ids.includes(n.id)));
    if (selectedNoteId && ids.includes(selectedNoteId)) {
      setSelectedNoteId(null);
    }

    try {
      for (const id of ids) {
        const query = isPermanent ? `?id=${id}&permanent=true` : `?id=${id}`;
        await fetch(`/api/notes${query}`, { method: 'DELETE' });
      }
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

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
    setNotes(newNotes);

    const updates = newNotes.map((note, index) => ({
      id: note.id,
      sort_order: (newNotes.length - index)
    }));

    try {
      await fetch('/api/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) {
      console.error('Failed to reorder:', e);
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

    let targetCol = collections.find(c => c.name === collectionName);
    if (!targetCol) {
      if (confirm(`收藏集 "${collectionName}" 不存在，要创建吗？`)) {
        await handleCreateCollection(collectionName);
        const res = await fetch('/api/collections');
        const newCols = await res.json();
        setCollections(newCols);
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

    setNotes(prev => prev.filter(n => n.id !== noteId));
    if (selectedNoteId === noteId) setSelectedNoteId(null);

    try {
      await fetch(`/api/collections/${collectionId}/notes?noteId=${noteId}`, {
        method: 'DELETE'
      });
      fetchCollections();
    } catch (e) {
      console.error(e);
      fetchNotes(true);
    }
  };

  // Sync Font Style with Body
  useEffect(() => {
    document.body.setAttribute('data-font', fontStyle);
  }, [fontStyle]);

  // 在主题未挂载时显示简单加载避免 hydration 错误
  if (!mounted) {
    return (
      <main className="h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent" />
      </main>
    );
  }

  return (
    <main className={`h-screen flex overflow-hidden transition-colors duration-300 ${isDark ? 'bg-black text-white' : 'bg-[#FAF8F5] text-[#2D2A26]'}`}>
      {/* Sidebar - 左侧导航 */}
      <Sidebar
        tags={tags}
        collections={collections}
        currentFilter={filter}
        onFilterSelect={(type, value) => {
          handleFilterSelect(type, value);
          setShowDashboard(false);
        }}
        onCreateCollection={handleCreateCollection}
        isAiOnline={isAiOnline}
        onOpenSettings={handleOpenSettings}
        onSearch={() => setIsSearchOpen(true)}
        onOpenDashboard={() => setShowDashboard(true)}
      />

      {/* Note List - 中间列表 */}
      <div className={`w-72 h-full flex flex-col ${isDark ? 'bg-black/40' : 'bg-[#FAF8F5]'}`}>
        <header className={`p-3 flex justify-between items-center shrink-0 ${isDark ? 'bg-black/20' : 'bg-[#F5F2ED]/80 border-b border-[#EBE7E0]/50'}`}>
          <div>
            <h2 className={`font-medium text-sm ${isDark ? 'text-white/80' : 'text-[#2D2A26]'}`}>
              {getHeaderTitle()}
            </h2>
            <p className={`text-[10px] mt-0.5 ${isDark ? 'text-white/30' : 'text-[#9A9590]'}`}>
              {notes.length} 条笔记
            </p>
          </div>
          <div className="flex items-center gap-1">
            {filter.type === 'trash' && (
              <button
                onClick={handleEmptyTrash}
                disabled={notes.length === 0}
                className="flex items-center gap-1 text-[10px] bg-red-500/10 text-red-400 px-2 py-1 rounded hover:bg-red-500/20 transition-colors disabled:opacity-30"
              >
                <Trash2 size={12} />
                <span>清空</span>
              </button>
            )}

            <button
              onClick={() => fetchNotes(false)}
              className={`p-1 transition-colors ${isDark ? 'text-white/30 hover:text-white/70' : 'text-[#9A9590] hover:text-[#6B6560]'}`}
              title="刷新"
            >
              <RefreshCw size={12} />
            </button>

            {filter.type === 'source' && isAiOnline && (
              <button
                onClick={handleAutoOrganize}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors ${isDark ? 'bg-[#F472B6]/10 text-[#F472B6] hover:bg-[#F472B6]/20' : 'bg-[#C4956A]/10 text-[#C4956A] hover:bg-[#C4956A]/20'}`}
              >
                <Sparkles size={12} />
                <span>整理</span>
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
          onBatchArchive={filter.type === 'trash' ? undefined : handleBatchArchive}
          onBatchDelete={handleBatchDelete}
        />
      </div>

      {/* Note Reader or Dashboard - 右侧区域 */}
      {showDashboard ? (
        <Dashboard onClose={() => setShowDashboard(false)} />
      ) : (
        <NoteReader
          noteId={selectedNoteId}
          collections={collections}
          onAddToCollection={handleAddToCollection}
          fontStyle={fontStyle}
          onToggleFont={setFontStyle}
        />
      )}

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
