export enum MediaType {
  MOVIE = 'MOVIE',
  SERIES = 'SERIES',
  ANIME = 'ANIME'
}

export interface TorrentSource {
  source: string; // e.g., 'YTS', 'RARBG', '1337x', 'Nyaa'
  quality: string; // '4K', '1080p', '720p', 'WEB-DL'
  releaseTitle?: string; // Full release name e.g. "Movie.2024.1080p.x264-Group"
  size: string;
  seeds: number;
  peers: number;
  magnet: string;
  uploader?: string; // e.g., 'QxR', 'Erai-raws'
  date?: string;
  fileCount?: number;
}

export interface MediaItem {
  id: string;
  imdbId?: string; // Link between Stremio/TMDB and Torrent Trackers
  title: string;
  type: MediaType;
  year: string;
  rating: number;
  description: string;
  posterUrl: string;
  backdropUrl: string;
  genres: string[];
  cast?: string[];
  director?: string;
  torrents?: TorrentSource[];
  trailerVideoId?: string; // YouTube Video ID
  status?: string; // 'Released', 'Ongoing', 'Ended'
  runtime?: string;
}

export type ViewState = 'HOME' | 'MOVIES' | 'SERIES' | 'ANIME' | 'SEARCH';

export interface StremioAddon {
  id: string;
  name: string;
  version: string;
  description: string;
  manifestUrl: string;
  transportUrl: string;
  logo?: string;
}

export interface StremioStream {
  name?: string;
  title?: string;
  infoHash?: string;
  url?: string;
  behaviorHints?: {
    bingeGroup?: string;
    filename?: string;
  };
  addonName: string;
}