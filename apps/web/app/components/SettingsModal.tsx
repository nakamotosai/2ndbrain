'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, Folder, Hash } from 'lucide-react';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab?: 'general' | 'collections' | 'tags' | 'trash';
    initialCollections?: any[];
}

export function SettingsModal({ isOpen, onClose, activeTab = 'trash' }: SettingsModalProps) {
    const [currentTab, setCurrentTab] = useState(activeTab);
    const [deletedNotes, setDeletedNotes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && currentTab === 'trash') {
            fetchDeletedNotes();
        }
    }, [isOpen, currentTab]);

    const fetchDeletedNotes = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/notes?trash=true');
            if (res.ok) {
                const data = await res.json();
                setDeletedNotes(data.notes || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (id: number) => {
        try {
            await fetch('/api/notes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, restore: true })
            });
            fetchDeletedNotes(); // Refresh
        } catch (e) {
            console.error(e);
        }
    };

    const handlePermanentDelete = async (id: number) => {
        if (!confirm('此操作无法撤销，确定永久删除吗？')) return;
        try {
            await fetch(`/api/notes?id=${id}&permanent=true`, {
                method: 'DELETE'
            });
            fetchDeletedNotes();
        } catch (e) {
            console.error(e);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl w-[800px] h-[600px] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h2 className="text-lg font-semibold text-gray-100">设置与管理</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-gray-950/50 border-r border-gray-800 p-2 space-y-1">
                        <button
                            onClick={() => setCurrentTab('trash')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'trash' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'}`}
                        >
                            <Trash2 size={16} />
                            <span>回收站</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('collections')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'collections' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'}`}
                        >
                            <Folder size={16} />
                            <span>收藏集管理</span>
                        </button>
                        {/* Placeholder for future features */}
                        <button
                            onClick={() => setCurrentTab('general')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'general' ? 'bg-indigo-500/20 text-indigo-300' : 'text-gray-400 hover:bg-gray-800'}`}
                        >
                            <span className="text-xs">⚙️</span>
                            <span>通用设置</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto bg-gray-900">
                        {currentTab === 'trash' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-md font-medium text-gray-200">已删除笔记</h3>
                                    <button onClick={fetchDeletedNotes} className="p-1 text-gray-500 hover:text-gray-300"><RefreshCw size={16} /></button>
                                </div>
                                {loading ? (
                                    <div className="text-center py-10 text-gray-500">加载中...</div>
                                ) : deletedNotes.length === 0 ? (
                                    <div className="text-center py-10 text-gray-600">回收站为空</div>
                                ) : (
                                    <div className="space-y-2">
                                        {deletedNotes.map(note => (
                                            <div key={note.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-800">
                                                <div className="overflow-hidden">
                                                    <div className="font-medium text-gray-300 line-clamp-1">{note.title}</div>
                                                    <div className="text-xs text-gray-500">{new Date(note.created_at).toLocaleString()}</div>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <button
                                                        onClick={() => handleRestore(note.id)}
                                                        className="px-3 py-1 text-xs bg-indigo-500/10 text-indigo-300 rounded hover:bg-indigo-500/20"
                                                    >
                                                        恢复
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(note.id)}
                                                        className="px-3 py-1 text-xs bg-red-500/10 text-red-400 rounded hover:bg-red-500/20"
                                                    >
                                                        永久删除
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {currentTab === 'collections' && (
                            <div className="text-center py-20 text-gray-500">
                                <Folder size={48} className="mx-auto mb-4 opacity-20" />
                                <p>收藏集高级管理功能开发中...</p>
                                <p className="text-xs mt-2">目前请在侧边栏进行基础管理</p>
                            </div>
                        )}

                        {currentTab === 'general' && (
                            <div className="text-center py-20 text-gray-500">
                                <p>通用设置开发中...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
