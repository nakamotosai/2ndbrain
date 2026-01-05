'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Sparkles } from 'lucide-react';
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
}

interface Collection {
  id: number;
  name: string;
  count: number;
}

interface FilterState {
  type: 'all' | 'tag' | 'source' | 'collection';
  value?: string | number;
}

import { SettingsModal } from './components/SettingsModal';

export default function Home() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filter, setFilter] = useState<FilterState>({ type: 'all' });
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [isAiOnline, setIsAiOnline] = useState(true);
  const [loading, setLoading] = useState(true);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'collections' | 'tags' | 'trash'>('trash');

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
  const handleFilterSelect = (type: 'all' | 'tag' | 'source' | 'collection', value?: string | number) => {
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
    try {
      const res = await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotes(prev => prev.filter(n => n.id !== id));
        if (selectedNoteId === id) setSelectedNoteId(null);
      }
    } catch (e) { console.error(e); }
  };

  const handleMoveNote = async (id: number, direction: 'up' | 'down') => {
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
    return '全部笔记';
  };

  const handleOpenSettings = (tab: 'general' | 'collections' | 'tags' | 'trash' = 'general') => {
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

  // Polling for auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotes(true);
      fetchCollections();
    }, 3000);
    return () => clearInterval(interval);
  }, [filter, fetchNotes]);

  return (
    <main className="h-screen flex bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar - 左侧导航 */}
      <Sidebar
        tags={tags}
        collections={collections}
        currentFilter={filter}
        onFilterSelect={handleFilterSelect}
        onCreateCollection={handleCreateCollection}
        isAiOnline={isAiOnline}
        onOpenSettings={handleOpenSettings}
      />

      {/* Note List - 中间列表 */}
      <div className="w-80 h-full border-r border-gray-800 flex flex-col bg-gray-900/30">
        <header className="p-4 border-b border-gray-800 flex justify-between items-center">
          <div>
            <h2 className="font-semibold text-gray-200">
              {getHeaderTitle()}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {notes.length} 条笔记
            </p>
          </div>
          {filter.type === 'source' && isAiOnline && (
            <button
              onClick={handleAutoOrganize}
              className="flex items-center gap-1 text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1.5 rounded hover:bg-indigo-500/20 transition-colors"
              title="使用 AI 自动分类整理"
            >
              <Sparkles size={14} />
              <span>自动整理</span>
            </button>
          )}
        </header>
        <NoteList
          notes={notes}
          selectedNoteId={selectedNoteId}
          onNoteSelect={handleNoteSelect}
          loading={loading}
          onDeleteNote={handleDeleteNote}
          onMoveNote={handleMoveNote}
          onAddToCollection={(id) => {
            handleNoteSelect(notes.find(n => n.id === id)!);
          }}
        />
      </div>

      {/* Note Reader - 右侧阅读器 */}
      <NoteReader
        noteId={selectedNoteId}
        collections={collections}
        onAddToCollection={handleAddToCollection}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeTab={settingsTab}
      />
    </main>
  );

}
