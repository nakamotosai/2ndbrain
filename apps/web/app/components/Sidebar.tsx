'use client';

import { Folder, Zap, Trash2, ZapOff, Settings as SettingsIcon, Twitter, Youtube, Globe, Plus, Library, Search, Type as TypeIcon, Archive as ArchiveIcon, BarChart3, Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface TagItem {
    id: number;
    name: string;
    count?: number;
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
    onOpenDashboard?: () => void;
}

export function Sidebar({ tags, collections, currentFilter, onFilterSelect, onCreateCollection, isAiOnline, onOpenSettings, onSearch, onOpenDashboard }: SidebarProps) {
    const { theme, toggleTheme, font, setFont } = useTheme();
    const isDark = theme === 'dark';

    const isActive = (type: string, value?: string | number) => currentFilter.type === type && currentFilter.value === value;

    // 颜色变量
    const colors = {
        bg: isDark ? 'bg-black/60 backdrop-blur-2xl' : 'bg-[#F5F2ED]',
        text: isDark ? 'text-white/60' : 'text-[#6B6560]',
        textActive: isDark ? 'text-[#F472B6]' : 'text-[#8B6914]',
        textHover: isDark ? 'hover:text-white/80' : 'hover:text-[#2D2A26]',
        hoverBg: isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-[#EBE7E0]',
        activeBg: isDark ? 'bg-[#F472B6]/15' : 'bg-[#C4956A]/10',
        accent: isDark ? '#F472B6' : '#C4956A',
        tagBg: isDark ? 'bg-white/[0.04]' : 'bg-[#EBE7E0]',
        tagText: isDark ? 'text-white/50' : 'text-[#6B6560]',
        muted: isDark ? 'text-white/25' : 'text-[#9A9590]',
        border: isDark ? '' : 'border-r border-[#EBE7E0]/50',
    };

    const NavItem = ({ active, onClick, icon: Icon, label, count, colorClass }: {
        active: boolean, onClick: () => void, icon: any, label: React.ReactNode, count?: number, colorClass?: string
    }) => (
        <button onClick={onClick}
            className={`sidebar w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${active ? `${colors.activeBg} ${colors.textActive} font-medium` : `${colors.text} ${colors.hoverBg} ${colors.textHover}`
                }`}
        >
            <div className="flex items-center gap-2.5">
                <Icon size={15} className={`shrink-0 ${active ? colors.textActive : colorClass || colors.text}`} />
                <span className="truncate">{label}</span>
            </div>
            {count !== undefined && <span className={`text-[10px] tabular-nums ${active ? 'opacity-100' : 'opacity-40'}`}>{count}</span>}
        </button>
    );

    return (
        <aside className={`sidebar w-60 h-full flex flex-col transition-colors duration-300 ${colors.bg} ${colors.border}`}>
            {/* Header */}
            <div className="p-4 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <h1 className={`text-lg font-bold ${isDark ? 'bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent' : 'text-[#5C4B1F]'}`}>
                        第二大脑
                    </h1>
                    <div className="flex items-center gap-2">
                        {/* 主题切换按钮 */}
                        <button onClick={toggleTheme}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-white/40 hover:text-yellow-300 hover:bg-yellow-300/10' : 'text-[#9A9590] hover:text-[#2D2A26] hover:bg-[#EBE7E0]'}`}
                            title={isDark ? '切换到沉浸阅读' : '切换到磨砂玻璃'}
                        >
                            {isDark ? <Sun size={14} /> : <Moon size={14} />}
                        </button>
                        <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full ${isAiOnline ? 'text-green-500' : 'text-red-400'}`}>
                            {isAiOnline ? <Zap size={9} fill="currentColor" /> : <ZapOff size={9} />}
                        </div>
                    </div>
                </div>

                <button onClick={onSearch}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm group transition-all ${isDark ? 'bg-white/[0.03] text-white/40 hover:bg-white/[0.06]' : 'bg-[#EBE7E0] text-[#9A9590] hover:bg-[#E5E0D8]'}`}
                >
                    <Search size={14} className="shrink-0" />
                    <span className="text-xs opacity-70 group-hover:opacity-100">搜索...</span>
                    <span className={`ml-auto text-[10px] opacity-40 ${isDark ? '' : 'border border-[#D5D0C8] px-1 rounded'}`}>⌘K</span>
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-5">
                {/* 资源库 */}
                <div className="space-y-0.5">
                    <h3 className={`text-[10px] font-medium uppercase tracking-wider px-3 mb-2 ${colors.muted}`}>资源库</h3>
                    <NavItem active={isActive('all')} onClick={() => onFilterSelect('all')} icon={Library} label="全部笔记" />
                    <div className="pt-1.5 space-y-0.5">
                        <NavItem active={isActive('source', 'twitter')} onClick={() => onFilterSelect('source', 'twitter')} icon={Twitter} label="推特" colorClass="text-blue-400" />
                        <NavItem active={isActive('source', 'youtube')} onClick={() => onFilterSelect('source', 'youtube')} icon={Youtube} label="视频" colorClass="text-red-400" />
                        <NavItem active={isActive('source', 'web')} onClick={() => onFilterSelect('source', 'web')} icon={Globe} label="网页" colorClass="text-emerald-400" />
                    </div>

                    {/* Collections */}
                    <div className="pt-2">
                        <div className="flex items-center justify-between px-3 mb-1 group">
                            <span className={`text-[10px] font-medium ${colors.muted}`}>收藏集</span>
                            <button onClick={(e) => { e.stopPropagation(); const name = prompt('新收藏集名称:'); if (name) onCreateCollection(name); }}
                                className={`opacity-0 group-hover:opacity-100 transition-all ${colors.muted} hover:${colors.textActive}`}>
                                <Plus size={12} />
                            </button>
                        </div>
                        {collections.map(col => (
                            <NavItem key={col.id} active={isActive('collection', col.id)} onClick={() => onFilterSelect('collection', col.id)} icon={Folder} label={col.name} count={col.count} />
                        ))}
                    </div>
                </div>

                {/* 标签 - 单色设计 */}
                <div>
                    <h3 className={`text-[10px] font-medium uppercase tracking-wider px-3 mb-2 ${colors.muted}`}>智能标签</h3>
                    <div className="flex flex-wrap gap-1.5 px-2">
                        {tags.map((tag) => {
                            const isTagActive = isActive('tag', tag.name);
                            return (
                                <button key={tag.id} onClick={() => onFilterSelect('tag', tag.name)}
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 ${isTagActive
                                            ? `bg-[${colors.accent}] text-white ${isDark ? 'shadow-[0_0_10px_rgba(244,114,182,0.4)]' : ''}`
                                            : `${colors.tagBg} ${colors.tagText} hover:opacity-80`
                                        }`}
                                    style={isTagActive ? { backgroundColor: colors.accent } : {}}
                                >
                                    {tag.name}
                                </button>
                            );
                        })}
                        {tags.length === 0 && <p className={`text-[10px] px-1 ${colors.muted}`}>暂无标签</p>}
                    </div>
                </div>
            </nav>

            {/* Footer */}
            <div className="p-3 space-y-0.5">
                <button onClick={() => setFont(font === 'sans' ? 'serif' : 'sans')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${colors.text} ${colors.textHover} ${colors.hoverBg}`}>
                    <TypeIcon size={14} className="shrink-0" />
                    <span>{font === 'sans' ? '黑体' : '宋体'}</span>
                </button>
                {onOpenDashboard && (
                    <button onClick={onOpenDashboard}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${colors.text} ${isDark ? 'hover:text-[#F472B6] hover:bg-[#F472B6]/10' : 'hover:text-[#C4956A] hover:bg-[#C4956A]/10'}`}>
                        <BarChart3 size={14} className="shrink-0" />
                        <span>仪表盘</span>
                    </button>
                )}
                <button onClick={() => onFilterSelect('archive')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${isActive('archive') ? `${colors.activeBg} ${colors.textActive}` : `${colors.text} ${colors.textHover} ${colors.hoverBg}`}`}>
                    <ArchiveIcon size={14} className="shrink-0" />
                    <span>归档</span>
                </button>
                <button onClick={() => onFilterSelect('trash')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${isActive('trash') ? `${colors.activeBg} ${colors.textActive}` : `${colors.text} ${colors.textHover} ${colors.hoverBg}`}`}>
                    <Trash2 size={14} className="shrink-0" />
                    <span>回收站</span>
                </button>
                <button onClick={() => onOpenSettings?.('general')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-colors ${colors.text} ${colors.textHover} ${colors.hoverBg}`}>
                    <SettingsIcon size={14} className="shrink-0" />
                    <span>设置</span>
                </button>
            </div>
        </aside>
    );
}
