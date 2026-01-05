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

interface Collection {
    id: number;
    name: string;
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
    collections: Collection[]; // Now included
    ai_status?: 'pending' | 'completed' | 'failed' | 'cancelled';
}

interface NoteReaderProps {
    noteId: number | null;
    collections?: { id: number; name: string }[];
    onAddToCollection?: (noteId: number, collectionId: number) => void;
    fontStyle?: 'sans' | 'serif';
    onToggleFont?: (style: 'sans' | 'serif') => void;
}

export function NoteReader({ noteId, collections, onAddToCollection, fontStyle = 'sans', onToggleFont }: NoteReaderProps) {
    const [note, setNote] = useState<NoteDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCollectionMenu, setShowCollectionMenu] = useState(false);
    const [processingCollection, setProcessingCollection] = useState(false);
    const [collectionFeedback, setCollectionFeedback] = useState<'success' | 'removed' | 'error' | null>(null);
    const [cancellingAI, setCancellingAI] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // ...

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

    // Toggle Collection
    const handleToggleCollection = async (collectionId: number) => {
        if (!note || processingCollection) return;
        const isInCollection = note.collections?.some(c => c.id === collectionId);

        setProcessingCollection(true);
        try {
            if (isInCollection) {
                // Remove
                const res = await fetch(`/api/collections/${collectionId}/notes?noteId=${note.id}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    // Optimistic update
                    setNote(prev => prev ? {
                        ...prev,
                        collections: prev.collections.filter(c => c.id !== collectionId)
                    } : null);
                    setCollectionFeedback('removed');
                } else {
                    throw new Error('Remove failed');
                }
            } else {
                // Add
                const res = await fetch(`/api/collections/${collectionId}/notes`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ noteId: note.id })
                });
                if (res.ok) {
                    // Optimistic update - need name
                    const colName = collections?.find(c => c.id === collectionId)?.name || 'New Collection';
                    setNote(prev => prev ? {
                        ...prev,
                        collections: [...(prev.collections || []), { id: collectionId, name: colName }]
                    } : null);
                    setCollectionFeedback('success');
                    onAddToCollection?.(note.id, collectionId); // Notify parent if needed
                } else {
                    throw new Error('Add failed');
                }
            }
        } catch (e) {
            console.error(e);
            setCollectionFeedback('error');
        } finally {
            setProcessingCollection(false);
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
        <div className="flex-1 flex flex-col bg-theme-primary/30 overflow-hidden transition-colors duration-300">
            {/* Header */}
            <header className="p-4 border-b border-theme bg-theme-primary/95 backdrop-blur shrink-0 z-10 sticky top-0">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-bold text-theme-primary mb-2 line-clamp-1 leading-normal">{note.title}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-theme-secondary">
                            {/* Font Switcher */}
                            {onToggleFont && (
                                <div className="flex items-center gap-1. bg-theme-secondary/20 rounded p-0.5">
                                    <button
                                        onClick={() => onToggleFont('sans')}
                                        className={`px-2 py-0.5 rounded transition-colors ${fontStyle === 'sans' ? 'bg-theme-tertiary text-accent font-bold' : 'text-theme-secondary hover:text-theme-primary'}`}
                                        title="黑体 (Sans-serif)"
                                    >
                                        A
                                    </button>
                                    <button
                                        onClick={() => onToggleFont('serif')}
                                        className={`px-2 py-0.5 rounded transition-colors font-serif ${fontStyle === 'serif' ? 'bg-theme-tertiary text-accent font-bold' : 'text-theme-secondary hover:text-theme-primary'}`}
                                        title="宋体/明体 (Serif)"
                                    >
                                        T
                                    </button>
                                </div>
                            )}
                            <span className="w-px h-3 bg-theme-secondary/30 mx-1"></span>

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
                                    className="flex items-center gap-1 text-accent hover:underline transition-colors"
                                >
                                    <ExternalLink size={12} />
                                    <span>原文链接</span>
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Tags & Collection */}
                    <div className="flex flex-wrap gap-1 justify-end max-w-[30%] items-center">
                        {/* Collection Dropdown */}
                        <div className="relative" ref={menuRef}>
                            <button
                                onClick={() => setShowCollectionMenu(!showCollectionMenu)}
                                className={`p-1.5 rounded-lg text-sm flex items-center gap-1 transition-colors ${(note.collections && note.collections.length > 0)
                                    ? 'text-accent bg-accent/10'
                                    : 'text-theme-secondary hover:text-theme-primary'
                                    }`}
                            >
                                <span className="text-base font-bold">
                                    {(note.collections && note.collections.length > 0) ? '★' : '☆'}
                                </span>
                                <span className="hidden sm:inline">
                                    {collectionFeedback === 'success' ? '已收藏' :
                                        collectionFeedback === 'removed' ? '已取消' : '收藏'}
                                </span>
                            </button>

                            {showCollectionMenu && (
                                <div className="absolute right-0 top-full mt-1 w-56 bg-theme-primary border border-theme rounded-lg shadow-xl py-1 z-50">
                                    <div className="px-3 py-2 text-xs text-theme-secondary font-medium border-b border-theme mb-1">
                                        管理收藏 (点击切换)
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {collections && collections.length > 0 ? (
                                            collections.map(col => {
                                                const isSelected = note.collections?.some(c => c.id === col.id);
                                                return (
                                                    <button
                                                        key={col.id}
                                                        onClick={() => handleToggleCollection(col.id)}
                                                        disabled={processingCollection}
                                                        className="w-full text-left px-3 py-2 text-sm text-theme-primary hover:bg-theme-secondary flex items-center justify-between group transition-colors"
                                                    >
                                                        <span className="truncate">📁 {col.name}</span>
                                                        {isSelected && (
                                                            <Check size={14} className="text-accent shrink-0" />
                                                        )}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-theme-secondary">暂无收藏集</div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {note.tags.map((tag) => (
                            <span
                                key={tag.id}
                                className="px-2 py-0.5 rounded text-xs font-medium bg-theme-tertiary text-theme-secondary border border-theme"
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
                <div className="w-1/2 border-r border-theme flex flex-col min-w-[300px]">
                    <div className="p-3 bg-theme-secondary/20 border-b border-theme flex items-center justify-between">
                        <span className="text-xs font-bold text-theme-secondary uppercase tracking-wider flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                            原文内容
                        </span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 bg-theme-primary/50">
                        <article className="prose prose-sm max-w-none">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({ node, ...props }) => (
                                        <a
                                            {...props}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-accent hover:underline cursor-pointer"
                                            onClick={(e) => {
                                                if (props.href) {
                                                    e.preventDefault();
                                                    window.open(props.href, '_blank');
                                                }
                                            }}
                                        />
                                    )
                                }}
                            >
                                {note.content || '*无法加载原文内容*'}
                            </ReactMarkdown>
                        </article>
                    </div>
                </div>

                {/* Right: AI Analysis */}
                <div className="w-1/2 flex flex-col min-w-[300px] bg-theme-secondary/10">
                    <div className="p-3 bg-theme-secondary/30 border-b border-theme flex items-center justify-between">
                        {/* ... (Header content unchanged) ... */}
                        <span className="text-xs font-bold text-accent uppercase tracking-wider flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${note.ai_status === 'pending' ? 'bg-yellow-500 animate-pulse' :
                                note.ai_status === 'cancelled' ? 'bg-gray-500' :
                                    note.ai_status === 'failed' ? 'bg-red-500' :
                                        'bg-accent'
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
                                    className="text-xs px-2 py-1 rounded bg-theme-tertiary hover:bg-red-500/20 text-theme-secondary hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                    {cancellingAI ? '取消中...' : '取消分析'}
                                </button>
                            </div>
                        )}
                        {note.ai_status === 'cancelled' && (
                            <span className="text-xs text-theme-secondary">已取消</span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        {note.ai_status === 'pending' ? (
                            <div className="h-full flex flex-col items-center justify-center text-theme-secondary space-y-4">
                                <div className="relative">
                                    <div className="w-12 h-12 rounded-full border-4 border-theme border-t-accent animate-spin"></div>
                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-accent">AI</div>
                                </div>
                                <div className="text-center">
                                    <p className="text-accent font-medium">AI 导师正在深入研究...</p>
                                    <p className="text-xs opacity-70 mt-2">实时搜索背景资料 • 分析行业趋势 • 生成深度报告</p>
                                </div>
                            </div>
                        ) : note.ai_status === 'cancelled' ? (
                            <div className="h-full flex flex-col items-center justify-center text-theme-secondary space-y-4">
                                <div className="text-4xl opacity-50">⏹️</div>
                                <p className="opacity-70">AI 分析已取消</p>
                            </div>
                        ) : note.ai_status === 'failed' ? (
                            <div className="h-full flex flex-col items-center justify-center text-theme-secondary space-y-4">
                                <div className="text-4xl opacity-50">⚠️</div>
                                <p className="text-red-400">AI 分析失败</p>
                            </div>
                        ) : (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <article className="prose prose-sm max-w-none">
                                    <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ node, ...props }) => (
                                                <a
                                                    {...props}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-accent hover:underline cursor-pointer"
                                                    onClick={(e) => {
                                                        if (props.href) {
                                                            e.preventDefault();
                                                            window.open(props.href, '_blank');
                                                        }
                                                    }}
                                                />
                                            )
                                        }}
                                    >
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
