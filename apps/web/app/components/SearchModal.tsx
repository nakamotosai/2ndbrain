'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Search, FileDown, FolderPlus, Loader2, CheckSquare, Square } from 'lucide-react';
// Local Interface Definition
interface Note {
    id: number;
    title: string;
    summary?: string;
    source_type?: string;
    created_at?: string;
    ai_status?: string;
}

interface SearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddToCollection: (noteIds: number[]) => void;
}

export function SearchModal({ isOpen, onClose, onAddToCollection }: SearchModalProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Note[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [exporting, setExporting] = useState(false);
    const [includeAI, setIncludeAI] = useState(true);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setQuery('');
            setResults([]);
            setSelectedIds(new Set());
        }
    }, [isOpen]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query.trim()) {
                performSearch(query);
            } else {
                setResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [query]);

    const performSearch = async (q: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setResults(data.notes || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: number) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === results.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(results.map(n => n.id)));
        }
    };

    const handleExport = async (mode: 'single' | 'multiple') => {
        if (selectedIds.size === 0) return;
        setExporting(true);

        try {
            // Need to fetch full details including content for selected notes
            // Current list might not have full content if API didn't return it
            // Typically List API returns summary, but Details API returns content.
            // Let's assume we need to fetch details or we update Search API to return content.
            // Search API usually returns lighter objects.
            // Better to fetch details one by one or batch.

            // For now, let's fetch details for each selected note
            const notesToExport = [];
            for (const id of Array.from(selectedIds)) {
                const res = await fetch(`/api/notes?id=${id}`);
                const note = await res.json();
                notesToExport.push(note);
            }

            if (mode === 'single') {
                const content = notesToExport.map(n => {
                    let text = `# ${n.title}\n\n`;
                    text += `> Created: ${new Date(n.created_at).toLocaleString()}\n`;
                    text += `> Source: ${n.source_url || 'Local'}\n\n`;
                    text += `${n.content}\n\n`;
                    if (includeAI && n.summary) {
                        text += `--- \n\n## AI Analysis\n\n${n.summary}\n\n`;
                    }
                    text += `---\n\n`;
                    return text;
                }).join('');

                const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
                const { saveAs } = await import('file-saver');
                saveAs(blob, `export_merged_${new Date().toISOString().slice(0, 10)}.md`);
            } else {
                const JSZip = (await import('jszip')).default;
                const zip = new JSZip();

                notesToExport.forEach(n => {
                    let text = `# ${n.title}\n\n`;
                    text += `${n.content}\n\n`;
                    if (includeAI && n.summary) {
                        text += `--- \n\n## AI Analysis\n\n${n.summary}\n\n`;
                    }
                    // Clean filename
                    const filename = (n.title.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').slice(0, 50)) + '.md';
                    zip.file(filename, text);
                });

                const content = await zip.generateAsync({ type: 'blob' });
                const { saveAs } = await import('file-saver');
                saveAs(content, `export_batch_${new Date().toISOString().slice(0, 10)}.zip`);
            }
        } catch (e) {
            console.error(e);
            alert('Export failed');
        } finally {
            setExporting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-theme-primary rounded-xl shadow-2xl border border-theme flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="p-4 border-b border-theme flex items-center gap-3">
                    <Search className="text-theme-secondary" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="搜索笔记标题、内容或 AI 解读..."
                        className="flex-1 bg-transparent border-none outline-none text-lg text-theme-primary placeholder:text-theme-secondary/50"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                    <button onClick={onClose} className="p-1 hover:bg-theme-secondary rounded-full text-theme-secondary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Results List */}
                <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
                    {loading ? (
                        <div className="flex items-center justify-center h-full text-theme-secondary">
                            <Loader2 className="animate-spin mr-2" /> 搜索中...
                        </div>
                    ) : results.length > 0 ? (
                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-3 py-2 text-xs text-theme-secondary">
                                <span>找到 {results.length} 条结果</span>
                                <button onClick={toggleSelectAll} className="hover:text-accent">
                                    {selectedIds.size === results.length ? '取消全选' : '全选'}
                                </button>
                            </div>
                            {results.map((note) => (
                                <div
                                    key={note.id}
                                    className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors ${selectedIds.has(note.id) ? 'bg-accent/10 border border-accent/20' : 'hover:bg-theme-secondary/30 border border-transparent'
                                        }`}
                                    onClick={() => toggleSelect(note.id)}
                                >
                                    <div className={`mt-1 text-accent ${selectedIds.has(note.id) ? 'opacity-100' : 'opacity-30'}`}>
                                        {selectedIds.has(note.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-medium text-theme-primary mb-1">{note.title}</h4>
                                        <p className="text-xs text-theme-secondary line-clamp-2">{note.summary || '无摘要'}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : query ? (
                        <div className="flex flex-col items-center justify-center h-full text-theme-secondary opacity-50">
                            <Search size={48} className="mb-2" />
                            <p>未找到相关笔记</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-theme-secondary opacity-50">
                            <p>输入关键词开始搜索</p>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-theme bg-theme-secondary/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 text-sm text-theme-primary cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={includeAI}
                                onChange={(e) => setIncludeAI(e.target.checked)}
                                className="rounded border-theme text-accent focus:ring-accent"
                            />
                            <span>包含 AI 解读</span>
                        </label>
                        <span className="text-xs text-theme-secondary">已选 {selectedIds.size} 项</span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onAddToCollection(Array.from(selectedIds))}
                            disabled={selectedIds.size === 0}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-theme-secondary hover:bg-theme-tertiary text-theme-primary disabled:opacity-50 transition-colors"
                        >
                            <FolderPlus size={16} />
                            <span>加入收藏</span>
                        </button>
                        <div className="h-6 w-px bg-theme-tertiary mx-1"></div>
                        <button
                            onClick={() => handleExport('single')}
                            disabled={selectedIds.size === 0 || exporting}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-theme-secondary hover:bg-theme-tertiary text-theme-primary disabled:opacity-50 transition-colors"
                        >
                            <FileDown size={16} />
                            <span>合并导出</span>
                        </button>
                        <button
                            onClick={() => handleExport('multiple')}
                            disabled={selectedIds.size === 0 || exporting}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm bg-accent hover:bg-accent-secondary text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                            <FileDown size={16} />
                            <span>批量导出 (ZIP)</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
