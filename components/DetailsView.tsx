
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { X, Play, Star, Calendar, Clock, Youtube, Globe, Download, ExternalLink, RefreshCw, Database, Film, Tv, Server, ChevronLeft, ChevronRight, MonitorPlay, ShieldCheck, ShieldAlert, Radio, ArrowDown, Info, Plug } from 'lucide-react';
import { MediaItem, MediaType, TorrentSource } from '../types';
import { fetchExtendedMeta, aggregateTorrents } from '../services/geminiService';
import { TorrentList } from './TorrentList';
import { AddonResults } from './AddonResults';
import { fetchAddonStreams, StremioStream } from '../services/addonService';
import { WebtorPlayer } from './WebtorPlayer';
import { TorrentPlayer } from './TorrentPlayer';



interface DetailsViewProps {
  item: MediaItem;
  onClose: () => void;
}

export const DetailsView: React.FC<DetailsViewProps> = ({ item, onClose }) => {
  const [details, setDetails] = useState<MediaItem>(item);
  const [torrentsLoading, setTorrentsLoading] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [activeTab, setActiveTab] = useState<'STREAM' | 'TORRENTS' | 'WEBTORRENT' | 'ADDONS'>('STREAM');
  const [streamSource, setStreamSource] = useState(0);

  // Series State
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);

  // Webtor State
  const [activeMagnet, setActiveMagnet] = useState<string | null>(null);
  const [streamEngine, setStreamEngine] = useState<'webtor' | 'backend'>('webtor');
  const streamIframeRef = useRef<HTMLIFrameElement>(null);

  // Addon State
  const [addonStreams, setAddonStreams] = useState<StremioStream[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);
  const [directStreamUrl, setDirectStreamUrl] = useState<string | null>(null);

  // Comprehensive popup and redirect blocker (NO SANDBOX)
  useEffect(() => {
    // 1. Block window.open (popups)
    const originalOpen = window.open;
    window.open = function (...args) {
      console.log('🚫 Blocked popup:', args[0]);
      return null;
    };

    // 2. Block location changes
    let currentLocation = window.location.href;
    const locationGuard = setInterval(() => {
      if (window.location.href !== currentLocation) {
        console.log('🚫 Prevented redirect from:', window.location.href, 'to:', currentLocation);
        window.history.pushState(null, '', currentLocation);
      }
    }, 100);

    // 3. Block navigation events
    const blockNavigation = (e: BeforeUnloadEvent) => {
      const fromIframe = e.target !== window.document;
      if (fromIframe) {
        e.preventDefault();
        e.returnValue = '';
        console.log('🚫 Blocked navigation from iframe');
        return false;
      }
    };

    // 4. Intercept iframe creations and block their navigation
    const originalCreateElement = document.createElement;
    document.createElement = function (tagName: string, ...args: any[]) {
      const element = originalCreateElement.call(document, tagName, ...args);
      if (tagName.toLowerCase() === 'iframe') {
        element.addEventListener('load', () => {
          try {
            // Block iframe's window.open
            if (element instanceof HTMLIFrameElement && element.contentWindow) {
              element.contentWindow.open = function () {
                console.log('🚫 Blocked iframe popup');
                return null;
              };
            }
          } catch (e) {
            // Cross-origin restrictions prevent this, which is fine
          }
        });
      }
      return element;
    };

    window.addEventListener('beforeunload', blockNavigation);

    return () => {
      window.open = originalOpen;
      clearInterval(locationGuard);
      window.removeEventListener('beforeunload', blockNavigation);
      document.createElement = originalCreateElement;
    };
  }, []);

  // Load Data
  useEffect(() => {
    let mounted = true;

    // 1. Instant: Set initial item
    setDetails(item);
    setTorrentsLoading(true);

    // 2. Fast: Fetch Extended Metadata (Cinemeta/Jikan)
    const loadMeta = async () => {
      try {
        const metaUpdates = await fetchExtendedMeta(item);
        if (mounted && metaUpdates) {
          setDetails(prev => ({ ...prev, ...metaUpdates }));
        }
      } catch (e) { console.error(e); }
    };

    // 3. Slower: Fetch Torrents
    const loadTorrents = async () => {
      try {
        const foundTorrents = await aggregateTorrents(item);
        if (mounted) {
          setDetails(prev => ({ ...prev, torrents: foundTorrents }));
          setTorrentsLoading(false);
        }
      } catch (e) {
        if (mounted) setTorrentsLoading(false);
      }
    };

    loadMeta();
    loadTorrents();

    return () => {
      mounted = false;
    };
  }, [item]);

  // Fetch Addons when tab is active or parameters change
  useEffect(() => {
    if (activeTab === 'ADDONS') {
      const loadAddons = async () => {
        setAddonsLoading(true);
        try {
          const streams = await fetchAddonStreams(
            details.type,
            details.imdbId || '',
            season,
            episode
          );
          setAddonStreams(streams);
        } catch (e) {
          console.error(e);
        } finally {
          setAddonsLoading(false);
        }
      };
      loadAddons();
    }
  }, [activeTab, details.imdbId, season, episode]);

  const bestSourceLink = useMemo(() => {
    if (!details.torrents || details.torrents.length === 0) return undefined;
    const sorted = [...details.torrents].sort((a, b) => (b.seeds || 0) - (a.seeds || 0));
    const best = sorted[0];
    if (best && best.magnet) {
      let finalLink = best.magnet.trim();
      const trackers = [
        "wss://tracker.btorrent.xyz",
        "wss://tracker.openwebtorrent.com",
        "udp://open.demonii.com:1337/announce",
        "udp://tracker.openbittorrent.com:80",
      ];
      const trParams = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');

      // If it's a raw hash, construct it
      if (!finalLink.startsWith('magnet:') && !finalLink.startsWith('http')) {
        finalLink = `magnet:?xt=urn:btih:${finalLink}&dn=${encodeURIComponent(details.title)}${trParams}`;
      } else if (finalLink.startsWith('magnet:') && !finalLink.includes('tracker.btorrent.xyz')) {
        finalLink += trParams;
      }
      return finalLink;
    }
    return undefined;
  }, [details.torrents, details.title]);

  // --- WEBTORRENT HANDLER ---
  const handleWebTorrentStream = (magnet: string) => {
    setActiveTab('WEBTORRENT');
    setActiveMagnet(magnet);
  };

  const handleAddonPlay = (stream: StremioStream) => {
    if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.title || details.title)}`;
      handleWebTorrentStream(magnet);
    } else if (stream.url) {
      setDirectStreamUrl(stream.url);
      setActiveTab('STREAM');
    }
  };

  // --- STREAMING ENGINE ---
  const getStreamUrl = () => {
    if (!details.imdbId) return '';
    const id = details.imdbId;
    const isSeries = details.type === MediaType.SERIES || details.type === MediaType.ANIME;

    switch (streamSource) {
      case 0: // VidSrc.pro (Most Reliable)
        return isSeries
          ? `https://vidsrc.pro/embed/tv/${id}/${season}/${episode}`
          : `https://vidsrc.pro/embed/movie/${id}`;

      case 1: // VidSrc.cc
        return isSeries
          ? `https://vidsrc.cc/v2/embed/tv/${id}/${season}/${episode}`
          : `https://vidsrc.cc/v2/embed/movie/${id}`;

      case 2: // 2embed.cc
        return isSeries
          ? `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`
          : `https://www.2embed.cc/embed/${id}`;

      case 3: // AutoEmbed
        return isSeries
          ? `https://autoembed.cc/tv/imdb/${id}-${season}-${episode}`
          : `https://autoembed.cc/movie/imdb/${id}`;

      case 4: // NontonGo
        return isSeries
          ? `https://nontongooo.com/embed/imdb/tv?id=${id}&sea=${season}&epi=${episode}`
          : `https://nontongooo.com/embed/imdb/movie?id=${id}`;

      case 5: // Embed.su
        return isSeries
          ? `https://embed.su/embed/tv/${id}/${season}/${episode}`
          : `https://embed.su/embed/movie/${id}`;

      case 6: // VidSrc.vip
        return isSeries
          ? `https://vidsrc.vip/embed/tv/${id}/${season}/${episode}`
          : `https://vidsrc.vip/embed/movie/${id}`;

      case 7: // Multiembed
        return isSeries
          ? `https://multiembed.mov/?video_id=${id}&s=${season}&e=${episode}`
          : `https://multiembed.mov/?video_id=${id}`;

      default:
        return `https://vidsrc.pro/embed/movie/${id}`;
    }
  };

  const streamServers = [
    { name: 'VidSrc.pro', id: 0, label: 'Best', safe: true },
    { name: 'VidSrc.cc', id: 1, label: 'HD', safe: true },
    { name: '2Embed', id: 2, label: 'Fast', safe: false },
    { name: 'AutoEmbed', id: 3, label: 'Multi', safe: false },
    { name: 'NontonGo', id: 4, label: 'Backup', safe: false },
    { name: 'Embed.su', id: 5, label: 'Premium', safe: true },
    { name: 'VidSrc.vip', id: 6, label: 'VIP', safe: false },
    { name: 'Multiembed', id: 7, label: 'All', safe: false },
  ];


  const handleEpisodeChange = (delta: number) => {
    const nextEp = episode + delta;
    if (nextEp > 0) setEpisode(nextEp);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-2 md:p-4 overflow-hidden">
      <div
        className="absolute inset-0 bg-slate-950/95 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-7xl bg-slate-900 rounded-none sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-800 h-full max-h-[98vh] flex flex-col">

        {/* Header / Backdrop Area - SMALLER */}
        <div className="relative h-32 md:h-40 shrink-0 bg-slate-950">
          <div className="absolute inset-0">
            <img
              src={details.backdropUrl || details.posterUrl}
              alt={details.title}
              className="w-full h-full object-cover opacity-40"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/70 to-transparent"></div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 hover:bg-white/10 text-slate-200 transition-colors backdrop-blur-md border border-white/5"
          >
            <X className="h-6 w-6" />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 flex items-end">
            <div className="hidden md:block w-20 h-28 mr-4 mb-1 rounded-lg shadow-2xl border-2 border-slate-800 overflow-hidden relative z-10 bg-slate-800">
              <img
                src={details.posterUrl}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x450?text=No+Cover'; }}
              />
            </div>
            <div className="flex-1 mb-1">
              <div className="flex items-center space-x-2 text-cyan-400 text-xs font-bold tracking-wider uppercase mb-1">
                <span>{details.type}</span>
                <span>•</span>
                <span>{details.status || 'Released'}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold text-white mb-1 text-shadow-lg leading-tight truncate pr-4">{details.title}</h1>
              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
                <span className="flex items-center text-yellow-400 font-bold">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  {details.rating > 0 ? details.rating.toFixed(1) : 'N/A'}
                </span>
                <span className="flex items-center">
                  <Calendar className="h-3 w-3 mr-1.5 opacity-70" />
                  {details.year}
                </span>
                {details.runtime && (
                  <span className="flex items-center">
                    <Clock className="h-3 w-3 mr-1.5 opacity-70" />
                    {details.runtime}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-900">
          <div className="flex flex-col md:flex-row gap-6 p-4 md:p-6">

            {/* Left Column: Player & Sources */}
            <div className="md:w-3/4 space-y-6">

              {/* Tabs */}
              <div className="flex items-center space-x-6 border-b border-slate-800 pb-1 overflow-x-auto">
                <button
                  onClick={() => setActiveTab('STREAM')}
                  className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'STREAM' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  <MonitorPlay className="h-4 w-4 mr-2" />
                  Cloud Stream
                </button>
                <button
                  onClick={() => setActiveTab('WEBTORRENT')}
                  className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'WEBTORRENT' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  <Radio className="h-4 w-4 mr-2" />
                  Webtor P2P
                </button>
                <button
                  onClick={() => setActiveTab('TORRENTS')}
                  className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'TORRENTS' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  <Database className="h-4 w-4 mr-2" />
                  Torrent List
                </button>
                <button
                  onClick={() => setActiveTab('ADDONS')}
                  className={`pb-3 px-2 text-sm font-bold border-b-2 transition-colors flex items-center whitespace-nowrap ${activeTab === 'ADDONS' ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                >
                  <Plug className="h-4 w-4 mr-2" />
                  Add-on Results
                </button>
              </div>

              {activeTab === 'STREAM' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Player Container */}
                  <div className="bg-black rounded-xl overflow-hidden aspect-video border border-slate-800 relative shadow-2xl group z-0">
                    {details.imdbId ? (
                      <iframe
                        ref={streamIframeRef}
                        key={streamSource + season + episode}
                        src={directStreamUrl || getStreamUrl()}
                        className="w-full h-full"
                        allowFullScreen
                        referrerPolicy="no-referrer"
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      ></iframe>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500">
                        <Film className="h-12 w-12 mb-4 opacity-50" />
                        <p>Stream unavailable (Missing valid ID for this title)</p>
                        <p className="text-xs text-slate-600 mt-2">Try the Torrent List instead.</p>
                      </div>
                    )}
                  </div>

                  {/* Controls for Series */}
                  {(details.type === MediaType.SERIES || details.type === MediaType.ANIME) && (
                    <div className="flex items-center justify-between bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                      <div className="flex items-center space-x-4">
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Season</span>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => setSeason(Math.max(1, season - 1))} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-lg font-mono font-bold text-white w-6 text-center">{season}</span>
                            <button onClick={() => setSeason(season + 1)} className="p-1 hover:bg-slate-700 rounded"><ChevronRight className="h-4 w-4" /></button>
                          </div>
                        </div>
                        <div className="w-px h-8 bg-slate-700"></div>
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Episode</span>
                          <div className="flex items-center space-x-2">
                            <button onClick={() => handleEpisodeChange(-1)} className="p-1 hover:bg-slate-700 rounded"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-lg font-mono font-bold text-white w-6 text-center">{episode}</span>
                            <button onClick={() => handleEpisodeChange(1)} className="p-1 hover:bg-slate-700 rounded"><ChevronRight className="h-4 w-4" /></button>
                          </div>
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-sm text-white font-medium">Now Playing</p>
                        <p className="text-xs text-cyan-400">S{season} E{episode}</p>
                      </div>
                    </div>
                  )}

                  {/* Server Selector */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/20 p-4 rounded-xl border border-slate-800/50">
                    <div className="flex items-center space-x-2">
                      <Server className="h-4 w-4 text-cyan-500" />
                      <span className="text-sm font-semibold text-slate-300">Server Source</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {streamServers.map((server) => (
                        <button
                          key={server.id}
                          onClick={() => setStreamSource(server.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${streamSource === server.id
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                            }`}
                        >
                          {server.name} <span className="opacity-50 ml-1">[{server.label}]</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'WEBTORRENT' && (
                <div className="space-y-4 animate-fadeIn">
                  {/* Streaming Engine Selector */}
                  <div className="flex items-center gap-2 bg-gray-800/50 p-3 rounded-md border border-gray-700">
                    <span className="text-sm text-gray-400 font-medium">Streaming Engine:</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setStreamEngine('webtor')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${streamEngine === 'webtor'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                      >
                        Webtor (Full Featured)
                      </button>
                      <button
                        onClick={() => setStreamEngine('backend')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${streamEngine === 'backend'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                          }`}
                      >
                        Backend Stream (Fast)
                      </button>
                    </div>
                  </div>

                  {activeMagnet ? (
                    <div className="aspect-video w-full">
                      {streamEngine === 'webtor' ? (
                        <WebtorPlayer
                          magnet={activeMagnet}
                          poster={details.backdropUrl || details.posterUrl}
                          title={details.title}
                          imdbId={details.imdbId}
                        />
                      ) : (
                        <TorrentPlayer
                          magnet={activeMagnet}
                          title={details.title}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video bg-gray-900 border-2 border-dashed border-gray-800 rounded-md flex flex-col items-center justify-center text-gray-500 p-8 text-center">
                      <MonitorPlay className="h-16 w-16 mb-4 opacity-30" />
                      <p className="text-lg font-medium">No Torrent Selected</p>
                      <p className="text-sm mt-2 opacity-70">Select a torrent from the list to stream</p>
                    </div>
                  )}

                  <div className="p-4 bg-blue-600/10 border border-blue-600/20 rounded-md text-sm text-blue-200 flex items-start">
                    <ShieldCheck className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold mb-1">
                        {streamEngine === 'webtor' ? 'Webtor.io Streaming' : 'Backend Torrent Streaming'}
                      </p>
                      <p className="text-xs opacity-80">
                        {streamEngine === 'webtor'
                          ? 'Full-featured torrent player with subtitle support and advanced features.'
                          : 'Powered by real BitTorrent client on the backend server. Faster downloads and better performance.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'TORRENTS' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {bestSourceLink ? (
                      <>
                        <button
                          onClick={() => handleWebTorrentStream(bestSourceLink!)}
                          className="w-full bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:shadow-[0_0_30px_rgba(6,182,212,0.6)]"
                        >
                          <Play className="h-5 w-5 fill-current" />
                          <span>Stream Torrent</span>
                        </button>
                        <a
                          href={bestSourceLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center space-x-2 transition-all no-underline"
                        >
                          <Download className="h-5 w-5" />
                          <span>Download Magnet</span>
                        </a>
                      </>
                    ) : (
                      <button
                        disabled
                        className="flex-1 sm:flex-none bg-slate-800 text-slate-500 font-bold py-3 px-8 rounded-lg flex items-center justify-center space-x-2 cursor-not-allowed border border-slate-700"
                      >
                        <RefreshCw className={`h-5 w-5 ${torrentsLoading ? 'animate-spin' : ''}`} />
                        <span>{torrentsLoading ? 'Scanning Swarm...' : 'No Sources'}</span>
                      </button>
                    )}

                    {details.trailerVideoId && (
                      <button
                        onClick={() => setShowTrailer(true)}
                        className="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-6 rounded-lg border border-slate-700 flex items-center justify-center space-x-2 transition-colors"
                      >
                        <Youtube className="h-5 w-5 text-red-500" />
                        <span>Trailer</span>
                      </button>
                    )}
                  </div>

                  <div className="pt-2">
                    {torrentsLoading && (!details.torrents || details.torrents.length === 0) ? (
                      <div className="p-12 border border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center text-slate-500">
                        <RefreshCw className="h-10 w-10 mb-4 animate-spin text-cyan-500" />
                        <p className="text-lg font-medium text-slate-300">Aggregating Decentralized Networks...</p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
                          {['YTS', 'EZTV', '1337x', 'Nyaa', 'Knaben', 'BitSearch', 'TPB'].map(s => (
                            <span key={s} className="text-[10px] px-2 py-1 bg-slate-800 rounded text-slate-500">{s}</span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      details.torrents && details.torrents.length > 0 ? (
                        <TorrentList
                          torrents={details.torrents}
                          title={details.title}
                          onStream={handleWebTorrentStream}
                        />
                      ) : (
                        <div className="p-8 border border-dashed border-slate-700 rounded-xl text-center text-slate-500">
                          <Database className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                          <p>No active torrents found.</p>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'ADDONS' && (
                <AddonResults
                  streams={addonStreams}
                  loading={addonsLoading}
                  onPlay={handleAddonPlay}
                  onRefresh={() => {
                    // Trigger re-fetch
                    setAddonStreams([]);
                    // The effect will catch the empty array if we depended on it, but we don't.
                    // We can just call fetch again or toggle a refresh state.
                    // Simpler: just set activeTab to something else then back? No.
                    // Let's just manually call fetch here?
                    // Actually, we can just force the effect to run by clearing streams and maybe adding a refresh trigger to dependency?
                    // For now, let's just re-fetch directly.
                    setAddonsLoading(true);
                    fetchAddonStreams(details.type, details.imdbId || '', season, episode)
                      .then(setAddonStreams)
                      .finally(() => setAddonsLoading(false));
                  }}
                />
              )}

              {/* Synopsis */}
              <div className="space-y-4 pt-4 border-t border-slate-800/50">
                <h3 className="text-lg font-bold text-white">Overview</h3>
                <p className="text-slate-300 leading-relaxed text-base md:text-lg">
                  {details.description || "No synopsis available for this title."}
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  {details.genres.map(g => (
                    <span key={g} className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-xs font-medium text-slate-300">
                      {g}
                    </span>
                  ))}
                </div>
              </div>

            </div>

            {/* Right Column: Info */}
            <div className="md:w-1/4 space-y-6">
              <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-800/50">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                  <Globe className="h-3.5 w-3.5 mr-2 text-cyan-400" />
                  Metadata Info
                </h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-400">Source</span>
                    <span className="text-slate-200">{details.type === MediaType.ANIME ? 'MyAnimeList' : 'Cinemeta'}</span>
                  </div>
                  {details.imdbId && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-400">IMDB ID</span>
                      <a
                        href={`https://www.imdb.com/title/${details.imdbId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-cyan-500 font-mono hover:underline flex items-center"
                      >
                        {details.imdbId} <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {(details.cast || details.director) && (
                <div className="p-5 bg-slate-800/30 rounded-xl border border-slate-800/50 space-y-4">
                  {details.director && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Director</span>
                      <span className="text-slate-200 text-sm">{details.director}</span>
                    </div>
                  )}
                  {details.cast && details.cast.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1">Cast</span>
                      <div className="flex flex-wrap gap-1">
                        {details.cast.slice(0, 5).map(c => (
                          <span key={c} className="text-xs text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Overlay */}
      {
        showTrailer && details.trailerVideoId && (
          <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl aspect-video relative bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
              <button
                onClick={() => setShowTrailer(false)}
                className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/60 hover:bg-white/20 text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${details.trailerVideoId}?autoplay=1`}
                title="YouTube video player"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              ></iframe>
            </div>
          </div>
        )
      }
    </div >
  );
};
