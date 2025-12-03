import React, { useEffect, useState, useRef } from 'react';
import { Download, RefreshCw, Users, ArrowDown, AlertTriangle, Play } from 'lucide-react';

interface TorrentPlayerProps {
    magnet: string;
    title?: string;
}

interface TorrentFile {
    index: number;
    name: string;
    length: number;
    path: string;
}

interface TorrentStatus {
    downloaded: number;
    downloadSpeed: number;
    uploadSpeed: number;
    peers: number;
}

const API_BASE = 'http://localhost:3001/api/torrent';

export const TorrentPlayer: React.FC<TorrentPlayerProps> = ({ magnet, title }) => {
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
    const [torrentId, setTorrentId] = useState<string | null>(null);
    const [files, setFiles] = useState<TorrentFile[]>([]);
    const [selectedFile, setSelectedFile] = useState<number>(0);
    const [torrentStatus, setTorrentStatus] = useState<TorrentStatus | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Add torrent
    useEffect(() => {
        const addTorrent = async () => {
            try {
                const res = await fetch(`${API_BASE}/add`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ magnet })
                });

                if (!res.ok) throw new Error('Failed to add torrent');

                const data = await res.json();
                setTorrentId(data.id);
                setFiles(data.files);

                // Auto-select largest video file
                const videoFile = data.files.find((f: TorrentFile) =>
                    /\.(mp4|mkv|avi|webm|mov)$/i.test(f.name)
                ) || data.files.reduce((a: TorrentFile, b: TorrentFile) =>
                    a.length > b.length ? a : b
                );

                setSelectedFile(videoFile.index);
                setStatus('ready');
            } catch (err: any) {
                setStatus('error');
                setErrorMsg(err.message);
            }
        };

        addTorrent();

        return () => {
            // Cleanup: remove torrent on unmount
            if (torrentId) {
                fetch(`${API_BASE}/${torrentId}`, { method: 'DELETE' });
            }
        };
    }, [magnet]);

    // Poll status
    useEffect(() => {
        if (!torrentId) return;

        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API_BASE}/${torrentId}/status`);
                if (res.ok) {
                    const data = await res.json();
                    setTorrentStatus(data);
                }
            } catch (e) {
                console.error('Status fetch error:', e);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [torrentId]);

    const formatSize = (bytes: number) => {
        const mb = bytes / 1024 / 1024;
        return mb > 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(2)} MB`;
    };

    const formatSpeed = (bps: number) => {
        const kbps = bps / 1024;
        return kbps > 1024 ? `${(kbps / 1024).toFixed(2)} MB/s` : `${kbps.toFixed(2)} KB/s`;
    };

    return (
        <div className="w-full h-full bg-black rounded-md overflow-hidden relative" style={{ minHeight: '400px' }}>
            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white z-10">
                    <RefreshCw className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                    <p className="text-lg font-medium mb-2">Connecting to peers...</p>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black text-white z-10 p-8">
                    <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
                    <p className="text-lg font-medium mb-2">Failed to load torrent</p>
                    <p className="text-sm text-gray-400 text-center max-w-md">{errorMsg}</p>
                </div>
            )}

            {status === 'ready' && torrentId && (
                <>
                    {!isPlaying ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white z-10 p-8">
                            <div className="text-center mb-8">
                                <h3 className="text-xl font-bold mb-2">{title || files[selectedFile]?.name}</h3>
                                <p className="text-gray-400 text-sm">
                                    {formatSize(files[selectedFile]?.length || 0)} • {torrentStatus?.peers || 0} Peers
                                </p>
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => setIsPlaying(true)}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                                >
                                    <Play className="h-5 w-5 fill-current" />
                                    Stream Now
                                </button>
                                <a
                                    href={`${API_BASE}/${torrentId}/download/${selectedFile}`}
                                    download
                                    className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-all transform hover:scale-105"
                                >
                                    <Download className="h-5 w-5" />
                                    Download File
                                </a>
                            </div>
                        </div>
                    ) : (
                        <video
                            ref={videoRef}
                            controls
                            autoPlay
                            className="w-full h-full"
                            src={`${API_BASE}/${torrentId}/stream/${selectedFile}`}
                        />
                    )}

                    {/* Stats Overlay (Always visible when ready) */}
                    {torrentStatus && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-4 text-white text-xs pointer-events-none">
                            <div className="flex items-center justify-between">
                                <span>{isPlaying ? 'Streaming...' : 'Ready'}</span>
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1">
                                        <ArrowDown className="h-3 w-3" />
                                        {formatSpeed(torrentStatus.downloadSpeed)}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {torrentStatus.peers}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
