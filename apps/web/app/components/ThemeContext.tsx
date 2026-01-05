'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type Theme = 'zen' | 'obsidian' | 'card' | 'glass' | 'focus';
export type AppFont = 'sans' | 'serif';

interface ThemeContextType {
    theme: Theme;
    setTheme: (theme: Theme) => void;
    font: AppFont;
    setFont: (font: AppFont) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useState<Theme>('obsidian');
    const [font, setFont] = useState<AppFont>('sans');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        // Load saved theme and font
        const savedTheme = localStorage.getItem('app-theme') as Theme;
        const savedFont = localStorage.getItem('app-font') as AppFont;
        if (savedTheme) setTheme(savedTheme);
        if (savedFont) setFont(savedFont);
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;
        // Apply theme and font to HTML element
        document.documentElement.setAttribute('data-theme', theme);
        document.body.setAttribute('data-font', font);
        localStorage.setItem('app-theme', theme);
        localStorage.setItem('app-font', font);
    }, [theme, font, mounted]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, font, setFont }}>
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
