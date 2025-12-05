import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Download, Clock, HardDrive, Zap, Users } from 'lucide-react';

interface DashboardProps {
    onNavigate: (view: string) => void;
    onSelectMedia?: (item: any) => void;
}

interface Stats {
    cache: {
        totalSize: number;
        maxSize: number;
        usagePercent: number;
        items: number;
    };
    torrents: {
        active: number;
        total: number;
    };
    uptime: number;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onSelectMedia }) => {
    const [stats, setStats] = useState<Stats | null>(null);
    const [history, setHistory] = useState<any[]>([]);

    useEffect(() => {
        fetchStats();
        fetchHistory();
        const interval = setInterval(fetchStats, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/stats`);
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const fetchHistory = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/history?limit=6`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            }
        } catch (err) {
            console.error('Failed to fetch history:', err);
        }
    };

    const formatBytes = (bytes: number) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return gb.toFixed(2);
    };

    const formatUptime = (seconds: number) => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    };

    const statCards = [
        {
            title: 'Cache Usage',
            value: stats ? `${formatBytes(stats.cache.totalSize)} GB` : '0 GB',
            subtitle: `${stats?.cache.usagePercent.toFixed(1) || 0}% of 4 GB`,
            icon: HardDrive,
            gradient: 'from-cyan-500 to-blue-600',
            iconBg: 'bg-cyan-500/20',
        },
        {
            title: 'Active Torrents',
            value: stats?.torrents.active || 0,
            subtitle: `${stats?.torrents.total || 0} total cached`,
            icon: Zap,
            gradient: 'from-purple-500 to-pink-600',
            iconBg: 'bg-purple-500/20',
        },
        {
            title: 'Uptime',
            value: stats ? formatUptime(stats.uptime) : '0h 0m',
            subtitle: 'System running',
            icon: Clock,
            gradient: 'from-green-500 to-emerald-600',
            iconBg: 'bg-green-500/20',
        },
        {
            title: 'Watch History',
            value: history.length,
            subtitle: 'Items tracked',
            icon: TrendingUp,
            gradient: 'from-orange-500 to-red-600',
            iconBg: 'bg-orange-500/20',
        },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Welcome Header */}
            <div>
                <h1 className="text-4xl font-bold mb-2">
                    Welcome to <span className="gradient-text">FluxStream</span>
                </h1>
                <p className="text-slate-400 text-lg">Your personal streaming powerhouse</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <motion.div
                            key={card.title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="glass-panel p-6 hover:shadow-glow transition-all duration-300 group cursor-pointer"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${card.iconBg}`}>
                                    <Icon className={`w-6 h-6 bg-gradient-to-br ${card.gradient} bg-clip-text text-transparent`} style={{ WebkitTextFillColor: 'transparent' }} />
                                </div>
                            </div>
                            <h3 className="text-3xl font-bold mb-1 group-hover:text-cyan-400 transition-colors">
                                {card.value}
                            </h3>
                            <p className="text-sm text-slate-400 mb-1">{card.title}</p>
                            <p className="text-xs text-slate-500">{card.subtitle}</p>
                        </motion.div>
                    );
                })}
            </div>

            {/* Continue Watching */}
            {history.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-3">
                            <span className="w-2 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full" />
                            Continue Watching
                        </h2>
                        <button
                            onClick={() => onNavigate('HISTORY')}
                            className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                        >
                            View All →
                        </button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        {history.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="group cursor-pointer"
                                onClick={() => onSelectMedia && onSelectMedia(item)}
                            >
                                <div className="relative aspect-[2/3] rounded-xl overflow-hidden mb-3 bg-slate-800">
                                    {item.poster && (
                                        <img
                                            src={item.poster}
                                            alt={item.title}
                                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                        />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                                    {/* Progress Bar */}
                                    {item.duration > 0 && (
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700">
                                            <div
                                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                                                style={{ width: `${(item.playback_position / item.duration) * 100}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                                <h3 className="text-sm font-medium text-slate-200 line-clamp-2 group-hover:text-cyan-400 transition-colors">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">
                                    {item.episode_number ? `Episode ${item.episode_number}` : item.media_type}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 }}
                    className="glass-panel p-6 hover:shadow-glow transition-all cursor-pointer group"
                    onClick={() => onNavigate('DOWNLOADS')}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-xl bg-purple-500/20">
                            <Download className="w-8 h-8 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold group-hover:text-purple-400 transition-colors">
                                Download Manager
                            </h3>
                            <p className="text-sm text-slate-400">Manage your downloads and queue</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 }}
                    className="glass-panel p-6 hover:shadow-glow transition-all cursor-pointer group"
                    onClick={() => onNavigate('LIBRARY')}
                >
                    <div className="flex items-center gap-4">
                        <div className="p-4 rounded-xl bg-cyan-500/20">
                            <HardDrive className="w-8 h-8 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold group-hover:text-cyan-400 transition-colors">
                                Local Library
                            </h3>
                            <p className="text-sm text-slate-400">Browse your downloaded content</p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};
