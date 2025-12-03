import React, { useState } from 'react';
import { Play, Plus, Trash2, ExternalLink, HardDrive, Download, Magnet } from 'lucide-react';
import { StremioStream, StremioAddon, addAddon, removeAddon, getAddons } from '../services/addonService';

interface AddonResultsProps {
    streams: StremioStream[];
    loading: boolean;
    onPlay: (stream: StremioStream) => void;
    onRefresh: () => void;
}

export const AddonResults: React.FC<AddonResultsProps> = ({ streams, loading, onPlay, onRefresh }) => {
    const [newManifestUrl, setNewManifestUrl] = useState('');
    const [adding, setAdding] = useState(false);
    const [addons, setAddons] = useState<StremioAddon[]>(getAddons());
    const [error, setError] = useState<string | null>(null);

    const handleAddAddon = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newManifestUrl) return;

        setAdding(true);
        setError(null);
        try {
            await addAddon(newManifestUrl);
            setAddons(getAddons());
            setNewManifestUrl('');
            onRefresh(); // Refresh streams with new addon
        } catch (err) {
            setError('Failed to add addon. Check URL.');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveAddon = (id: string) => {
        removeAddon(id);
        setAddons(getAddons());
        onRefresh();
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Addon Management */}
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
                    <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center">
                        <HardDrive className="h-4 w-4 mr-2 text-cyan-400" />
                        Active Addons
                    </h3>
                    <form onSubmit={handleAddAddon} className="flex w-full sm:w-auto gap-2">
                        <input
                            type="url"
                            value={newManifestUrl}
                            onChange={(e) => setNewManifestUrl(e.target.value)}
                            placeholder="Manifest URL (e.g. https://.../manifest.json)"
                            className="flex-1 sm:w-64 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs text-white focus:border-cyan-500 outline-none"
                        />
                        <button
                            type="submit"
                            disabled={adding}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 py-1.5 rounded text-xs font-bold transition-colors disabled:opacity-50"
                        >
                            {adding ? '...' : <Plus className="h-4 w-4" />}
                        </button>
                    </form>
                </div>

                {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

                <div className="flex flex-wrap gap-2">
                    {addons.map(addon => (
                        <div key={addon.id} className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                            {addon.logo && <img src={addon.logo} alt="" className="w-4 h-4 mr-2 object-contain" />}
                            <div className="mr-3">
                                <p className="text-xs font-bold text-slate-200">{addon.name}</p>
                                <p className="text-[10px] text-slate-500 truncate max-w-[100px]">{addon.version}</p>
                            </div>
                            {addon.id !== 'com.stremio.torrentio.addon' && (
                                <button
                                    onClick={() => handleRemoveAddon(addon.id)}
                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Results List */}
            <div className="space-y-2">
                {loading ? (
                    <div className="text-center py-12 text-slate-500">
                        <div className="animate-spin h-8 w-8 border-2 border-cyan-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p>Fetching streams from addons...</p>
                    </div>
                ) : streams.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-700 rounded-xl text-slate-500">
                        <p>No streams found from active addons.</p>
                    </div>
                ) : (
                    streams.map((stream, idx) => (
                        <div
                            key={`${stream.addonName}-${idx}`}
                            className="group flex flex-col sm:flex-row items-start sm:items-center justify-between bg-slate-800/20 hover:bg-slate-800/50 border border-slate-700/50 hover:border-cyan-500/30 rounded-lg p-3 transition-all"
                        >
                            <div className="flex-1 min-w-0 mb-2 sm:mb-0 mr-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 text-[10px] font-bold border border-cyan-500/20">
                                        {stream.addonName}
                                    </span>
                                    {stream.name && (
                                        <span className="text-xs font-bold text-slate-300">
                                            {stream.name}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-400 font-mono truncate" title={stream.title}>
                                    {stream.title || stream.url || 'Unknown Stream'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => onPlay(stream)}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-cyan-900/20"
                                >
                                    <Play className="h-4 w-4" />
                                    <span>Play</span>
                                </button>
                                {stream.url && (
                                    <a
                                        href={stream.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                        title="Open Link"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                                {stream.infoHash && (
                                    <>
                                        <button
                                            onClick={() => {
                                                const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || 'video')}`;
                                                window.location.href = magnet;
                                            }}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                            title="Download via Torrent Client"
                                        >
                                            <Download className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || 'video')}`;
                                                navigator.clipboard.writeText(magnet);
                                            }}
                                            className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                                            title="Copy Magnet Link"
                                        >
                                            <Magnet className="h-4 w-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
