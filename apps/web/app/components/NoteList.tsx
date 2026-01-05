'use client';

import { FileText, Archive as ArchiveIcon, RotateCcw, Trash2, FolderMinus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
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
    isCollectionMode?: boolean; // New prop
    onDeleteNote?: (id: number) => void;
    onArchiveNote?: (id: number) => void;
    onRestoreNote?: (id: number) => void;
    onAddToCollection?: (noteId: number, collectionId: number) => void;
    onReorder?: (newNotes: Note[]) => void;
    onDragStart?: () => void;
    onDragEnd?: () => void;
}

function formatTitle(title: string): string {
    return title.replace(/^.*?[:：]\s*一句话核心[:：]\s*/i, '').trim();
}

function SortableNoteItem({ note, isSelected, onNoteSelect, onAddToCollection, onDeleteNote, onArchiveNote, onRestoreNote, collections, isCollectionMode }: {
    note: Note,
    isSelected: boolean,
    onNoteSelect: (note: Note) => void,
    onAddToCollection?: (noteId: number, collectionId: number) => void,
    onDeleteNote?: (id: number) => void,
    onArchiveNote?: (id: number) => void,
    onRestoreNote?: (id: number) => void,
    collections: Collection[],
    isCollectionMode?: boolean
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

    // Close menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpenCollectionNoteId(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
            <div
                className={`group relative w-full mb-1 transition-all rounded-lg border border-transparent ${isSelected
                    ? 'bg-theme-tertiary border-theme shadow-sm'
                    : 'hover:bg-theme-secondary/50 hover:border-theme/50'
                    }`}
            >
                <div
                    onClick={() => onNoteSelect(note)}
                    className="w-full text-left p-2.5 rounded-lg active:scale-[0.99] transition-transform cursor-pointer"
                >
                    <h3 className={`font-bold text-sm leading-snug transition-colors Select-none ${isSelected ? 'text-accent' : 'text-theme-primary'
                        }`}>
                        {displayTitle}
                    </h3>

                    <div className="flex items-center flex-wrap gap-x-2 mt-1.5 opacity-80">
                        {note.tags && note.tags.length > 0 ? (
                            note.tags.slice(0, 3).map((tag) => (
                                <span
                                    key={tag.id}
                                    className="text-[11px] italic text-theme-secondary/70 hover:text-accent transition-colors"
                                >
                                    #{tag.name}
                                </span>
                            ))
                        ) : null}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 bg-theme-primary/95 shadow-sm border border-theme rounded px-1 py-1 z-10 transition-opacity ${isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 ptr-events-none group-hover:ptr-events-auto'
                    }`}
                    // Prevent drag when interacting with buttons
                    onPointerDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                >
                    {onAddToCollection && (
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenCollectionNoteId(isMenuOpen ? null : note.id);
                                }}
                                className={`p-1 transition-colors ${isMenuOpen ? 'text-accent' : 'text-theme-secondary hover:text-accent'}`}
                                title="添加到收藏集"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>
                            </button>

                            {/* Collection Dropdown */}
                            {isMenuOpen && (
                                <div
                                    ref={menuRef}
                                    className="absolute top-full right-0 mt-2 w-48 bg-theme-primary border border-theme rounded-lg shadow-xl py-1 z-50 overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="px-3 py-2 text-xs font-bold text-theme-secondary border-b border-theme bg-theme-secondary/10">
                                        选择收藏集
                                    </div>
                                    <div className="max-h-48 overflow-y-auto">
                                        {collections.length > 0 ? (
                                            collections.map(col => (
                                                <button
                                                    key={col.id}
                                                    onClick={() => {
                                                        onAddToCollection(note.id, col.id);
                                                        setOpenCollectionNoteId(null);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-xs text-theme-secondary hover:bg-accent/10 hover:text-accent transition-colors truncate"
                                                >
                                                    📁 {col.name}
                                                </button>
                                            ))
                                        ) : (
                                            <div className="px-3 py-2 text-xs text-theme-secondary opacity-50 text-center">
                                                暂无收藏集
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {(note.is_archived || note.is_deleted) && onRestoreNote ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onRestoreNote(note.id); }}
                            className="p-1 text-theme-secondary hover:text-green-500 transition-colors"
                            title={note.is_deleted ? "还原 (移出回收站)" : "还原 (移出归档)"}
                        >
                            <RotateCcw size={14} />
                        </button>
                    ) : onArchiveNote && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onArchiveNote(note.id); }}
                            className="p-1 text-theme-secondary hover:text-theme-primary transition-colors"
                            title="归档 (不显示在列表中)"
                        >
                            <ArchiveIcon size={14} />
                        </button>
                    )}

                    {onDeleteNote && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteNote(note.id);
                            }}
                            className={`p-1 text-theme-secondary transition-colors ${note.is_deleted ? 'hover:text-red-600' : 'hover:text-red-500'
                                }`}
                            title={isCollectionMode ? "从收藏集移除" : (note.is_deleted ? "永久删除 (无法撤销)" : "删除 (移入回收站)")}
                        >
                            {isCollectionMode ? (
                                <FolderMinus size={14} />
                            ) : note.is_deleted ? (
                                <Trash2 size={14} />
                            ) : (
                                <Trash2 size={14} />
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export function NoteList({ notes, collections = [], selectedNoteId, onNoteSelect, loading, onDeleteNote, onArchiveNote, onRestoreNote, onAddToCollection, onReorder, onDragStart, onDragEnd }: NoteListProps) {
    const sensors = useSensors(
        useSensor(MouseSensor, {
            activationConstraint: {
                distance: 10, // Avoid accidental drags
            },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 250, // Long press constraint
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragStart() {
        if (onDragStart) onDragStart();
    }

    function handleDragEnd(event: DragEndEvent) {
        if (onDragEnd) onDragEnd();
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = notes.findIndex((note) => note.id === active.id);
            const newIndex = notes.findIndex((note) => note.id === over.id);

            const newNotes = arrayMove(notes, oldIndex, newIndex);
            if (onReorder) onReorder(newNotes);
        }
    }

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
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="flex-1 overflow-y-auto p-2 scroll-smooth">
                <SortableContext
                    items={notes.map(n => n.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {notes.map((note) => (
                        <SortableNoteItem
                            key={note.id}
                            note={note}
                            isSelected={selectedNoteId === note.id}
                            collections={collections}
                            onNoteSelect={onNoteSelect}
                            onAddToCollection={onAddToCollection}
                            onDeleteNote={onDeleteNote}
                            onArchiveNote={onArchiveNote}
                            onRestoreNote={onRestoreNote}
                        />
                    ))}
                </SortableContext>
            </div>
        </DndContext>
    );
}
