'use client';

import { useEffect, useState } from 'react';
import { Layout, MessageSquare, Twitter, Youtube, Globe, Plus, Folder, Settings as SettingsIcon, Hash, Zap, Trash2, ZapOff } from 'lucide-react';

interface TagItem {
    id: number;
    name: string;
    color?: string;
}

interface Collection {
    id: number;
    name: string;
    count: number;
}

interface SidebarProps {
    tags: TagItem[];
    collections: Collection[];
    currentFilter: { type: 'all' | 'tag' | 'source' | 'collection'; value?: string | number };
    onFilterSelect: (type: 'all' | 'tag' | 'source' | 'collection', value?: string | number) => void;
    onCreateCollection: (name: string) => Promise<void>;
    isAiOnline: boolean;
    onOpenSettings?: (tab?: 'general' | 'collections' | 'tags' | 'trash') => void;
}

export function Sidebar({ tags, collections, currentFilter, onFilterSelect, onCreateCollection, isAiOnline, onOpenSettings }: SidebarProps) {
    return (
        <aside className="w-64 h-full bg-gray-900 border-r border-gray-800 flex flex-col">
            {/* Logo & Status */}
            <div className="p-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                        第二大脑
                    </h1>
                    <div className={`flex items-center gap-1 text-xs ${isAiOnline ? 'text-green-400' : 'text-red-400'}`}>
                        {isAiOnline ? <Zap size={14} /> : <ZapOff size={14} />}
                        <span>{isAiOnline ? 'AI 在线' : 'AI 离线'}</span>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">本地AI知识库</p>
            </div>

            {/* Smart Flows (Sources) */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-6">
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                        来源流
                    </h3>
                    <div className="space-y-1">
                        <button
                            onClick={() => onFilterSelect('all')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'all'
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <Folder size={16} />
                            <span>全部笔记</span>
                        </button>
                        <button
                            onClick={() => onFilterSelect('source', 'twitter')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'source' && currentFilter.value === 'twitter'
                                ? 'bg-blue-500/20 text-blue-300'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <span className="text-blue-400">🐦</span>
                            <span>推特</span>
                        </button>
                        <button
                            onClick={() => onFilterSelect('source', 'youtube')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'source' && currentFilter.value === 'youtube'
                                ? 'bg-red-500/20 text-red-300'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <span className="text-red-400">📺</span>
                            <span>视频</span>
                        </button>
                        <button
                            onClick={() => onFilterSelect('source', 'web')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'source' && currentFilter.value === 'web'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                }`}
                        >
                            <span className="text-emerald-400">🌐</span>
                            <span>网页</span>
                        </button>
                    </div>
                </div>

                {/* Collections */}
                <div>
                    <div className="flex items-center justify-between px-3 mb-2">
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            我的收藏
                        </h3>
                        <button
                            onClick={() => {
                                const name = prompt('请输入新收藏集名称:');
                                if (name) onCreateCollection(name);
                            }}
                            className="text-gray-500 hover:text-indigo-400 transition-colors"
                            title="新建收藏"
                        >
                            <div className="w-4 h-4 border border-gray-600 rounded flex items-center justify-center text-xs">+</div>
                        </button>
                    </div>
                    <div className="space-y-1">
                        {collections.map(col => (
                            <button
                                key={col.id}
                                onClick={() => onFilterSelect('collection', col.id)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'collection' && currentFilter.value === col.id
                                    ? 'bg-purple-500/20 text-purple-300'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="opacity-70">📁</span>
                                    <span>{col.name}</span>
                                </div>
                                <span className="text-xs opacity-50">{col.count || 0}</span>
                            </button>
                        ))}
                        {collections.length === 0 && (
                            <p className="px-3 text-xs text-gray-600">点击 + 号创建收藏集</p>
                        )}
                    </div>
                </div>

                {/* Tags Section */}
                <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-3 mb-2">
                        智能标签
                    </h3>
                    <div className="space-y-1">
                        {tags.map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => onFilterSelect('tag', tag.name)}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentFilter.type === 'tag' && currentFilter.value === tag.name
                                    ? 'bg-indigo-500/20 text-indigo-300'
                                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                                    }`}
                            >
                                <Hash size={14} style={{ color: tag.color }} />
                                <span>{tag.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-800">
                <button
                    onClick={() => onOpenSettings && onOpenSettings('general')}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-300 w-full px-2 py-1.5 rounded hover:bg-gray-800 transition-colors"
                >
                    <SettingsIcon size={16} />
                    <span>设置</span>
                </button>
                <button
                    onClick={() => onOpenSettings && onOpenSettings('trash')}
                    className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-400 w-full px-2 py-1.5 rounded hover:bg-gray-800 transition-colors mt-1"
                >
                    <Trash2 size={16} />
                    <span>回收站</span>
                </button>
            </div>
        </aside>
    );
}
