'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Calendar, Tag as TagIcon, Link as LinkIcon, FileText, X, Check } from 'lucide-react';

interface Tag {
    id: number;
    name: string;
    color?: string;
}

interface NoteDetail {
    id: number;
    title: string;
    summary?: string;
    content?: string;
    source_url?: string;
    source_type?: string;
    created_at?: string;
    updated_at?: string;
    tags: Tag[];
    ai_status?: 'pending' | 'completed' | 'failed' | 'cancelled';
}

interface NoteReaderProps {
    noteId: number | null;
    collections?: { id: number; name: string }[];
    onAddToCollection?: (noteId: number, collectionId: number) => void;
}

export function NoteReader({ noteId, collections, onAddToCollection }: NoteReaderProps) {
    const [note, setNote] = useState<NoteDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCollectionMenu, setShowCollectionMenu] = useState(false);
    const [addingToCollection, setAddingToCollection] = useState(false);
    const [collectionFeedback, setCollectionFeedback] = useState<'success' | 'error' | null>(null);
    const [cancellingAI, setCancellingAI] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowCollectionMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch Note Details
    useEffect(() => {
        if (!noteId) {
            setNote(null);
            return;
        }

        let isMounted = true;

        async function fetchNote(isBackground = false) {
            if (!isBackground) setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/notes?id=${noteId}`);
                if (!res.ok) throw new Error('Failed to fetch note');
                const data = await res.json();

                if (isMounted) {
                    setNote(data);

                    // Polling if pending
                    if (data.ai_status === 'pending') {
                        setTimeout(() => fetchNote(true), 2000);
                    }
                }
            } catch (err) {
                if (isMounted) setError(String(err));
            } finally {
                if (isMounted && !isBackground) setLoading(false);
            }
        }

        fetchNote();

        return () => { isMounted = false; };
    }, [noteId]);

    // 添加到收藏集
    const handleAddToCollection = async (collectionId: number) => {
        if (!note || addingToCollection) return;

        setAddingToCollection(true);
        try {
            const res = await fetch(`/api/collections/${collectionId}/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId: note.id })
            });

            if (res.ok) {
                setCollectionFeedback('success');
                onAddToCollection?.(note.id, collectionId);
            } else {
                setCollectionFeedback('error');
            }
        } catch (e) {
            console.error(e);
            setCollectionFeedback('error');
        } finally {
            setAddingToCollection(false);
            setShowCollectionMenu(false);
            // 清除反馈
            setTimeout(() => setCollectionFeedback(null), 2000);
        }
    };

    // 取消AI分析
    const handleCancelAI = async () => {
        if (!note || cancellingAI) return;

        setCancellingAI(true);
        try {
            const res = await fetch('/api/ai/cancel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ noteId: note.id })
            });

            if (res.ok) {
                setNote(prev => prev ? { ...prev, ai_status: 'cancelled' } : null);
            }
        } catch (e) {
            console.error('取消AI失败:', e);
        } finally {
            setCancellingAI(false);
        }
    };

    if (!noteId) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-gray-900/50">
                <div className="text-6xl mb-4 opacity-20">📚</div>
                <p className="text-lg">选择一条笔记开始阅读</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-gray-900/50">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (error || !note) {
        return (
            <div className="flex-1 flex items-center justify-center text-red-400 bg-gray-900/50">
                <p>加载失败: {error}</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-gray-900/50 overflow-hidden">
            {/* Header */}
            <header className="p-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-gray-100 mb-2 line-clamp-1">{note.title}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
                            {note.created_at && (
                                <div className="flex items-center gap-1">
                                    <Calendar size={12} />
                                    <span>{new Date(note.created_at).toLocaleString('zh-CN')}</span>
                                </div>
                            )}
                            {note.source_url && (
                                <a
                                    href={note.source_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    <ExternalLink size={12} />
                                    <span>原文链接</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Tags & Collection */}
                    <div className="flex flex-wrap gap-1 justify-end max-w-[30%] items-center">
                        {/* Collection Dropdown - 改用click触发 */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowCollectionMenu(!showCollectionMenu)}
                                className={`p-1.5 rounded text-sm flex items-center gap-1 transition-colors ${collectionFeedback === 'success'
                                        ? 'bg-green-500/20 text-green-400'
                                        : collectionFeedback === 'error'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'hover:bg-gray-800 text-gray-400 hover:text-indigo-400'
                                    }`}
                            >
                                {collectionFeedback === 'success' ? (
                                    <>
                                        <Check size={14} />
                                        <span>已收藏</span>
                                    </>
                                ) : collectionFeedback === 'error' ? (
                                    <>
                                        <X size={14} />
                                        <span>失败</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-base">⊕</span>
                                        <span>收藏</span>
                                    </>
                                )}
                            </button>

                            {showCollectionMenu && (
                                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 z-50">
                                    <div className="px-3 py-1 text-xs text-gray-500 uppercase font-medium">添加到收藏集</div>
                                    {collections && collections.length > 0 ? (
                                        collections.map(col => (
                                            <button
                                                key={col.id}
                                                onClick={() => handleAddToCollection(col.id)}
                                                disabled={addingToCollection}
                                                className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-indigo-500/20 hover:text-indigo-300 disabled:opacity-50"
                                            >
                                                📁 {col.name}
                                            </button>
                                        ))
                                    ) : (
                                        <div className="px-3 py-2 text-xs text-gray-500">暂无收藏集</div>
                                    )}
                                </div>
                            )}
                        </div>

                        {note.tags.map((tag) => (
                            <span
                                key={tag.id}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
                            >
                                #{tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            {/* Split Content Area */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Original Content */}
                <div className="w-1/2 border-r border-gray-800 flex flex-col min-w-[300px]">
                    <div className="p-3 bg-gray-800/30 border-b border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            原文内容
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-gray-900/30">
                        <article className="prose prose-invert prose-sm max-w-none prose-img:rounded-lg prose-headings:text-gray-200 prose-a:text-blue-400">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {note.content || '*无法加载原文内容*'}
                            </ReactMarkdown>
                        </article>
                    </div>
                </div>

                {/* Right: AI Analysis */}
                <div className="w-1/2 flex flex-col min-w-[300px] bg-gray-900/50">
                    <div className="p-3 bg-gray-800/30 border-b border-gray-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${note.ai_status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                                    note.ai_status === 'cancelled' ? 'bg-gray-500' :
                                        note.ai_status === 'failed' ? 'bg-red-500' :
                                            'bg-indigo-500'
                                }`}></span>
                            AI 深度解读
                        </span>
                        {note.ai_status === 'pending' && (
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-yellow-500 animate-pulse flex items-center gap-1">
                                    <span className="animate-spin text-sm">⟳</span> 分析中...
                                </span>
                                <button
                                    onClick={handleCancelAI}
                                    disabled={cancellingAI}
                                    className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                    {cancellingAI ? '取消中...' : '取消分析'}
                                </button>
                            </div>
                        )}
                        {note.ai_status === 'cancelled' && (
                            <span className="text-xs text-gray-500">已取消</span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {note.ai_status === 'pending' ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full border-4 border-gray-700 border-t-indigo-500 animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">AI</div>
                                </div>
                                <div className="text-center">
                                    <p className="text-indigo-400 font-medium">AI 导师正在深入研究...</p>
                                    <p className="text-xs text-gray-600 mt-2">实时搜索背景资料 • 分析行业趋势 • 生成深度报告</p>
                                </div>
                            </div>
                        ) : note.ai_status === 'cancelled' ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <div className="text-4xl opacity-50">⏹️</div>
                                <p className="text-gray-500">AI 分析已取消</p>
                            </div>
                        ) : note.ai_status === 'failed' ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
                                <div className="text-4xl opacity-50">⚠️</div>
                                <p className="text-red-400">AI 分析失败</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <article className="prose prose-invert prose-sm max-w-none prose-headings:text-indigo-300 prose-a:text-blue-400 prose-p:text-gray-300 prose-li:text-gray-300">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {note.summary || '暂无解读'}
                                    </ReactMarkdown>
                                </article>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
