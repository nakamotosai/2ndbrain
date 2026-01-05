'use client';

import { FileText } from 'lucide-react';

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
}

interface NoteListProps {
    notes: Note[];
    selectedNoteId: number | null;
    onNoteSelect: (note: Note) => void;
    loading?: boolean;
    onDeleteNote?: (id: number) => void;
    onMoveNote?: (id: number, direction: 'up' | 'down') => void;
    onAddToCollection?: (noteId: number) => void;
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
}

export function NoteList({ notes, selectedNoteId, onNoteSelect, loading, onDeleteNote, onMoveNote, onAddToCollection }: NoteListProps) {
    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-500 border-t-transparent" />
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                <FileText size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">暂无笔记</p>
                <p className="text-sm mt-1">通过浏览器扩展添加你的第一条笔记</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto">
            {notes.map((note) => (
                <div
                    key={note.id}
                    className={`group relative w-full border-b border-gray-800 transition-colors ${selectedNoteId === note.id
                        ? 'bg-gray-800/80'
                        : 'hover:bg-gray-800/50'
                        }`}
                >
                    <button
                        onClick={() => onNoteSelect(note)}
                        className="w-full text-left p-3 pb-2"
                    >
                        {/* Title */}
                        <h3 className="font-medium text-gray-100 line-clamp-1 mb-1 pr-6 text-sm">
                            {note.title}
                        </h3>

                        {/* Summary */}
                        {note.summary && (
                            <p className="text-xs text-gray-400 line-clamp-2 mb-1">
                                {note.summary}
                            </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center justify-between mt-1">
                            {/* Tags */}
                            <div className="flex items-center gap-1 flex-wrap">
                                {note.tags.slice(0, 3).map((tag) => (
                                    <span
                                        key={tag.id}
                                        className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-700/50 text-gray-300"
                                        style={{ borderLeft: `2px solid ${tag.color || '#6366f1'}` }}
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </button>

                    {/* Action Buttons (Visible on Hover) */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900/80 rounded p-1">
                        <button
                            className="p-1 hover:text-indigo-400 text-gray-400"
                            title="收藏"
                            onClick={(e) => {
                                e.stopPropagation();
                                onAddToCollection && onAddToCollection(note.id);
                            }}
                        >
                            <span className="text-xs">⊕</span>
                        </button>
                        <button
                            className="p-1 hover:text-indigo-400 text-gray-400"
                            title="上移"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveNote && onMoveNote(note.id, 'up');
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                        </button>
                        <button
                            className="p-1 hover:text-indigo-400 text-gray-400"
                            title="下移"
                            onClick={(e) => {
                                e.stopPropagation();
                                onMoveNote && onMoveNote(note.id, 'down');
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                        </button>
                        <button
                            className="p-1 hover:text-red-400 text-gray-400 ml-1"
                            title="删除"
                            onClick={(e) => {
                                e.stopPropagation();
                                // Removed confirm()
                                onDeleteNote && onDeleteNote(note.id);
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                        </button>
                    </div>
                </div>
            ))}

        </div>
    );
}
