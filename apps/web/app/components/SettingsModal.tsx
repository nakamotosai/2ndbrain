'use client';

import { useState, useEffect } from 'react';
import { X, Trash2, RefreshCw, Folder, Hash, Palette, Check, Sun, Moon } from 'lucide-react';
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
    const isDark = theme === 'dark';

    useEffect(() => {
        if (activeTab) setCurrentTab(activeTab);
    }, [activeTab]);

    // 只保留两种主题
    const themes: { id: Theme; name: string; description: string; icon: React.ReactNode; colors: string[] }[] = [
        {
            id: 'light',
            name: '沉浸阅读',
            description: '温暖纸张色调，舒适护眼，专注阅读体验',
            icon: <Sun size={20} />,
            colors: ['#FAF8F5', '#F5F2ED', '#C4956A']
        },
        {
            id: 'dark',
            name: '磨砂玻璃',
            description: '现代深色界面，无边框设计，发光强调',
            icon: <Moon size={20} />,
            colors: ['#000000', '#121214', '#F472B6']
        },
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className={`rounded-xl shadow-2xl w-[700px] h-[500px] flex flex-col overflow-hidden ${isDark ? 'bg-[#1a1a1c] text-white border border-white/10' : 'bg-white text-[#2D2A26] border border-[#EBE7E0]'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between p-4 ${isDark ? 'border-b border-white/10' : 'border-b border-[#EBE7E0]'}`}>
                    <h2 className="text-lg font-semibold">设置与管理</h2>
                    <button onClick={onClose} className={`${isDark ? 'text-white/50 hover:text-white' : 'text-[#9A9590] hover:text-[#2D2A26]'} transition-colors`}>
                        <X size={20} />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className={`w-44 p-2 space-y-1 ${isDark ? 'bg-black/30 border-r border-white/10' : 'bg-[#F5F2ED] border-r border-[#EBE7E0]'}`}>
                        <button
                            onClick={() => setCurrentTab('appearance')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'appearance'
                                ? (isDark ? 'bg-[#F472B6]/15 text-[#F472B6] font-medium' : 'bg-[#C4956A]/15 text-[#8B6914] font-medium')
                                : (isDark ? 'text-white/60 hover:bg-white/5 hover:text-white/80' : 'text-[#6B6560] hover:bg-[#EBE7E0] hover:text-[#2D2A26]')}`}
                        >
                            <Palette size={16} />
                            <span>界面外观</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('collections')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'collections'
                                ? (isDark ? 'bg-[#F472B6]/15 text-[#F472B6] font-medium' : 'bg-[#C4956A]/15 text-[#8B6914] font-medium')
                                : (isDark ? 'text-white/60 hover:bg-white/5 hover:text-white/80' : 'text-[#6B6560] hover:bg-[#EBE7E0] hover:text-[#2D2A26]')}`}
                        >
                            <Folder size={16} />
                            <span>收藏集管理</span>
                        </button>
                        <button
                            onClick={() => setCurrentTab('general')}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${currentTab === 'general'
                                ? (isDark ? 'bg-[#F472B6]/15 text-[#F472B6] font-medium' : 'bg-[#C4956A]/15 text-[#8B6914] font-medium')
                                : (isDark ? 'text-white/60 hover:bg-white/5 hover:text-white/80' : 'text-[#6B6560] hover:bg-[#EBE7E0] hover:text-[#2D2A26]')}`}
                        >
                            <span className="text-sm">⚙️</span>
                            <span>通用设置</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className={`flex-1 p-6 overflow-y-auto ${isDark ? 'bg-[#0a0a0b]' : 'bg-[#FAF8F5]'}`}>
                        {currentTab === 'appearance' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-medium mb-1">主题风格</h3>
                                    <p className={`text-sm ${isDark ? 'text-white/50' : 'text-[#6B6560]'}`}>选择最适合你的阅读与工作环境</p>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {themes.map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTheme(t.id)}
                                            className={`relative flex items-center p-5 rounded-xl border text-left transition-all ${theme === t.id
                                                ? (isDark ? 'border-[#F472B6] bg-[#F472B6]/10 ring-1 ring-[#F472B6]' : 'border-[#C4956A] bg-[#C4956A]/10 ring-1 ring-[#C4956A]')
                                                : (isDark ? 'border-white/10 hover:border-white/20 hover:bg-white/5' : 'border-[#EBE7E0] hover:border-[#D5D0C8] hover:bg-[#F5F2ED]')
                                                }`}
                                        >
                                            {/* Icon */}
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center mr-4 shrink-0 ${t.id === 'dark' ? 'bg-black text-[#F472B6]' : 'bg-[#FAF8F5] text-[#C4956A] border border-[#EBE7E0]'
                                                }`}>
                                                {t.icon}
                                            </div>

                                            <div className="flex-1">
                                                <div className="font-medium text-base">{t.name}</div>
                                                <div className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-[#6B6560]'}`}>{t.description}</div>
                                                {/* Color Preview */}
                                                <div className="flex gap-1.5 mt-2">
                                                    {t.colors.map((color, i) => (
                                                        <div key={i} className="w-4 h-4 rounded-full border border-gray-500/20" style={{ backgroundColor: color }}></div>
                                                    ))}
                                                </div>
                                            </div>

                                            {theme === t.id && (
                                                <div className={`p-1.5 rounded-full ${isDark ? 'text-[#F472B6] bg-[#F472B6]/20' : 'text-[#C4956A] bg-[#C4956A]/20'}`}>
                                                    <Check size={16} />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentTab === 'collections' && (
                            <div className={`text-center py-16 ${isDark ? 'text-white/40' : 'text-[#9A9590]'}`}>
                                <Folder size={48} className="mx-auto mb-4 opacity-30" />
                                <p>收藏集高级管理功能开发中...</p>
                                <p className="text-xs mt-2 opacity-70">目前请在侧边栏进行基础管理</p>
                            </div>
                        )}

                        {currentTab === 'general' && (
                            <div className={`text-center py-16 ${isDark ? 'text-white/40' : 'text-[#9A9590]'}`}>
                                <p>通用设置开发中...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
