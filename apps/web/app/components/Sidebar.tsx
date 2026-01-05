'use client';

import { Folder, Hash, Zap, Trash2, ZapOff, Settings as SettingsIcon, Layout, Twitter, Youtube, Globe, Plus, Library, Search, Type as TypeIcon, Archive as ArchiveIcon } from 'lucide-react';
import { useTheme } from './ThemeContext';

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
    currentFilter: { type: 'all' | 'tag' | 'source' | 'collection' | 'archive' | 'trash'; value?: string | number };
    onFilterSelect: (type: 'all' | 'tag' | 'source' | 'collection' | 'archive' | 'trash', value?: string | number) => void;
    onCreateCollection: (name: string) => Promise<void>;
    isAiOnline: boolean;
    onOpenSettings?: (tab?: 'general' | 'collections' | 'tags' | 'trash' | 'appearance') => void;
    onSearch?: () => void;
}

export function Sidebar({ tags, collections, currentFilter, onFilterSelect, onCreateCollection, isAiOnline, onOpenSettings, onSearch }: SidebarProps) {
    const { font, setFont } = useTheme();

    // Helper to determine active state
    const isActive = (type: string, value?: string | number) => {
        return currentFilter.type === type && currentFilter.value === value;
    };

    const NavItem = ({
        active,
        onClick,
        icon: Icon,
        label,
        count,
        colorClass = 'text-theme-secondary'
    }: {
        active: boolean,
        onClick: () => void,
        icon: any,
        label: React.ReactNode,
        count?: number,
        colorClass?: string
    }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group ${active
                ? 'bg-accent/10 text-accent font-medium'
                : 'text-theme-secondary hover:bg-theme-secondary hover:text-theme-primary'
                }`}
        >
            <div className="flex items-center gap-3">
                <Icon size={16} className={active ? 'text-accent' : colorClass} />
                <span>{label}</span>
            </div>
            {count !== undefined && (
                <span className={`text-xs ${active ? 'opacity-100' : 'opacity-50'}`}>{count}</span>
            )}
        </button>
    );

    return (
        <aside className="w-64 h-full bg-theme-secondary border-r border-theme flex flex-col glass-sidebar transition-colors duration-300">
            {/* Header */}
            <div className="p-4 border-b border-theme shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent filter hover:brightness-110 transition-all cursor-default">
                        第二大脑
                    </h1>
                    <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-theme-tertiary ${isAiOnline ? 'text-green-500' : 'text-red-500'}`}>
                        {isAiOnline ? <Zap size={10} fill="currentColor" /> : <ZapOff size={10} />}
                        <span>{isAiOnline ? 'Online' : 'Offline'}</span>
                    </div>
                </div>

                <button
                    onClick={onSearch}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-theme-tertiary text-theme-secondary hover:text-accent hover:ring-1 hover:ring-accent transition-all text-sm group"
                >
                    <Search className="group-hover:text-accent" size={16} />
                    <span className="opacity-70 group-hover:opacity-100">搜索全库...</span>
                    <span className="ml-auto text-xs opacity-50 border border-theme px-1 rounded">⌘K</span>
                </button>
            </div>

            {/* Scrollable Nav */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-6">

                {/* 资源库 (Resources: All + Sources + Collections merged) */}
                <div className="space-y-1">
                    <h3 className="text-xs font-bold text-theme-secondary uppercase tracking-wider px-3 mb-2 opacity-70">
                        资源库
                    </h3>

                    <NavItem
                        active={isActive('all')}
                        onClick={() => onFilterSelect('all')}
                        icon={Library}
                        label="全部笔记"
                    />

                    {/* Sources Sub-section */}
                    <div className="pt-2 pb-2">
                        <NavItem
                            active={isActive('source', 'twitter')}
                            onClick={() => onFilterSelect('source', 'twitter')}
                            icon={Twitter}
                            label="推特动态"
                            colorClass="text-blue-400"
                        />
                        <NavItem
                            active={isActive('source', 'youtube')}
                            onClick={() => onFilterSelect('source', 'youtube')}
                            icon={Youtube}
                            label="视频收藏"
                            colorClass="text-red-500"
                        />
                        <NavItem
                            active={isActive('source', 'web')}
                            onClick={() => onFilterSelect('source', 'web')}
                            icon={Globe}
                            label="网页文章"
                            colorClass="text-emerald-500"
                        />
                    </div>

                    {/* Collections Sub-section */}
                    <div className="pt-1">
                        <div className="flex items-center justify-between px-3 mb-1 group">
                            <span className="text-xs font-medium text-theme-secondary opacity-50 group-hover:opacity-100 transition-opacity">收藏集</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const name = prompt('请输入新收藏集名称:');
                                    if (name) onCreateCollection(name);
                                }}
                                className="text-theme-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                                title="新建收藏"
                            >
                                <Plus size={14} />
                            </button>
                        </div>

                        {collections.map(col => (
                            <NavItem
                                key={col.id}
                                active={isActive('collection', col.id)}
                                onClick={() => onFilterSelect('collection', col.id)}
                                icon={Folder}
                                label={col.name}
                                count={col.count}
                            />
                        ))}
                    </div>
                </div>

                {/* Tags Section */}
                <div>
                    <h3 className="text-xs font-bold text-theme-secondary uppercase tracking-wider px-3 mb-2 opacity-70">
                        智能标签
                    </h3>
                    <div className="space-y-1">
                        {tags.map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => onFilterSelect('tag', tag.name)}
                                className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-md text-sm transition-colors ${isActive('tag', tag.name)
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary'
                                    }`}
                            >
                                <Hash size={14} style={{ color: tag.color }} className="opacity-70" />
                                <span>{tag.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-3 border-t border-theme space-y-1">
                <button
                    onClick={() => {
                        const nextFont = font === 'sans' ? 'serif' : 'sans';
                        setFont(nextFont);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
                    title="切换字体 (Sans/Serif)"
                >
                    <TypeIcon size={16} />
                    <span>{font === 'sans' ? '切换字体: 黑体' : '切换字体: 宋体'}</span>
                </button>
                <button
                    onClick={() => onFilterSelect('archive')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('archive')
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary'}`}
                >
                    <ArchiveIcon size={16} />
                    <span>归档箱</span>
                </button>
                <button
                    onClick={() => onFilterSelect('trash')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive('trash')
                        ? 'bg-accent/10 text-accent font-medium'
                        : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary'}`}
                >
                    <Trash2 size={16} />
                    <span>回收站</span>
                </button>
                <button
                    onClick={() => onOpenSettings && onOpenSettings('general')}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-theme-secondary hover:text-theme-primary hover:bg-theme-secondary transition-colors"
                >
                    <SettingsIcon size={16} />
                    <span>系统设置</span>
                </button>
            </div>
        </aside>
    );
}
