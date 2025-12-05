import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Pause, Play, X, Clock, HardDrive, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Download {
    id: number;
    media_id: string;
    media_type: string;
    title: string;
    magnet: string;
    status: 'queued' | 'downloading' | 'completed' | 'paused' | 'failed';
    priority: number;
    progress: number;
    file_size?: number;
    created_at: number;
}

export const DownloadsPanel: React.FC = () => {
    const [downloads, setDownloads] = useState<Download[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDownloads();
        const interval = setInterval(fetchDownloads, 2000);
        return () => clearInterval(interval);
    }, []);

    const fetchDownloads = async () => {
        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/downloads`);
            if (res.ok) {
                const data = await res.json();
                setDownloads(data);
            }
        } catch (err) {
            console.error('Failed to fetch downloads:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateDownloadStatus = async (id: number, status: string, progress?: number) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/downloads/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, progress })
            });
            fetchDownloads();
        } catch (err) {
            toast.error('Failed to update download');
        }
    };

    const deleteDownload = async (id: number) => {
        try {
            await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/downloads/${id}`, {
                method: 'DELETE'
            });
            toast.success('Download removed');
            fetchDownloads();
        } catch (err) {
            toast.error('Failed to delete download');
        }
    };

    const formatBytes = (bytes?: number) => {
        if (!bytes) return 'Unknown size';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return `${gb.toFixed(2)} GB`;
        const mb = bytes / (1024 * 1024);
        return `${mb.toFixed(2)} MB`;
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ago`;
        if (hours > 0) return `${hours}h ago`;
        if (minutes > 0) return `${minutes}m ago`;
        return 'Just now';
    };

    const activeDownloads = downloads.filter(d => d.status === 'downloading');
    const queuedDownloads = downloads.filter(d => d.status === 'queued');
    const completedDownloads = downloads.filter(d => d.status === 'completed');

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'downloading': return 'text-cyan-400';
            case 'completed': return 'text-green-400';
            case 'paused': return 'text-yellow-400';
            case 'failed': return 'text-red-400';
            default: return 'text-slate-400';
        }
    };

    const getStatusBg = (status: string) => {
        switch (status) {
            case 'downloading': return 'bg-cyan-500/20';
            case 'completed': return 'bg-green-500/20';
            case 'paused': return 'bg-yellow-500/20';
            case 'failed': return 'bg-red-500/20';
            default: return 'bg-slate-500/20';
        }
    };

    const DownloadCard = ({ download }: { download: Download }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            className="glass-panel p-4 hover:shadow-glow transition-all"
        >
            <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${getStatusBg(download.status)}`}>
                    <Download className={`w-5 h-5 ${getStatusColor(download.status)}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-200 truncate mb-1">{download.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                        <span className="capitalize">{download.media_type}</span>
                        <span>•</span>
                        <span>{formatBytes(download.file_size)}</span>
                        <span>•</span>
                        <span>{formatTime(download.created_at)}</span>
                    </div>

                    {/* Progress Bar */}
                    {download.status === 'downloading' && (
                        <div className="mb-2">
                            <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-slate-400">Progress</span>
                                <span className="text-cyan-400 font-semibold">{download.progress}%</span>
                            </div>
                            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${download.progress}%` }}
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getStatusBg(download.status)} ${getStatusColor(download.status)}`}>
                            {download.status}
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {download.status === 'downloading' && (
                        <button
                            onClick={() => updateDownloadStatus(download.id, 'paused')}
                            className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                            title="Pause"
                        >
                            <Pause className="w-4 h-4" />
                        </button>
                    )}
                    {download.status === 'paused' && (
                        <button
                            onClick={() => updateDownloadStatus(download.id, 'downloading')}
                            className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
                            title="Resume"
                        >
                            <Play className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={() => deleteDownload(download.id)}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </motion.div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold mb-2">
                    <span className="gradient-text">Downloads</span>
                </h1>
                <p className="text-slate-400 text-lg">Manage your download queue</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-panel p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-cyan-500/20">
                            <Download className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{activeDownloads.length}</p>
                            <p className="text-sm text-slate-400">Active</p>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                            <Clock className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{queuedDownloads.length}</p>
                            <p className="text-sm text-slate-400">Queued</p>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <HardDrive className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{completedDownloads.length}</p>
                            <p className="text-sm text-slate-400">Completed</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Active Downloads */}
            {activeDownloads.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full" />
                        Active Downloads
                    </h2>
                    <div className="space-y-3">
                        {activeDownloads.map(download => (
                            <DownloadCard key={download.id} download={download} />
                        ))}
                    </div>
                </div>
            )}

            {/* Queued Downloads */}
            {queuedDownloads.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-yellow-500 to-orange-600 rounded-full" />
                        Queued
                    </h2>
                    <div className="space-y-3">
                        {queuedDownloads.map(download => (
                            <DownloadCard key={download.id} download={download} />
                        ))}
                    </div>
                </div>
            )}

            {/* Completed Downloads */}
            {completedDownloads.length > 0 && (
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-6 bg-gradient-to-b from-green-500 to-emerald-600 rounded-full" />
                        Completed
                    </h2>
                    <div className="space-y-3">
                        {completedDownloads.map(download => (
                            <DownloadCard key={download.id} download={download} />
                        ))}
                    </div>
                </div>
            )}

            {downloads.length === 0 && (
                <div className="text-center py-20">
                    <Download className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">No downloads yet</h3>
                    <p className="text-slate-500">Start downloading content to see it here</p>
                </div>
            )}
        </div>
    );
};
