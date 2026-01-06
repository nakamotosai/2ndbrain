'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, Calendar, Check, Download, BookOpen } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface Tag {
    id: number;
    name: string;
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
    tags: Tag[];
    collections: Collection[];
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
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [note, setNote] = useState<NoteDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showCollectionMenu, setShowCollectionMenu] = useState(false);
    const [processingCollection, setProcessingCollection] = useState(false);
    const [cancellingAI, setCancellingAI] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowCollectionMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!noteId) { setNote(null); return; }
        let isMounted = true;

        async function fetchNote(isBackground = false) {
            if (!isBackground) setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/notes?id=${noteId}`);
                if (!res.ok) throw new Error('Failed');
                const data = await res.json();
                if (isMounted) {
                    setNote(data);
                    if (data.ai_status === 'pending') setTimeout(() => fetchNote(true), 2000);
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

    const handleToggleCollection = async (collectionId: number) => {
        if (!note || processingCollection) return;
        const isIn = note.collections?.some(c => c.id === collectionId);
        setProcessingCollection(true);
        try {
            if (isIn) {
                const res = await fetch(`/api/collections/${collectionId}/notes?noteId=${note.id}`, { method: 'DELETE' });
                if (res.ok) setNote(prev => prev ? { ...prev, collections: prev.collections.filter(c => c.id !== collectionId) } : null);
            } else {
                const res = await fetch(`/api/collections/${collectionId}/notes`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId: note.id })
                });
                if (res.ok) {
                    const colName = collections?.find(c => c.id === collectionId)?.name || 'New';
                    setNote(prev => prev ? { ...prev, collections: [...(prev.collections || []), { id: collectionId, name: colName }] } : null);
                    onAddToCollection?.(note.id, collectionId);
                }
            }
        } catch (e) { console.error(e); }
        finally { setProcessingCollection(false); }
    };

    const handleCancelAI = async () => {
        if (!note || cancellingAI) return;
        setCancellingAI(true);
        try {
            const res = await fetch('/api/ai/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId: note.id }) });
            if (res.ok) setNote(prev => prev ? { ...prev, ai_status: 'cancelled' } : null);
        } catch (e) { console.error(e); }
        finally { setCancellingAI(false); }
    };

    const handleExportMD = () => {
        if (!note) return;
        const md = `# ${note.title}\n\n## 原文\n${note.content || '无'}\n\n---\n\n## AI解读\n${note.summary || '暂无'}\n\n---\n*来源: ${note.source_url || '未知'}*\n*时间: ${note.created_at ? new Date(note.created_at).toLocaleString('zh-CN') : '未知'}*`;
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.slice(0, 50).replace(/[/\\?%*:|"<>]/g, '-')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // 颜色变量
    const colors = {
        bg: isDark ? 'bg-black' : 'bg-[#FAF8F5]',
        headerBg: isDark ? 'bg-black/40 backdrop-blur-xl' : 'bg-[#FAF8F5] border-b border-[#EBE7E0]/50',
        text: isDark ? 'text-white/85' : 'text-[#2D2A26]',
        textSec: isDark ? 'text-white/50' : 'text-[#6B6560]',
        textMuted: isDark ? 'text-white/30' : 'text-[#9A9590]',
        accent: isDark ? 'text-[#F472B6]' : 'text-[#C4956A]',
        accentBg: isDark ? 'bg-[#F472B6]' : 'bg-[#C4956A]',
        tagBg: isDark ? 'bg-white/[0.06]' : 'bg-[#EBE7E0]',
        aiSection: isDark ? 'bg-gradient-to-br from-[rgba(244,114,182,0.03)] to-transparent' : 'bg-gradient-to-br from-[#FFFDF8] to-[#FAF8F5]',
        divider: isDark ? 'bg-gradient-to-b from-transparent via-white/[0.06] to-transparent' : 'bg-[#EBE7E0]',
        cardBg: isDark ? 'bg-white/[0.02]' : 'bg-white shadow-sm',
    };

    if (!noteId) {
        return (
            <div className={`flex-1 flex flex-col items-center justify-center ${colors.textMuted}`}>
                <BookOpen size={48} className="mb-3 opacity-40" />
                <p className="text-sm">选择一条笔记开始阅读</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className={`animate-spin rounded-full h-6 w-6 border-2 border-t-transparent ${isDark ? 'border-[#F472B6]' : 'border-[#C4956A]'}`} />
            </div>
        );
    }

    if (error || !note) {
        return <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>加载失败</div>;
    }

    return (
        <div className={`flex-1 flex flex-col overflow-hidden ${colors.bg} transition-colors duration-300`}>
            {/* Header - 极简 */}
            <header className={`reader-header p-4 shrink-0 z-10 sticky top-0 ${colors.headerBg}`}>
                <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className={`text-lg font-semibold mb-2 line-clamp-2 leading-relaxed ${colors.text}`}>{note.title}</h1>
                        <div className={`flex flex-wrap items-center gap-3 text-[11px] ${colors.textMuted}`}>
                            {onToggleFont && (
                                <div className={`flex items-center gap-0.5 rounded p-0.5 ${isDark ? 'bg-white/[0.05]' : 'bg-[#EBE7E0]'}`}>
                                    <button onClick={() => onToggleFont('sans')}
                                        className={`px-2 py-0.5 rounded transition-colors ${fontStyle === 'sans' ? `${colors.accentBg} text-white` : `hover:${colors.accent}`}`}>
                                        黑
                                    </button>
                                    <button onClick={() => onToggleFont('serif')}
                                        className={`px-2 py-0.5 rounded font-serif transition-colors ${fontStyle === 'serif' ? `${colors.accentBg} text-white` : `hover:${colors.accent}`}`}>
                                        宋
                                    </button>
                                </div>
                            )}
                            {note.created_at && (
                                <span className="flex items-center gap-1">
                                    <Calendar size={11} />
                                    {new Date(note.created_at).toLocaleDateString('zh-CN')}
                                </span>
                            )}
                            {note.source_url && (
                                <a href={note.source_url} target="_blank" rel="noopener noreferrer"
                                    className={`flex items-center gap-1 ${colors.accent} hover:underline`}>
                                    <ExternalLink size={11} />
                                    <span>原文</span>
                                </a>
                            )}
                            <button onClick={handleExportMD}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${isDark ? 'bg-white/[0.05] hover:bg-[#F472B6]/20 hover:text-[#F472B6]' : 'bg-[#EBE7E0] hover:bg-[#C4956A]/20 hover:text-[#C4956A]'}`}>
                                <Download size={11} />
                                <span>MD</span>
                            </button>
                        </div>
                    </div>

                    {/* Tags & Collection */}
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-[35%] items-center">
                        <div className="relative" ref={menuRef}>
                            <button onClick={() => setShowCollectionMenu(!showCollectionMenu)}
                                className={`p-1.5 rounded-md text-sm flex items-center gap-1 transition-colors ${note.collections?.length ? `${colors.accent} ${isDark ? 'bg-[#F472B6]/10' : 'bg-[#C4956A]/10'}` : `${colors.textMuted} hover:${colors.textSec}`
                                    }`}>
                                <span className="text-base">{note.collections?.length ? '★' : '☆'}</span>
                            </button>

                            {showCollectionMenu && (
                                <div className={`absolute right-0 top-full mt-1 w-52 rounded-lg shadow-xl py-1 z-50 ${isDark ? 'bg-black/95 backdrop-blur-xl' : 'bg-white border border-[#EBE7E0]'}`}>
                                    <div className={`px-3 py-1.5 text-[10px] uppercase tracking-wider ${colors.textMuted}`}>管理收藏</div>
                                    <div className="max-h-52 overflow-y-auto">
                                        {collections?.length ? collections.map(col => {
                                            const isSelected = note.collections?.some(c => c.id === col.id);
                                            return (
                                                <button key={col.id} onClick={() => handleToggleCollection(col.id)} disabled={processingCollection}
                                                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${isDark ? 'text-white/70 hover:bg-[#F472B6]/20' : 'text-[#6B6560] hover:bg-[#F5F2ED]'}`}>
                                                    <span className="truncate">📁 {col.name}</span>
                                                    {isSelected && <Check size={12} className={colors.accent} />}
                                                </button>
                                            );
                                        }) : <div className={`px-3 py-2 text-xs ${colors.textMuted}`}>暂无收藏集</div>}
                                    </div>
                                </div>
                            )}
                        </div>

                        {note.tags.map((tag) => (
                            <span key={tag.id} className={`tag px-2 py-0.5 rounded-full text-[10px] font-medium ${colors.tagBg} ${colors.textSec}`}>
                                {tag.name}
                            </span>
                        ))}
                    </div>
                </div>
            </header>

            {/* Content - 双栏布局 */}
            <div className="flex-1 flex overflow-hidden">
                {/* 左侧：原文 */}
                <div className="w-1/2 flex flex-col min-w-[280px]">
                    <div className={`px-5 py-2 flex items-center gap-2 ${isDark ? 'bg-white/[0.02]' : 'bg-[#F5F2ED]/50'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-blue-400' : 'bg-[#7BA3C4]'}`}></span>
                        <span className={`text-[10px] font-medium uppercase tracking-wider ${colors.textMuted}`}>原文内容</span>
                    </div>
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        <article className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({ node, ...props }) => (
                                        <a {...props} target="_blank" rel="noopener noreferrer"
                                            className={`${colors.accent} hover:underline cursor-pointer`}
                                            onClick={(e) => { if (props.href) { e.preventDefault(); window.open(props.href, '_blank'); } }}
                                        />
                                    )
                                }}
                            >{note.content || '*无法加载原文内容*'}</ReactMarkdown>
                        </article>
                    </div>
                </div>

                {/* 分隔线 */}
                <div className={`w-px ${colors.divider}`}></div>

                {/* 右侧：AI解读 */}
                <div className={`ai-section w-1/2 flex flex-col min-w-[280px] ${colors.aiSection}`}>
                    <div className={`px-5 py-2 flex items-center justify-between ${isDark ? 'bg-[#F472B6]/[0.03]' : 'bg-[#C4956A]/[0.05]'}`}>
                        <div className="flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${note.ai_status === 'pending' ? 'bg-yellow-400 animate-pulse' :
                                    note.ai_status === 'cancelled' ? (isDark ? 'bg-white/30' : 'bg-[#9A9590]') :
                                        note.ai_status === 'failed' ? 'bg-red-400' : (isDark ? 'bg-[#F472B6]' : 'bg-[#C4956A]')
                                }`}></span>
                            <span className={`text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-[#F472B6]/70' : 'text-[#C4956A]/80'}`}>AI 深度解读</span>
                        </div>
                        {note.ai_status === 'pending' && (
                            <div className="flex items-center gap-2">
                                <span className={`text-[10px] animate-pulse ${isDark ? 'text-yellow-400/70' : 'text-yellow-600/70'}`}>分析中...</span>
                                <button onClick={handleCancelAI} disabled={cancellingAI}
                                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${isDark ? 'bg-white/[0.05] text-white/40 hover:text-red-400' : 'bg-[#EBE7E0] text-[#9A9590] hover:text-red-500'}`}>
                                    取消
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {note.ai_status === 'pending' ? (
                            <div className={`h-full flex flex-col items-center justify-center space-y-3 ${colors.textMuted}`}>
                                <div className="relative">
                                    <div className={`w-10 h-10 rounded-full border-2 border-t-transparent animate-spin ${isDark ? 'border-white/10 border-t-[#F472B6]' : 'border-[#EBE7E0] border-t-[#C4956A]'}`}></div>
                                    <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${colors.accent}`}>AI</div>
                                </div>
                                <p className={`text-xs ${colors.accent}`}>正在分析...</p>
                            </div>
                        ) : note.ai_status === 'cancelled' ? (
                            <div className={`h-full flex flex-col items-center justify-center space-y-2 ${colors.textMuted}`}>
                                <span className="text-3xl opacity-30">⏹️</span>
                                <p className="text-xs">已取消</p>
                            </div>
                        ) : note.ai_status === 'failed' ? (
                            <div className={`h-full flex flex-col items-center justify-center space-y-2 ${colors.textMuted}`}>
                                <span className="text-3xl opacity-30">⚠️</span>
                                <p className="text-xs text-red-400">分析失败</p>
                            </div>
                        ) : (
                            <div className={`rounded-lg p-5 ${colors.cardBg}`}>
                                <article className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}
                                        components={{
                                            a: ({ node, ...props }) => (
                                                <a {...props} target="_blank" rel="noopener noreferrer"
                                                    className={`${colors.accent} hover:underline cursor-pointer`}
                                                    onClick={(e) => { if (props.href) { e.preventDefault(); window.open(props.href, '_blank'); } }}
                                                />
                                            ),
                                            h1: ({ node, ...props }) => <h1 {...props} className={`text-base font-semibold pb-2 mb-3 ${colors.accent}`} />,
                                            h2: ({ node, ...props }) => (
                                                <h2 {...props} className={`text-sm font-semibold mt-5 mb-2 flex items-center gap-2 ${colors.text}`}>
                                                    <span className={`w-0.5 h-3.5 rounded-full ${colors.accentBg}`}></span>
                                                    {props.children}
                                                </h2>
                                            ),
                                            blockquote: ({ node, ...props }) => (
                                                <blockquote {...props} className={`border-l-3 pl-4 my-3 italic ${isDark ? 'border-[#F472B6]/40 text-white/50' : 'border-[#C4956A]/40 text-[#6B6560]'}`} />
                                            ),
                                        }}
                                    >{note.summary || '暂无解读'}</ReactMarkdown>
                                </article>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
