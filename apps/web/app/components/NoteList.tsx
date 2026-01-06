'use client';

import { FileText, Archive as ArchiveIcon, RotateCcw, Trash2, FolderMinus, CheckSquare, Square, ArrowUpDown, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    TouchSensor,
    MouseSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Tag {
    id: number;
    name: string;
    color?: string;
}

interface Collection {
    id: number;
    name: string;
}

interface Note {
    id: number;
    title: string;
    summary?: string;
    source_type?: string;
    created_at?: string;
    tags: Tag[];
    is_archived?: boolean;
    is_deleted?: boolean;
}

interface NoteListProps {
    notes: Note[];
    collections?: Collection[];
    selectedNoteId: number | null;
    onNoteSelect: (note: Note) => void;
    loading?: boolean;
    isCollectionMode?: boolean;
    onDeleteNote?: (id: number) => void;
    onArchiveNote?: (id: number) => void;
    onRestoreNote?: (id: number) => void;
    onAddToCollection?: (noteId: number, collectionId: number) => void;
    onReorder?: (newNotes: Note[]) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
    onBatchArchive?: (ids: number[]) => void;
    onBatchDelete?: (ids: number[]) => void;
}

function formatTitle(title: string): string {
    return title.replace(/^.*?[:：]\s*一句话核心[:：]\s*/i, '').trim();
}

function SortableNoteItem({
    note,
    isSelected,
    onNoteSelect,
    onAddToCollection,
    onDeleteNote,
    onArchiveNote,
    onRestoreNote,
    collections,
    isCollectionMode,
    selectionMode,
    isChecked,
    onToggleCheck,
    isDarkTheme
}: {
    note: Note,
    isSelected: boolean,
    onNoteSelect: (note: Note) => void,
    onAddToCollection?: (noteId: number, collectionId: number) => void,
    onDeleteNote?: (id: number) => void,
    onArchiveNote?: (id: number) => void,
    onRestoreNote?: (id: number) => void,
    collections: Collection[],
    isCollectionMode?: boolean,
    selectionMode?: boolean,
    isChecked?: boolean,
    onToggleCheck?: (id: number) => void,
    isDarkTheme: boolean
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: note.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const [openCollectionNoteId, setOpenCollectionNoteId] = useState<number | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const isMenuOpen = openCollectionNoteId === note.id;
    const displayTitle = formatTitle(note.title);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenCollectionNoteId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // 根据主题决定样式
    const cardStyles = isDarkTheme
        ? `${isSelected
            ? 'bg-[rgba(244,114,182,0.12)] shadow-[0_0_20px_rgba(244,114,182,0.15)]'
            : isChecked
                ? 'bg-[rgba(244,114,182,0.08)]'
                : 'hover:bg-white/[0.03]'}`
        : `bg-white shadow-sm ${isSelected
            ? 'shadow-md ring-1 ring-[#C4956A]/30'
            : isChecked
                ? 'ring-1 ring-[#C4956A]/20'
                : 'hover:shadow-md'}`;

    const textColor = isDarkTheme
        ? isSelected ? 'text-[#F472B6]' : 'text-white/85'
        : isSelected ? 'text-[#8B6914]' : 'text-[#2D2A26]';

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            <div className={`note-card group relative w-full mb-2 transition-all duration-200 rounded-lg overflow-hidden ${cardStyles}`}>
                {/* 选中指示条 */}
                {isSelected && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 ${isDarkTheme ? 'bg-[#F472B6]' : 'bg-[#C4956A]'}`} />
                )}

                {/* 批量选择复选框 */}
                {selectionMode && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleCheck?.(note.id); }}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1"
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {isChecked ? (
                            <CheckSquare size={16} className={isDarkTheme ? 'text-[#F472B6]' : 'text-[#C4956A]'} />
                        ) : (
                            <Square size={16} className={isDarkTheme ? 'text-white/30' : 'text-[#9A9590]'} />
                        )}
                    </button>
                )}

                <div
                    onClick={() => selectionMode ? onToggleCheck?.(note.id) : onNoteSelect(note)}
                    className={`w-full text-left px-4 py-3 rounded-lg cursor-pointer transition-transform active:scale-[0.99] ${selectionMode ? 'pl-10' : ''}`}
                >
                    <h3 className={`font-medium text-sm leading-relaxed select-none ${textColor}`}>
                        {displayTitle}
                    </h3>

                    {/* 标签 - 浅色主题单色，深色主题彩色 */}
                    <div className="flex items-center flex-wrap gap-1.5 mt-2">
                        {note.tags && note.tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag.id}
                                className={`tag text-[10px] px-2 py-0.5 rounded-full font-medium ${isDarkTheme
                                        ? 'bg-white/[0.06] text-white/50'
                                        : 'bg-[#EBE7E0] text-[#6B6560]'
                                    }`}
                            >
                                {tag.name}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Action Buttons */}
                {!selectionMode && (
                    <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-md px-1 py-0.5 z-10 transition-opacity ${isDarkTheme ? 'bg-black/80 backdrop-blur-sm' : 'bg-white/90 shadow-sm'
                        } ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'}`}
                        onPointerDown={(e) => e.stopPropagation()}
                    >
                        {onAddToCollection && (
                            <div className="relative">
                                <button
                                    onClick={(e) => { e.stopPropagation(); setOpenCollectionNoteId(isMenuOpen ? null : note.id); }}
                                    className={`p-1 transition-colors rounded ${isMenuOpen ? 'text-[#C4956A]' : isDarkTheme ? 'text-white/50 hover:text-[#F472B6]' : 'text-[#9A9590] hover:text-[#C4956A]'}`}
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                                </button>

                                {isMenuOpen && (
                                    <div ref={menuRef}
                                        className={`absolute top-full right-0 mt-1 w-44 rounded-lg shadow-xl py-1 z-50 ${isDarkTheme ? 'bg-black/95 backdrop-blur-xl' : 'bg-white border border-[#EBE7E0]'}`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <div className={`px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider ${isDarkTheme ? 'text-white/40' : 'text-[#9A9590]'}`}>
                                            选择收藏集
                                        </div>
                                        <div className="max-h-40 overflow-y-auto">
                                            {collections.length > 0 ? collections.map(col => (
                                                <button key={col.id}
                                                    onClick={() => { onAddToCollection(note.id, col.id); setOpenCollectionNoteId(null); }}
                                                    className={`w-full text-left px-3 py-1.5 text-xs truncate ${isDarkTheme ? 'text-white/70 hover:bg-[#F472B6]/20 hover:text-[#F472B6]' : 'text-[#6B6560] hover:bg-[#F5F2ED] hover:text-[#C4956A]'}`}
                                                >
                                                    📁 {col.name}
                                                </button>
                                            )) : <div className={`px-3 py-2 text-xs ${isDarkTheme ? 'text-white/30' : 'text-[#9A9590]'}`}>暂无收藏集</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {(note.is_archived || note.is_deleted) && onRestoreNote ? (
                            <button onClick={(e) => { e.stopPropagation(); onRestoreNote(note.id); }}
                                className={`p-1 transition-colors rounded ${isDarkTheme ? 'text-white/50 hover:text-green-400' : 'text-[#9A9590] hover:text-green-600'}`}>
                                <RotateCcw size={13} />
                            </button>
                        ) : onArchiveNote && (
                            <button onClick={(e) => { e.stopPropagation(); onArchiveNote(note.id); }}
                                className={`p-1 transition-colors rounded ${isDarkTheme ? 'text-white/50 hover:text-white' : 'text-[#9A9590] hover:text-[#6B6560]'}`}>
                                <ArchiveIcon size={13} />
                            </button>
                        )}

                        {onDeleteNote && (
                            <button onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
                                className={`p-1 transition-colors rounded ${isDarkTheme ? 'text-white/50 hover:text-red-400' : 'text-[#9A9590] hover:text-red-500'}`}>
                                {isCollectionMode ? <FolderMinus size={13} /> : <Trash2 size={13} />}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SkeletonCard({ isDarkTheme }: { isDarkTheme: boolean }) {
    return (
        <div className={`skeleton rounded-lg p-4 mb-2 ${isDarkTheme ? '' : 'bg-white'}`}>
            <div className={`h-4 rounded w-3/4 mb-2.5 ${isDarkTheme ? 'bg-white/[0.06]' : 'bg-[#EBE7E0]'}`}></div>
            <div className="flex gap-1.5">
                <div className={`h-4 rounded-full w-14 ${isDarkTheme ? 'bg-white/[0.04]' : 'bg-[#F5F2ED]'}`}></div>
                <div className={`h-4 rounded-full w-10 ${isDarkTheme ? 'bg-white/[0.04]' : 'bg-[#F5F2ED]'}`}></div>
            </div>
        </div>
    );
}

type SortOption = 'time_desc' | 'time_asc' | 'title_asc' | 'title_desc';

export function NoteList({
    notes, collections = [], selectedNoteId, onNoteSelect, loading,
    onDeleteNote, onArchiveNote, onRestoreNote, onAddToCollection,
    onReorder, onDragStart, onDragEnd, isCollectionMode,
    onBatchArchive, onBatchDelete
}: NoteListProps) {
    const { theme } = useTheme();
    const isDarkTheme = theme === 'dark';

    const [sortOption, setSortOption] = useState<SortOption>('time_desc');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const sortedNotes = [...notes].sort((a, b) => {
        switch (sortOption) {
            case 'time_desc': return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
            case 'time_asc': return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
            case 'title_asc': return formatTitle(a.title).localeCompare(formatTitle(b.title));
            case 'title_desc': return formatTitle(b.title).localeCompare(formatTitle(a.title));
            default: return 0;
        }
    });

    function handleDragStart() { if (onDragStart) onDragStart(); }
    function handleDragEnd(event: DragEndEvent) {
        if (onDragEnd) onDragEnd();
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = notes.findIndex((note) => note.id === active.id);
            const newIndex = notes.findIndex((note) => note.id === over.id);
            if (onReorder) onReorder(arrayMove(notes, oldIndex, newIndex));
        }
    }

    const toggleCheck = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => setSelectedIds(selectedIds.size === notes.length ? new Set() : new Set(notes.map(n => n.id)));
    const exitSelectionMode = () => { setSelectionMode(false); setSelectedIds(new Set()); };
    const handleBatchAction = (action: 'archive' | 'delete') => {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;
        action === 'archive' && onBatchArchive ? onBatchArchive(ids) : action === 'delete' && onBatchDelete && onBatchDelete(ids);
        exitSelectionMode();
    };

    if (loading) {
        return (
            <div className="flex-1 overflow-y-auto p-3">
                {[1, 2, 3, 4, 5].map(i => <SkeletonCard key={i} isDarkTheme={isDarkTheme} />)}
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className={`flex-1 flex flex-col items-center justify-center p-8 ${isDarkTheme ? 'text-white/30' : 'text-[#9A9590]'}`}>
                <FileText size={40} className="mb-3 opacity-50" />
                <p className="text-base font-medium">暂无笔记</p>
                <p className="text-xs mt-1 opacity-70">通过浏览器扩展添加笔记</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* 工具栏 */}
            <div className={`sticky top-0 z-10 px-3 py-2 flex items-center justify-between gap-2 ${isDarkTheme ? 'bg-black/30 backdrop-blur-md' : 'bg-[#F5F2ED]/90 backdrop-blur-sm'}`}>
                {selectionMode ? (
                    <>
                        <div className="flex items-center gap-2">
                            <button onClick={toggleSelectAll} className={`text-[11px] ${isDarkTheme ? 'text-white/50 hover:text-[#F472B6]' : 'text-[#6B6560] hover:text-[#C4956A]'}`}>
                                {selectedIds.size === notes.length ? '取消全选' : '全选'}
                            </button>
                            <span className={`text-[11px] font-medium ${isDarkTheme ? 'text-[#F472B6]' : 'text-[#C4956A]'}`}>{selectedIds.size} 项</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                            {onBatchArchive && (
                                <button onClick={() => handleBatchAction('archive')} disabled={selectedIds.size === 0}
                                    className={`p-1.5 transition-colors disabled:opacity-30 ${isDarkTheme ? 'text-white/50 hover:text-white' : 'text-[#9A9590] hover:text-[#6B6560]'}`}>
                                    <ArchiveIcon size={14} />
                                </button>
                            )}
                            {onBatchDelete && (
                                <button onClick={() => handleBatchAction('delete')} disabled={selectedIds.size === 0}
                                    className={`p-1.5 transition-colors disabled:opacity-30 ${isDarkTheme ? 'text-white/50 hover:text-red-400' : 'text-[#9A9590] hover:text-red-500'}`}>
                                    <Trash2 size={14} />
                                </button>
                            )}
                            <button onClick={exitSelectionMode} className={`p-1.5 ${isDarkTheme ? 'text-white/50 hover:text-white' : 'text-[#9A9590] hover:text-[#6B6560]'}`}>
                                <X size={14} />
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <button onClick={() => setSelectionMode(true)}
                            className={`text-[11px] flex items-center gap-1 ${isDarkTheme ? 'text-white/40 hover:text-[#F472B6]' : 'text-[#9A9590] hover:text-[#C4956A]'}`}>
                            <CheckSquare size={11} />
                            <span>选择</span>
                        </button>
                        <div className="flex items-center gap-1">
                            <ArrowUpDown size={10} className={isDarkTheme ? 'text-white/30' : 'text-[#9A9590]'} />
                            <select value={sortOption} onChange={(e) => setSortOption(e.target.value as SortOption)}
                                className={`text-[11px] bg-transparent cursor-pointer focus:outline-none ${isDarkTheme ? 'text-white/50 hover:text-white' : 'text-[#6B6560]'}`}
                            >
                                <option value="time_desc" className={isDarkTheme ? 'bg-black' : 'bg-white'}>最新优先</option>
                                <option value="time_asc" className={isDarkTheme ? 'bg-black' : 'bg-white'}>最早优先</option>
                                <option value="title_asc" className={isDarkTheme ? 'bg-black' : 'bg-white'}>标题 A-Z</option>
                                <option value="title_desc" className={isDarkTheme ? 'bg-black' : 'bg-white'}>标题 Z-A</option>
                            </select>
                        </div>
                    </>
                )}
            </div>

            {/* 笔记列表 */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="flex-1 overflow-y-auto px-3 py-2">
                    <SortableContext items={sortedNotes.map(n => n.id)} strategy={verticalListSortingStrategy}>
                        {sortedNotes.map((note) => (
                            <SortableNoteItem key={note.id} note={note} isSelected={selectedNoteId === note.id}
                                collections={collections} onNoteSelect={onNoteSelect} onAddToCollection={onAddToCollection}
                                onDeleteNote={onDeleteNote} onArchiveNote={onArchiveNote} onRestoreNote={onRestoreNote}
                                isCollectionMode={isCollectionMode} selectionMode={selectionMode}
                                isChecked={selectedIds.has(note.id)} onToggleCheck={toggleCheck} isDarkTheme={isDarkTheme}
                            />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>
        </div>
    );
}
