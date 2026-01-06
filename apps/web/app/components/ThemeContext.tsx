'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

// 只保留两种主题：light (沉浸阅读) 和 dark (磨砂玻璃)
export type Theme = 'light' | 'dark';
export type AppFont = 'sans' | 'serif';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    font: AppFont;
    setFont: (font: AppFont) => void;
    toggleTheme: () => void;
    mounted: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('dark');
    const [font, setFont] = useState<AppFont>('sans');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Load saved theme and font
        const savedTheme = localStorage.getItem('app-theme');
        const savedFont = localStorage.getItem('app-font');

        // 迁移旧主题到新系统
        if (savedTheme === 'glass' || savedTheme === 'obsidian') {
            setTheme('dark');
            localStorage.setItem('app-theme', 'dark'); // 立即更新存储
        } else if (savedTheme === 'zen' || savedTheme === 'card' || savedTheme === 'focus') {
            setTheme('light');
            localStorage.setItem('app-theme', 'light'); // 立即更新存储
        } else if (savedTheme === 'light' || savedTheme === 'dark') {
            setTheme(savedTheme);
        }

        if (savedFont === 'sans' || savedFont === 'serif') {
            setFont(savedFont);
        }

        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        // Apply theme and font to document
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-font', font);
        localStorage.setItem('app-theme', theme);
        localStorage.setItem('app-font', font);
    }, [theme, font, mounted]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    // 在 mounted 之前使用默认主题值，避免 hydration 不匹配
    const value = {
        theme: mounted ? theme : 'dark',
        setTheme,
        font: mounted ? font : 'sans',
        setFont,
        toggleTheme,
        mounted
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
