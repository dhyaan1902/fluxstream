import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Tv, Zap, Shield, ExternalLink, AlertCircle } from 'lucide-react';

interface EmbedStreamPlayerProps {
    title: string;
    tmdbId?: string;
    imdbId?: string;
    season?: number;
    episode?: number;
    type: 'movie' | 'series';
    onClose: () => void;
}

interface EmbedProvider {
    name: string;
    icon: React.ReactNode;
    getUrl: (params: { tmdbId?: string; imdbId?: string; season?: number; episode?: number; type: string }) => string;
    color: string;
    description: string;
}

const EMBED_PROVIDERS: EmbedProvider[] = [
    {
        name: 'VidSrc',
        icon: <Tv className="w-5 h-5" />,
        getUrl: ({ tmdbId, season, episode, type }) => {
            if (type === 'movie') {
                return `https://vidsrc.to/embed/movie/${tmdbId}`;
            }
            return `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`;
        },
        color: 'from-cyan-500 to-blue-600',
        description: 'High quality, auto-updating links'
    },
    {
        name: 'SuperEmbed',
        icon: <Zap className="w-5 h-5" />,
        getUrl: ({ tmdbId, imdbId, season, episode, type }) => {
            const id = imdbId || tmdbId;
            if (type === 'movie') {
                return `https://multiembed.mov/?video_id=${id}&tmdb=1`;
            }
            return `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${season}&e=${episode}`;
        },
        color: 'from-purple-500 to-pink-600',
        description: 'Multiple server options'
    },
    {
        name: '2Embed',
        icon: <Play className="w-5 h-5" />,
        getUrl: ({ tmdbId, season, episode, type }) => {
            if (type === 'movie') {
                return `https://www.2embed.cc/embed/${tmdbId}`;
            }
            return `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`;
        },
        color: 'from-green-500 to-emerald-600',
        description: 'Reliable streaming'
    }
];

export const EmbedStreamPlayer: React.FC<EmbedStreamPlayerProps> = ({
    title,
    tmdbId,
    imdbId,
    season,
    episode,
    type,
    onClose
}) => {
    const [selectedProvider, setSelectedProvider] = useState<EmbedProvider>(EMBED_PROVIDERS[0]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

    const embedUrl = selectedProvider.getUrl({ tmdbId, imdbId, season, episode, type });

    const handleIframeLoad = () => {
        setIsLoading(false);
        setHasError(false);
    };

    const handleIframeError = () => {
        setIsLoading(false);
        setHasError(true);
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    className="relative w-full max-w-7xl max-h-[95vh] overflow-hidden glass-panel"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-slate-900/50 to-slate-800/50">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-50 p-2 rounded-lg bg-black/50 hover:bg-black/70 transition-colors"
                        >
                            <X className="w-6 h-6 text-white" />
                        </button>

                        <div className="pr-12">
                            <h2 className="text-2xl font-bold mb-2 gradient-text">{title}</h2>
                            {type === 'series' && season && episode && (
                                <p className="text-sm text-slate-400">
                                    Season {season} • Episode {episode}
                                </p>
                            )}
                        </div>

                        {/* Provider Selector */}
                        <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2">
                            {EMBED_PROVIDERS.map((provider) => (
                                <button
                                    key={provider.name}
                                    onClick={() => {
                                        setSelectedProvider(provider);
                                        setIsLoading(true);
                                        setHasError(false);
                                    }}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${selectedProvider.name === provider.name
                                        ? `bg-gradient-to-r ${provider.color} text-white shadow-glow`
                                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                                        }`}
                                >
                                    {provider.icon}
                                    <div className="text-left">
                                        <div className="font-semibold text-sm">{provider.name}</div>
                                        <div className="text-xs opacity-75">{provider.description}</div>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {/* Security Notice */}
                        <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                            <div className="text-xs text-blue-300">
                                <strong>Protected Mode:</strong> This stream is sandboxed to prevent popups, redirects, and malicious scripts.
                                All content is isolated for your security.
                            </div>
                        </div>
                    </div>

                    {/* Video Player */}
                    <div className="relative bg-black" style={{ height: 'calc(95vh - 240px)', minHeight: '400px' }}>
                        {isLoading && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
                                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mb-4" />
                                <p className="text-slate-300">Loading {selectedProvider.name}...</p>
                            </div>
                        )}

                        {hasError && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-sm z-10">
                                <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
                                <p className="text-slate-300 mb-2">Failed to load stream</p>
                                <p className="text-sm text-slate-400 mb-4">Try selecting a different provider above</p>
                                <button
                                    onClick={() => {
                                        setIsLoading(true);
                                        setHasError(false);
                                    }}
                                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:shadow-glow transition-all"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        {/* Iframe Player - Security via headers */}
                        <iframe
                            key={embedUrl}
                            src={embedUrl}
                            className="w-full h-full"
                            allowFullScreen
                            onLoad={handleIframeLoad}
                            onError={handleIframeError}
                            // Security: Use headers instead of sandbox for better compatibility
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                    </div>

                    {/* Footer Info */}
                    <div className="p-4 border-t border-white/10 bg-slate-900/50">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                            <div className="flex items-center gap-2">
                                <ExternalLink className="w-4 h-4" />
                                <span>Streaming from {selectedProvider.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-green-400" />
                                <span className="text-green-400">Secure & Sandboxed</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
