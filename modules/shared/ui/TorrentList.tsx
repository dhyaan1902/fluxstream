
import React from 'react';
import { Download, Magnet, HardDrive, ArrowUp, ArrowDown, PlayCircle } from 'lucide-react';
import { TorrentSource } from '../types';

interface TorrentListProps {
  torrents: TorrentSource[];
  title?: string;
  onStream?: (magnet: string) => void;
}

export const TorrentList: React.FC<TorrentListProps> = ({ torrents, title, onStream }) => {
  // Sanitize magnet links or construct them from hashes
  const getSafeMagnetLink = (magnet: string) => {
    if (!magnet) return undefined;
    const trimmed = magnet.trim();

    // Trackers List (UDP + WSS for WebTorrent)
    const trackers = [
      "wss://tracker.btorrent.xyz",
      "wss://tracker.openwebtorrent.com",
      "wss://tracker.webtorrent.dev",
      "udp://open.demonii.com:1337/announce",
      "udp://tracker.openbittorrent.com:80",
      "udp://tracker.opentrackr.org:1337/announce",
      "udp://p4p.arenabg.com:1337",
      "udp://tracker.leechers-paradise.org:6969"
    ];
    const trParams = trackers.map(t => `&tr=${encodeURIComponent(t)}`).join('');

    // If it's already a magnet link, ensure it has WSS trackers appended if missing
    if (trimmed.startsWith('magnet:')) {
      if (!trimmed.includes('tracker.btorrent.xyz')) {
        return trimmed + trParams;
      }
      return trimmed;
    }

    // If it's http, return as is
    if (trimmed.startsWith('http')) return trimmed;

    // YTS API returns raw hash, we need to construct the full magnet URI with trackers
    const dn = title ? `&dn=${encodeURIComponent(title)}` : '';
    return `magnet:?xt=urn:btih:${trimmed}${dn}${trParams}`;
  };

  // Helper to color code sources
  const getSourceColor = (source: string) => {
    const s = source.toLowerCase();
    if (s.includes('yts')) return 'text-green-400 bg-green-400/10 border-green-400/20';
    if (s.includes('nyaa')) return 'text-pink-400 bg-pink-400/10 border-pink-400/20';
    if (s.includes('eztv')) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    if (s.includes('tpb') || s.includes('api')) return 'text-yellow-600 bg-yellow-400/10 border-yellow-400/20';
    if (s.includes('solid')) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20';
    if (s.includes('bitsearch')) return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
    if (s.includes('magnetdl') || s.includes('mdl')) return 'text-red-400 bg-red-400/10 border-red-400/20';
    if (s.includes('knaben')) return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
    if (s.includes('glodls')) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (s.includes('torrentfunk')) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
    if (s.includes('torlock')) return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
    if (s.includes('zooqle')) return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
    return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
  };

  const getQualityColor = (quality: string) => {
    if (quality.includes('4K') || quality.includes('2160p')) return 'text-purple-400 border-purple-500/50';
    if (quality.includes('1080p')) return 'text-green-400 border-green-500/50';
    return 'text-slate-400 border-slate-600/50';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white flex items-center">
          <Magnet className="h-5 w-5 text-cyan-400 mr-2" />
          P2P Swarm
          <span className="ml-3 px-2 py-0.5 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700">
            {torrents.length} Sources
          </span>
        </h3>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-slate-950/50 border-b border-slate-800 text-xs font-medium text-slate-500 uppercase tracking-wider">
          <div className="col-span-6 sm:col-span-5">Release Name</div>
          <div className="col-span-2 hidden sm:block text-center">Size</div>
          <div className="col-span-2 hidden sm:block text-center">Seeds/Peers</div>
          <div className="col-span-6 sm:col-span-3 text-right">Action</div>
        </div>

        {/* Table Body */}
        <div className="divide-y divide-slate-800 max-h-96 overflow-y-auto custom-scrollbar">
          {torrents.map((torrent, idx) => {
            const safeLink = getSafeMagnetLink(torrent.magnet);

            return (
              <div
                key={idx}
                className="grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-slate-800/40 transition-colors group"
              >
                {/* Release Info */}
                <div className="col-span-6 sm:col-span-5 flex flex-col justify-center overflow-hidden">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSourceColor(torrent.source)}`}>
                      {torrent.source}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getQualityColor(torrent.quality)}`}>
                      {torrent.quality}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-slate-200 truncate pr-4" title={torrent.releaseTitle || safeLink}>
                    {torrent.releaseTitle || (torrent.uploader !== 'Unknown' && torrent.uploader ? `${torrent.uploader} • ` : '') + (torrent.source === 'YTS' ? `FluxStream.${torrent.quality}.YTS` : 'Decentralized Release')}
                  </span>
                </div>

                {/* Size */}
                <div className="col-span-2 hidden sm:flex items-center justify-center text-sm text-slate-400">
                  <HardDrive className="h-3.5 w-3.5 mr-1.5 text-slate-600" />
                  {torrent.size}
                </div>

                {/* Health */}
                <div className="col-span-2 hidden sm:flex items-center justify-center space-x-3 text-sm">
                  <span className="flex items-center text-green-400 font-medium">
                    <ArrowUp className="h-3.5 w-3.5 mr-1" />
                    {torrent.seeds}
                  </span>
                  <span className="flex items-center text-red-400/80">
                    <ArrowDown className="h-3.5 w-3.5 mr-1" />
                    {torrent.peers}
                  </span>
                </div>

                {/* Actions */}
                <div className="col-span-6 sm:col-span-3 flex justify-end items-center space-x-2">
                  {onStream && safeLink && safeLink.startsWith('magnet:') && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onStream(safeLink);
                      }}
                      className="p-2 rounded-lg text-cyan-400 bg-cyan-400/10 hover:bg-cyan-400/20 transition-colors"
                      title="Stream via WebTorrent (Browser)"
                    >
                      <PlayCircle className="h-4 w-4" />
                    </button>
                  )}
                  <a
                    href={safeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-cyan-400/10 transition-colors inline-flex items-center justify-jcenter"
                    title="Copy Magnet Link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Magnet className="h-4 w-4" />
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (safeLink) {
                        window.location.href = safeLink;
                      }
                    }}
                    className="flex items-center space-x-1.5 bg-slate-700 hover:bg-cyan-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-all shadow-lg active:scale-95"
                    title="Download via Torrent Client"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">DL</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (safeLink) {
                        navigator.clipboard.writeText(safeLink);
                      }
                    }}
                    className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                    title="Copy Magnet Link"
                  >
                    <Magnet className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
