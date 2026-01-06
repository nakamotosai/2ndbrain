'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Clock, Tag, FileText, Twitter, Youtube, Globe, TrendingUp, Activity, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

interface DashboardStats {
    totalNotes: number;
    todayNotes: number;
    weekNotes: number;
    sourceStats: { twitter: number; youtube: number; web: number; other: number };
    topTags: { name: string; count: number }[];
    recentActivity: { date: string; count: number }[];
}

interface DashboardProps {
    onClose: () => void;
}

export function Dashboard({ onClose }: DashboardProps) {
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStats() {
            try {
                const res = await fetch('/api/notes');
                const data = await res.json();
                const notes = data.notes || [];

                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

                const todayNotes = notes.filter((n: any) => new Date(n.created_at) >= today).length;
                const weekNotes = notes.filter((n: any) => new Date(n.created_at) >= weekAgo).length;

                const sourceStats = {
                    twitter: notes.filter((n: any) => n.source_type === 'twitter').length,
                    youtube: notes.filter((n: any) => n.source_type === 'youtube').length,
                    web: notes.filter((n: any) => n.source_type === 'web').length,
                    other: notes.filter((n: any) => !['twitter', 'youtube', 'web'].includes(n.source_type)).length,
                };

                const tagCounts: Record<string, number> = {};
                notes.forEach((n: any) => { (n.tags || []).forEach((t: any) => { tagCounts[t.name] = (tagCounts[t.name] || 0) + 1; }); });
                const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

                const recentActivity: { date: string; count: number }[] = [];
                for (let i = 6; i >= 0; i--) {
                    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
                    const dateStr = date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
                    const count = notes.filter((n: any) => new Date(n.created_at).toDateString() === date.toDateString()).length;
                    recentActivity.push({ date: dateStr, count });
                }

                setStats({ totalNotes: notes.length, todayNotes, weekNotes, sourceStats, topTags, recentActivity });
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        }
        fetchStats();
    }, []);

    const colors = {
        bg: isDark ? 'bg-black' : 'bg-[#FAF8F5]',
        headerBg: isDark ? 'bg-black/40 backdrop-blur-xl' : 'bg-[#FAF8F5] border-b border-[#EBE7E0]/50',
        text: isDark ? 'text-white/85' : 'text-[#2D2A26]',
        textSec: isDark ? 'text-white/50' : 'text-[#6B6560]',
        textMuted: isDark ? 'text-white/30' : 'text-[#9A9590]',
        accent: isDark ? '#F472B6' : '#C4956A',
        cardBg: isDark ? 'bg-white/[0.02]' : 'bg-white shadow-sm',
        barBg: isDark ? 'bg-white/[0.04]' : 'bg-[#EBE7E0]',
    };

    if (loading) {
        return (
            <div className={`flex-1 flex items-center justify-center ${colors.bg}`}>
                <div className={`animate-spin rounded-full h-6 w-6 border-2 border-t-transparent`} style={{ borderColor: colors.accent }} />
            </div>
        );
    }

    if (!stats) return <div className={`flex-1 flex items-center justify-center ${colors.textMuted}`}>加载失败</div>;

    const maxActivity = Math.max(...stats.recentActivity.map(a => a.count), 1);

    return (
        <div className={`flex-1 flex flex-col overflow-hidden ${colors.bg}`}>
            {/* Header */}
            <header className={`p-4 shrink-0 flex items-center justify-between ${colors.headerBg}`}>
                <div className="flex items-center gap-2">
                    <BarChart3 size={18} style={{ color: colors.accent }} />
                    <h1 className={`text-base font-medium ${colors.text}`}>数据仪表盘</h1>
                </div>
                <button onClick={onClose} className={`p-1 transition-colors ${colors.textMuted} hover:${colors.textSec}`}>
                    <X size={16} />
                </button>
            </header>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5">
                <div className="max-w-3xl mx-auto space-y-5">

                    {/* Stats Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-[#F472B6]/10' : 'bg-[#C4956A]/10'}`}>
                            <div className="flex items-center gap-1.5 mb-1.5" style={{ color: colors.accent }}>
                                <FileText size={14} />
                                <span className="text-[10px] font-medium uppercase opacity-70">总笔记</span>
                            </div>
                            <p className={`text-2xl font-bold ${colors.text}`}>{stats.totalNotes}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-emerald-500/10' : 'bg-emerald-500/10'}`}>
                            <div className="flex items-center gap-1.5 text-emerald-500 mb-1.5">
                                <TrendingUp size={14} />
                                <span className="text-[10px] font-medium uppercase opacity-70">今日</span>
                            </div>
                            <p className={`text-2xl font-bold ${colors.text}`}>{stats.todayNotes}</p>
                        </div>
                        <div className={`p-4 rounded-xl ${isDark ? 'bg-blue-500/10' : 'bg-blue-500/10'}`}>
                            <div className="flex items-center gap-1.5 text-blue-500 mb-1.5">
                                <Clock size={14} />
                                <span className="text-[10px] font-medium uppercase opacity-70">本周</span>
                            </div>
                            <p className={`text-2xl font-bold ${colors.text}`}>{stats.weekNotes}</p>
                        </div>
                    </div>

                    {/* Activity Chart */}
                    <div className={`p-4 rounded-xl ${colors.cardBg}`}>
                        <div className={`flex items-center gap-1.5 mb-4 ${colors.textMuted}`}>
                            <Activity size={14} />
                            <span className="text-[10px] font-medium uppercase">7天活动</span>
                        </div>
                        <div className="flex items-end justify-between gap-2 h-24">
                            {stats.recentActivity.map((activity, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                    <div className="w-full rounded-t transition-all hover:opacity-80"
                                        style={{
                                            backgroundColor: colors.accent,
                                            height: `${Math.max((activity.count / maxActivity) * 100, 4)}%`,
                                            minHeight: activity.count > 0 ? '6px' : '2px'
                                        }}
                                    />
                                    <span className={`text-[9px] ${colors.textMuted}`}>{activity.date}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Source & Tags */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className={`p-4 rounded-xl ${colors.cardBg}`}>
                            <span className={`text-[10px] font-medium uppercase ${colors.textMuted}`}>来源分布</span>
                            <div className="mt-3 space-y-2.5">
                                {[
                                    { icon: Twitter, label: '推特', count: stats.sourceStats.twitter, color: '#1DA1F2' },
                                    { icon: Youtube, label: '视频', count: stats.sourceStats.youtube, color: '#FF0000' },
                                    { icon: Globe, label: '网页', count: stats.sourceStats.web, color: '#10B981' },
                                ].map(({ icon: Icon, label, count, color }) => (
                                    <div key={label} className="flex items-center gap-2">
                                        <Icon size={12} style={{ color }} />
                                        <div className="flex-1">
                                            <div className={`flex justify-between text-[10px] mb-0.5 ${colors.textSec}`}>
                                                <span>{label}</span>
                                                <span>{count}</span>
                                            </div>
                                            <div className={`h-1 rounded-full overflow-hidden ${colors.barBg}`}>
                                                <div className="h-full rounded-full" style={{ width: `${(count / stats.totalNotes) * 100}%`, backgroundColor: color }} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`p-4 rounded-xl ${colors.cardBg}`}>
                            <div className={`flex items-center gap-1.5 mb-3 ${colors.textMuted}`}>
                                <Tag size={12} />
                                <span className="text-[10px] font-medium uppercase">热门标签</span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                                {stats.topTags.map((tag, i) => (
                                    <span key={tag.name}
                                        className={`px-2 py-0.5 rounded-full text-[10px] font-medium`}
                                        style={{
                                            backgroundColor: i === 0 ? colors.accent : isDark ? 'rgba(255,255,255,0.06)' : '#EBE7E0',
                                            color: i === 0 ? 'white' : isDark ? 'rgba(255,255,255,0.5)' : '#6B6560'
                                        }}
                                    >
                                        {tag.name}
                                    </span>
                                ))}
                                {stats.topTags.length === 0 && <p className={`text-[10px] ${colors.textMuted}`}>无</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
