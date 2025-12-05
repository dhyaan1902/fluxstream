import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import { Settings, X, Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EnhancedVideoPlayerProps {
    src: string;
    poster?: string;
    title?: string;
    subtitles?: Array<{
        src: string;
        label: string;
        language: string;
    }>;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
    startTime?: number;
    autoplay?: boolean;
}

export const EnhancedVideoPlayer: React.FC<EnhancedVideoPlayerProps> = ({
    src,
    poster,
    title,
    subtitles = [],
    onTimeUpdate,
    startTime = 0,
    autoplay = false
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        if (!videoRef.current) return;

        // Initialize Video.js
        const player = videojs(videoRef.current, {
            controls: false, // We'll use custom controls
            autoplay,
            preload: 'auto',
            fluid: true,
            responsive: true,
            playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
            html5: {
                vhs: {
                    overrideNative: true,
                    enableLowInitialPlaylist: true,
                },
                nativeAudioTracks: false,
                nativeVideoTracks: false
            }
        });

        playerRef.current = player;

        // Set source
        player.src({ src, type: 'application/x-mpegURL' });

        if (poster) {
            player.poster(poster);
        }

        // Add subtitles
        subtitles.forEach((subtitle, index) => {
            player.addRemoteTextTrack({
                kind: 'subtitles',
                src: subtitle.src,
                srclang: subtitle.language,
                label: subtitle.label,
                default: index === 0
            }, false);
        });

        // Event listeners
        player.on('play', () => setIsPlaying(true));
        player.on('pause', () => setIsPlaying(false));
        player.on('volumechange', () => {
            setVolume(player.volume());
            setIsMuted(player.muted());
        });
        player.on('timeupdate', () => {
            const current = player.currentTime();
            const dur = player.duration();
            setCurrentTime(current);
            setDuration(dur);
            if (onTimeUpdate) {
                onTimeUpdate(current, dur);
            }
        });
        player.on('ratechange', () => {
            setPlaybackRate(player.playbackRate());
        });
        player.on('fullscreenchange', () => {
            setIsFullscreen(player.isFullscreen());
        });

        // Seek to start time
        if (startTime > 0) {
            player.one('loadedmetadata', () => {
                player.currentTime(startTime);
            });
        }

        // Auto-hide controls
        let hideControlsTimeout: NodeJS.Timeout;
        const handleMouseMove = () => {
            setShowControls(true);
            clearTimeout(hideControlsTimeout);
            hideControlsTimeout = setTimeout(() => {
                if (isPlaying) {
                    setShowControls(false);
                }
            }, 3000);
        };

        const playerElement = player.el();
        playerElement.addEventListener('mousemove', handleMouseMove);
        playerElement.addEventListener('touchstart', handleMouseMove);

        // Keyboard shortcuts
        const handleKeyPress = (e: KeyboardEvent) => {
            if (e.target !== document.body) return;

            switch (e.key.toLowerCase()) {
                case ' ':
                case 'k':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'f':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'm':
                    e.preventDefault();
                    toggleMute();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    player.currentTime(Math.max(0, player.currentTime() - 10));
                    break;
                case 'arrowright':
                    e.preventDefault();
                    player.currentTime(Math.min(player.duration(), player.currentTime() + 10));
                    break;
                case 'arrowup':
                    e.preventDefault();
                    player.volume(Math.min(1, player.volume() + 0.1));
                    break;
                case 'arrowdown':
                    e.preventDefault();
                    player.volume(Math.max(0, player.volume() - 0.1));
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);

        return () => {
            document.removeEventListener('keydown', handleKeyPress);
            playerElement.removeEventListener('mousemove', handleMouseMove);
            playerElement.removeEventListener('touchstart', handleMouseMove);
            clearTimeout(hideControlsTimeout);
            if (playerRef.current) {
                playerRef.current.dispose();
            }
        };
    }, [src]);

    const togglePlay = () => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.pause();
            } else {
                playerRef.current.play();
            }
        }
    };

    const toggleMute = () => {
        if (playerRef.current) {
            playerRef.current.muted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        if (playerRef.current) {
            if (isFullscreen) {
                playerRef.current.exitFullscreen();
            } else {
                playerRef.current.requestFullscreen();
            }
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!playerRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        playerRef.current.currentTime(pos * duration);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        if (playerRef.current) {
            playerRef.current.volume(newVolume);
            if (newVolume > 0 && isMuted) {
                playerRef.current.muted(false);
            }
        }
    };

    const handlePlaybackRateChange = (rate: number) => {
        if (playerRef.current) {
            playerRef.current.playbackRate(rate);
            setShowSettings(false);
        }
    };

    const formatTime = (seconds: number) => {
        if (isNaN(seconds)) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div className="relative w-full h-full bg-black rounded-xl overflow-hidden group">
            <div data-vjs-player>
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered w-full h-full"
                />
            </div>

            {/* Custom Controls Overlay */}
            <AnimatePresence>
                {showControls && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 pointer-events-none"
                    >
                        {/* Title Bar */}
                        {title && (
                            <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-auto">
                                <h3 className="text-xl font-bold text-white">{title}</h3>
                            </div>
                        )}

                        {/* Bottom Controls */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/90 to-transparent pointer-events-auto">
                            {/* Progress Bar */}
                            <div
                                className="w-full h-2 bg-white/20 rounded-full mb-4 cursor-pointer hover:h-3 transition-all group/progress"
                                onClick={handleSeek}
                            >
                                <div
                                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full relative"
                                    style={{ width: `${(currentTime / duration) * 100}%` }}
                                >
                                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity shadow-lg" />
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    {/* Play/Pause */}
                                    <button
                                        onClick={togglePlay}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-6 h-6 text-white" />
                                        ) : (
                                            <Play className="w-6 h-6 text-white fill-white" />
                                        )}
                                    </button>

                                    {/* Volume */}
                                    <div className="flex items-center gap-2 group/volume">
                                        <button
                                            onClick={toggleMute}
                                            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                        >
                                            {isMuted || volume === 0 ? (
                                                <VolumeX className="w-5 h-5 text-white" />
                                            ) : (
                                                <Volume2 className="w-5 h-5 text-white" />
                                            )}
                                        </button>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={isMuted ? 0 : volume}
                                            onChange={handleVolumeChange}
                                            className="w-0 group-hover/volume:w-20 transition-all opacity-0 group-hover/volume:opacity-100"
                                        />
                                    </div>

                                    {/* Time */}
                                    <span className="text-sm text-white font-medium">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Settings */}
                                    <button
                                        onClick={() => setShowSettings(!showSettings)}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        <Settings className="w-5 h-5 text-white" />
                                    </button>

                                    {/* Fullscreen */}
                                    <button
                                        onClick={toggleFullscreen}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        {isFullscreen ? (
                                            <Minimize className="w-5 h-5 text-white" />
                                        ) : (
                                            <Maximize className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Settings Panel */}
                        {showSettings && (
                            <div className="absolute bottom-24 right-6 glass-panel p-4 min-w-[200px] pointer-events-auto">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-white">Playback Speed</h4>
                                    <button onClick={() => setShowSettings(false)}>
                                        <X className="w-4 h-4 text-slate-400" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(rate => (
                                        <button
                                            key={rate}
                                            onClick={() => handlePlaybackRateChange(rate)}
                                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${playbackRate === rate
                                                    ? 'bg-cyan-500/20 text-cyan-400'
                                                    : 'text-slate-300 hover:bg-white/10'
                                                }`}
                                        >
                                            {rate}x {rate === 1 && '(Normal)'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
