'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, Folder, Hash, Palette, Check } from 'lucide-react';
import { useTheme, Theme } from './ThemeContext';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    activeTab?: 'general' | 'collections' | 'tags' | 'trash' | 'appearance';
    initialCollections?: any[];
}

export function SettingsModal({ isOpen, onClose, activeTab = 'general' }: SettingsModalProps) {
    const [currentTab, setCurrentTab] = useState<string>(activeTab);
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (activeTab) setCurrentTab(activeTab);
    }, [activeTab]);

    const themes: { id: Theme; name: string; description: string; colors: string[] }[] = [
        { id: 'zen', name: '禅意极简 (Zen)', description: 'Apple 风格，明亮通透', colors: ['#ffffff', '#f3f4f6', '#3b82f6'] },
        { id: 'obsidian', name: '极客深黑 (Obsidian)', description: '沉浸式暗黑，护眼高效', colors: ['#1e1e1e', '#252526', '#a855f7'] },
        { id: 'card', name: '现代卡片 (Card)', description: 'Notion 风格，结构清晰', colors: ['#f7f7f5', '#ffffff', '#ea580c'] },
        { id: 'glass', name: '磨砂玻璃 (Glass)', description: '高级质感，毛玻璃特效', colors: ['#000000', '#141414', '#f472b6'] },
        { id: 'focus', name: '沉浸阅读 (Focus)', description: '纸质书感，暖色衬线体', colors: ['#fdfbf7', '#f8f1e3', '#d97706'] },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-theme-secondary border border-theme rounded-xl shadow-2xl w-[800px] h-[600px] flex flex-col overflow-hidden text-theme-primary">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-theme">
                    <h2 className="text-lg font-semibold">设置与管理</h2>
                    <button onClick={onClose} className="text-theme-secondary hover:text-theme-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-48 bg-theme-secondary/50 border-r border-theme p-2 space-y-1">
                        <button
                            onClick={() => setCurrentTab('appearance')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'appearance' ? 'bg-accent/10 text-accent font-medium' : 'text-theme-secondary hover:bg-theme-tertiary hover:text-theme-primary'}`}
                        >
                            <Palette size={16} />
                            <span>界面外观</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('collections')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'collections' ? 'bg-accent/10 text-accent font-medium' : 'text-theme-secondary hover:bg-theme-tertiary hover:text-theme-primary'}`}
                        >
                            <Folder size={16} />
                            <span>收藏集管理</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('general')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'general' ? 'bg-accent/10 text-accent font-medium' : 'text-theme-secondary hover:bg-theme-tertiary hover:text-theme-primary'}`}
                        >
                            <span className="text-xs">⚙️</span>
                            <span>通用设置</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto bg-theme-primary">
                        {currentTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium mb-1">主题风格</h3>
                                    <p className="text-sm text-theme-secondary">选择最适合你的阅读与工作环境</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {themes.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            className={`relative flex items-center p-4 rounded-xl border text-left transition-all ${theme === t.id
                                                ? 'border-accent bg-accent/5 ring-1 ring-accent'
                                                : 'border-theme hover:border-theme-secondary hover:bg-theme-tertiary/30'
                                                }`}
                                        >
                                            {/* Preview Swatches */}
                                            <div className="flex flex-col gap-1 mr-4 shrink-0">
                                                <div className="flex gap-1">
                                                    <div className="w-6 h-6 rounded-full border border-gray-500/20" style={{ backgroundColor: t.colors[0] }}></div>
                                                    <div className="w-6 h-6 rounded-full border border-gray-500/20" style={{ backgroundColor: t.colors[1] }}></div>
                                                </div>
                                                <div className="w-13 h-2 rounded-full" style={{ backgroundColor: t.colors[2] }}></div>
                                            </div>

                                            <div className="flex-1">
                                                <div className="font-medium">{t.name}</div>
                                                <div className="text-xs text-theme-secondary mt-0.5">{t.description}</div>
                                            </div>

                                            {theme === t.id && (
                                                <div className="text-accent bg-accent/10 p-1 rounded-full">
                                                    <Check size={16} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentTab === 'collections' && (
                            <div className="text-center py-20 text-theme-secondary">
                                <Folder size={48} className="mx-auto mb-4 opacity-20" />
                                <p>收藏集高级管理功能开发中...</p>
                                <p className="text-xs mt-2">目前请在侧边栏进行基础管理</p>
                            </div>
                        )}

                        {currentTab === 'general' && (
                            <div className="text-center py-20 text-theme-secondary">
                                <p>通用设置开发中...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
