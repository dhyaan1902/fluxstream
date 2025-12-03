
import { MediaType, MediaItem, TorrentSource } from "../types";

// --- API CONFIGURATION ---

// 1. Catalogs (CORS Enabled - Fetch Direct)
const CINEMETA_BASE = "https://v3-cinemeta.strem.io";
const JIKAN_BASE = "https://api.jikan.moe/v4";
const YTS_API_BASE = "https://yts.mx/api/v2";

// 2. Torrent APIs (Mixed)
const APIBAY_BASE = "https://apibay.org";
const SOLID_BASE = "https://solidtorrents.to/api/v1";
const EZTV_BASE = "https://eztv.re/api";

// 3. Scraping Targets (HTML - Needs Proxy)
const BITSEARCH_BASE = "https://bitsearch.to";
const KNABEN_BASE = "https://knaben.eu";
const MAGNETDL_BASE = "https://www.magnetdl.com";
const NYAA_RSS = "https://nyaa.si/?page=rss&q=";
const GLODLS_BASE = "https://glodls.to";
const TORRENTFUNK_BASE = "https://www.torrentfunk.com";
const TORLOCK_BASE = "https://www.torlock.com";
const ZOOQLE_BASE = "https://zooqle.com";
const TGX_BASE = "https://tgx.rs";
const TORRENT9_BASE = "https://www.torrent9.site";
const X1337_BASE = "https://1337x.to";

// 4. Proxies
const PROXY_LIST = [
  "https://corsproxy.io/?",
  "https://api.allorigins.win/raw?url=",
];

// 5. Trackers
// Critical for WebTorrent: Browsers can only talk to WebSocket trackers (wss://)
// Standard clients use UDP/TCP. We must mix both.
const WSS_TRACKERS = [
  "wss://tracker.btorrent.xyz",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
  "wss://tracker.files.fm:7073/announce",
  "wss://peertube.cpy.re/tracker/socket",
  "wss://open.tube/tracker/socket"
];

const UDP_TRACKERS = [
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:80",
  "udp://tracker.coppersurfer.tk:6969",
  "udp://glotorrents.pw:6969/announce",
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://torrent.gresille.org:80/announce",
  "udp://p4p.arenabg.com:1337",
  "udp://tracker.leechers-paradise.org:6969"
];

// --- HELPERS ---

const cleanTitle = (title: string) => {
  return title.replace(/[^a-zA-Z0-9 ]/g, " ").trim();
};

/**
 * Standard fetch for CORS-friendly APIs (Cinemeta, Jikan, YTS)
 * Much faster than routing through a proxy.
 */
const fetchDirect = async (url: string) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    // console.warn('Direct fetch failed for', url);
    return null;
  }
};

/**
 * Robust fetcher with Proxy Rotation for Scrapers
 */
const fetchProxied = async (url: string, type: 'json' | 'text' = 'json') => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for scrapers

  for (const proxy of PROXY_LIST) {
    try {
      const target = `${proxy}${encodeURIComponent(url)}`;
      const res = await fetch(target, { signal: controller.signal });

      if (!res.ok) continue;

      clearTimeout(timeoutId);
      return type === 'json' ? await res.json() : await res.text();
    } catch (e) {
      continue;
    }
  }

  clearTimeout(timeoutId);
  return null;
};

const mapCinemetaToMedia = (meta: any, type: MediaType): MediaItem => {
  return {
    id: meta.id,
    imdbId: meta.id,
    title: meta.name,
    type: type,
    year: meta.releaseInfo || meta.year?.toString() || "",
    rating: parseFloat(meta.imdbRating) || 0,
    description: meta.description || "No description available.",
    posterUrl: meta.poster,
    backdropUrl: meta.background,
    genres: meta.genres || [],
    runtime: meta.runtime,
    status: "Released",
    torrents: []
  };
};

const mapJikanToMedia = (anime: any): MediaItem => {
  return {
    id: anime.mal_id.toString(),
    // We don't get an IMDB ID easily from Jikan search list, we fetch it in extended meta
    imdbId: undefined,
    title: anime.title_english || anime.title,
    type: MediaType.ANIME,
    year: anime.year?.toString() || anime.aired?.prop?.from?.year?.toString() || "",
    rating: anime.score || 0,
    description: anime.synopsis,
    posterUrl: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
    backdropUrl: anime.trailer?.images?.maximum_image_url || anime.images?.jpg?.large_image_url,
    genres: (anime.genres || []).map((g: any) => g.name),
    runtime: anime.duration,
    trailerVideoId: anime.trailer?.youtube_id,
    status: anime.status,
    torrents: []
  };
};


// --- CATALOG FETCHERS (DIRECT) ---

export const fetchTrendingMedia = async (category: MediaType | 'ALL'): Promise<MediaItem[]> => {
  const promises: Promise<MediaItem[]>[] = [];

  if (category === 'ALL' || category === MediaType.MOVIE) promises.push(fetchCinemetaTrending(MediaType.MOVIE));
  if (category === 'ALL' || category === MediaType.SERIES) promises.push(fetchCinemetaTrending(MediaType.SERIES));
  if (category === 'ALL' || category === MediaType.ANIME) promises.push(fetchJikanTrending());

  const results = await Promise.all(promises);
  return results.flat().sort(() => Math.random() - 0.5);
};

const fetchCinemetaTrending = async (type: MediaType): Promise<MediaItem[]> => {
  const typePath = type === MediaType.MOVIE ? 'movie' : 'series';
  // Use Direct Fetch for Cinemeta
  const data = await fetchDirect(`${CINEMETA_BASE}/catalog/${typePath}/top.json`);
  return data?.metas ? data.metas.map((m: any) => mapCinemetaToMedia(m, type)) : [];
};

const fetchJikanTrending = async (): Promise<MediaItem[]> => {
  // Use Direct Fetch for Jikan
  const data = await fetchDirect(`${JIKAN_BASE}/top/anime?filter=bypopularity&limit=20`);
  return data?.data ? data.data.map(mapJikanToMedia) : [];
};

export const searchMedia = async (query: string): Promise<MediaItem[]> => {
  const encodedQuery = encodeURIComponent(query);

  // Parallel Search (Direct)
  const [cinemetaResults, jikanResults] = await Promise.all([
    (async () => {
      // Cinemeta Search
      const data = await fetchDirect(`${CINEMETA_BASE}/catalog/movie/top/search=${encodedQuery}.json`);
      return data?.metas ? data.metas.map((m: any) => mapCinemetaToMedia(m, MediaType.MOVIE)) : [];
    })(),
    (async () => {
      // Jikan Search
      const data = await fetchDirect(`${JIKAN_BASE}/anime?q=${encodedQuery}&limit=10`);
      return data?.data ? data.data.map(mapJikanToMedia) : [];
    })()
  ]);

  return [...cinemetaResults, ...jikanResults];
};


// --- DETAILS & TORRENT AGGREGATION ---

export const fetchExtendedMeta = async (item: MediaItem): Promise<Partial<MediaItem>> => {
  // 1. Cinemeta Items (Movies/Series)
  if (item.imdbId && (item.type === MediaType.MOVIE || item.type === MediaType.SERIES)) {
    const typePath = item.type === MediaType.MOVIE ? 'movie' : 'series';
    const data = await fetchDirect(`${CINEMETA_BASE}/meta/${typePath}/${item.imdbId}.json`);
    const meta = data?.meta;

    if (meta) {
      return {
        description: meta.description,
        runtime: meta.runtime,
        status: meta.releaseInfo,
        cast: (meta.cast || []).slice(0, 10).map((c: any) => c.name),
        director: (meta.director || []).slice(0, 3).join(", "),
        posterUrl: meta.poster,
        backdropUrl: meta.background,
        trailerVideoId: meta.trailers?.[0]?.source
      };
    }
  }

  // 2. Anime Items (Jikan)
  // We need to fetch the IMDB ID via Jikan's external links endpoint
  if (item.type === MediaType.ANIME && !item.imdbId) {
    const external = await fetchDirect(`${JIKAN_BASE}/anime/${item.id}/external`);
    if (external?.data) {
      const imdbEntry = external.data.find((e: any) => e.name === 'IMDB');
      if (imdbEntry && imdbEntry.url) {
        // extract tt12345 from url
        const match = imdbEntry.url.match(/tt\d+/);
        if (match) {
          return { imdbId: match[0] };
        }
      }
    }
  }

  return {};
};

export const aggregateTorrents = async (item: MediaItem): Promise<TorrentSource[]> => {
  const queries: Promise<TorrentSource[]>[] = [];
  const searchQuery = cleanTitle(item.title) + " " + (item.type === MediaType.SERIES ? "S01" : item.year);
  const imdbId = item.imdbId;

  // 1. YTS (Movies - Direct Fetch - Best Quality)
  if (item.type === MediaType.MOVIE && imdbId) {
    queries.push(searchYTS(imdbId, item.title));
  }

  // 2. EZTV (Series - Proxied)
  if (item.type === MediaType.SERIES && imdbId) {
    queries.push(searchEZTV(imdbId));
  }

  // 3. BitSearch (Scraper - Proxied - ID or Text)
  if (imdbId) {
    queries.push(searchBitSearch(imdbId).then(res => res.length > 0 ? res : searchBitSearch(searchQuery)));
  } else {
    queries.push(searchBitSearch(searchQuery));
  }

  // 4. Apibay (Proxied)
  if (imdbId) {
    queries.push(searchApibay(imdbId).then(res => res.length > 0 ? res : searchApibay(searchQuery)));
  } else {
    queries.push(searchApibay(searchQuery));
  }

  // 5. SolidTorrents (Proxied)
  queries.push(searchSolidTorrents(searchQuery));

  // 6. Knaben (Proxied)
  queries.push(searchKnaben(searchQuery));

  // 7. MagnetDL (Proxied)
  queries.push(searchMagnetDL(cleanTitle(item.title)));

  // 8. Nyaa (Anime - Proxied - PRIORITY)
  if (item.type === MediaType.ANIME) {
    queries.push(searchNyaa(cleanTitle(item.title)));
  }

  // 9. Glodls (Proxied)
  queries.push(searchGlodls(searchQuery));

  // 10. TorrentFunk (Proxied)
  queries.push(searchTorrentFunk(searchQuery));

  // 11. Torlock (Proxied)
  queries.push(searchTorlock(searchQuery));

  // 12. Zooqle (Proxied)
  queries.push(searchZooqle(searchQuery));

  // 13. TorrentGalaxy (Proxied - Bollywood)
  queries.push(searchTGX(searchQuery));

  const results = await Promise.all(queries);

  // Deduplicate and Append Trackers
  const flat = results.flat();
  const seenHashes = new Set();

  // Prepare tracker string once
  const trackerString = [...UDP_TRACKERS, ...WSS_TRACKERS].map(t => `&tr=${encodeURIComponent(t)}`).join('');

  const uniqueTorrents = flat.filter(t => {
    if (!t.magnet) return false;
    const match = t.magnet.match(/xt=urn:btih:([a-zA-Z0-9]+)/);
    const hash = match ? match[1].toLowerCase() : t.magnet.toLowerCase();
    if (seenHashes.has(hash)) return false;
    seenHashes.add(hash);

    // ENHANCEMENT: Append WebSeeds/WSS trackers to existing magnet if not present
    // This is critical for WebTorrent in the browser to work
    if (t.magnet.startsWith('magnet:') && !t.magnet.includes('tracker.btorrent.xyz')) {
      t.magnet += trackerString;
    }

    return true;
  });

  return uniqueTorrents.sort((a, b) => b.seeds - a.seeds).slice(0, 50);
};


// --- INDIVIDUAL PROVIDERS ---

// YTS: Direct Fetch (No Proxy)
const searchYTS = async (imdbId: string, movieTitle: string): Promise<TorrentSource[]> => {
  const data = await fetchDirect(`${YTS_API_BASE}/list_movies.json?query_term=${imdbId}`);
  if (data?.data?.movies?.[0]?.torrents) {
    return data.data.movies[0].torrents.map((t: any) => ({
      source: "YTS",
      quality: t.quality,
      releaseTitle: `${movieTitle}.${data.data.movies[0].year}.${t.quality}.YTS.MX`,
      size: t.size,
      seeds: t.seeds,
      peers: t.peers,
      magnet: t.hash,
      uploader: "YTS.MX",
      date: t.date_uploaded
    }));
  }
  return [];
};

// EZTV: Proxied (CORS often blocks)
const searchEZTV = async (imdbId: string): Promise<TorrentSource[]> => {
  const idNumeric = imdbId.replace('tt', '');
  const data = await fetchProxied(`${EZTV_BASE}/get-torrents?imdb_id=${idNumeric}`, 'json');
  if (data?.torrents) {
    return data.torrents.map((t: any) => ({
      source: "EZTV",
      quality: "HD",
      releaseTitle: t.title || t.filename,
      size: (t.size_bytes / 1024 / 1024).toFixed(2) + " MB",
      seeds: t.seeds,
      peers: t.peers,
      magnet: t.magnet_url,
      uploader: "EZTV",
      date: "Recent"
    }));
  }
  return [];
};

// Apibay: Proxied
const searchApibay = async (query: string): Promise<TorrentSource[]> => {
  const data = await fetchProxied(`${APIBAY_BASE}/q.php?q=${encodeURIComponent(query)}`, 'json');
  if (data && data[0]?.name !== 'No results returned') {
    return data.map((t: any) => ({
      source: "TPB",
      quality: "Unknown",
      releaseTitle: t.name,
      size: (parseInt(t.size) / 1024 / 1024).toFixed(2) + " MB",
      seeds: parseInt(t.seeders),
      peers: parseInt(t.leechers),
      magnet: `magnet:?xt=urn:btih:${t.info_hash}&dn=${encodeURIComponent(t.name)}`,
      uploader: t.username,
      date: "Recent"
    }));
  }
  return [];
};

// SolidTorrents: Proxied
const searchSolidTorrents = async (query: string): Promise<TorrentSource[]> => {
  const data = await fetchProxied(`${SOLID_BASE}/search?q=${encodeURIComponent(query)}&category=Video`, 'json');
  if (data?.results) {
    return data.results.map((t: any) => ({
      source: "Solid",
      quality: "Unknown",
      releaseTitle: t.title,
      size: (t.size / 1024 / 1024).toFixed(2) + " MB",
      seeds: t.swarm.seeders,
      peers: t.swarm.leechers,
      magnet: t.magnet,
      uploader: "Solid",
      date: t.imported
    }));
  }
  return [];
};

// 1337x: Proxied (HTML Scraper)

// BitSearch: Proxied (HTML Scraper)
const searchBitSearch = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${BITSEARCH_BASE}/search?q=${encodeURIComponent(query)}`, 'text');
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items = Array.from(doc.querySelectorAll('li.search-result'));

  return items.map(item => {
    try {
      const title = item.querySelector('h5 a')?.textContent?.trim();
      const magnet = item.querySelector('a.dl-magnet')?.getAttribute('href');
      const stats = item.querySelectorAll('.stats div');
      if (!magnet || !title) return null;

      return {
        source: "BitSearch",
        quality: title.includes('1080') ? '1080p' : 'HD',
        releaseTitle: title,
        size: stats[1]?.textContent?.trim() || '?',
        seeds: parseInt(stats[2]?.textContent?.trim() || '0'),
        peers: parseInt(stats[3]?.textContent?.trim() || '0'),
        magnet: magnet,
        uploader: "DHT",
        date: "Recent"
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// Knaben: Proxied (HTML Scraper)
const searchKnaben = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${KNABEN_BASE}/search/${encodeURIComponent(query)}/0/1/seeders`, 'text');
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table.table-striped tbody tr'));

  return rows.map(row => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 5) return null;
      const title = cells[1].querySelector('a')?.textContent?.trim() || 'Unknown';
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');
      if (!magnet) return null;

      return {
        source: 'Knaben',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : '720p',
        releaseTitle: title,
        size: cells[2]?.textContent?.trim() || '?',
        seeds: parseInt(cells[4]?.textContent?.trim() || '0'),
        peers: parseInt(cells[5]?.textContent?.trim() || '0'),
        magnet,
        uploader: cells[6]?.textContent?.trim() || 'Unknown',
        date: 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// MagnetDL: Proxied (HTML Scraper)
const searchMagnetDL = async (query: string): Promise<TorrentSource[]> => {
  const formattedQuery = query.toLowerCase().replace(/ /g, '-').substring(0, 1).toLowerCase() + '/' + query.toLowerCase().replace(/ /g, '-');
  const html = await fetchProxied(`${MAGNETDL_BASE}/${formattedQuery}/`, 'text');

  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table.download tbody tr'));

  return rows.map(row => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 8) return null;

      const magnet = cells[0].querySelector('a[href^="magnet:"]')?.getAttribute('href');
      const title = cells[1].querySelector('a')?.getAttribute('title') || 'Unknown';
      const seeds = cells[6].textContent || '0';
      const peers = cells[7].textContent || '0';
      const size = cells[5].textContent || '?';

      if (!magnet) return null;

      return {
        source: 'MagnetDL',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : '720p',
        releaseTitle: title,
        size: size,
        seeds: parseInt(seeds),
        peers: parseInt(peers),
        magnet,
        uploader: 'MDL',
        date: 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// Nyaa: Proxied (RSS XML)
const searchNyaa = async (query: string): Promise<TorrentSource[]> => {
  const xmlText = await fetchProxied(`${NYAA_RSS}${encodeURIComponent(query)}`, 'text');
  if (!xmlText) return [];

  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'text/xml');
  const items = Array.from(xml.querySelectorAll('item'));

  return items.map(item => {
    const title = item.querySelector('title')?.textContent || 'Unknown';
    return {
      source: 'Nyaa',
      quality: title.includes('1080') ? '1080p' : '720p',
      releaseTitle: title,
      size: item.querySelector('size')?.textContent || '?',
      seeds: parseInt(item.querySelector('seeders')?.textContent || '0'),
      peers: parseInt(item.querySelector('leechers')?.textContent || '0'),
      magnet: item.querySelector('magnet')?.textContent || item.querySelector('link')?.textContent || '',
      uploader: 'Anime',
      date: 'Recent'
    };
  });
};
// Glodls: Proxied (HTML Scraper)
const searchGlodls = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${GLODLS_BASE}/search_results.php?search=${encodeURIComponent(query)}&cat=1&incldead=0&sort=seeders&order=desc`, 'text');
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table.table tbody tr'));

  return rows.map(row => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) return null;

      const titleLink = cells[1].querySelector('a');
      const title = titleLink?.textContent?.trim();
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');

      if (!magnet || !title) return null;

      return {
        source: 'Glodls',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : '720p',
        releaseTitle: title,
        size: cells[4]?.textContent?.trim() || '?',
        seeds: parseInt(cells[5]?.textContent?.trim() || '0'),
        peers: parseInt(cells[6]?.textContent?.trim() || '0'),
        magnet,
        uploader: 'Glodls',
        date: 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// TorrentFunk: Proxied (HTML Scraper)
const searchTorrentFunk = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${TORRENTFUNK_BASE}/all/torrents/${encodeURIComponent(query)}.html`, 'text');
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table tr:not(:first-child)'));

  return rows.map(row => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 6) return null;

      const titleLink = cells[0].querySelector('a');
      const title = titleLink?.textContent?.trim();
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');

      if (!magnet || !title) return null;

      return {
        source: 'TorrentFunk',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : 'HD',
        releaseTitle: title,
        size: cells[1]?.textContent?.trim() || '?',
        seeds: parseInt(cells[4]?.textContent?.trim() || '0'),
        peers: parseInt(cells[5]?.textContent?.trim() || '0'),
        magnet,
        uploader: 'TorrentFunk',
        date: cells[2]?.textContent?.trim() || 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// Torlock: Proxied (HTML Scraper)
const searchTorlock = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${TORLOCK_BASE}/all/torrents/${encodeURIComponent(query)}.html?sort=seeds&order=desc`, 'text');
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table tr:not(:first-child)'));

  return rows.map(row => {
    try {
      const cells = row.querySelectorAll('td');
      if (cells.length < 7) return null;

      const titleLink = cells[0].querySelector('a');
      const title = titleLink?.textContent?.trim();
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');

      if (!magnet || !title) return null;

      return {
        source: 'Torlock',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : 'HD',
        releaseTitle: title,
        size: cells[2]?.textContent?.trim() || '?',
        seeds: parseInt(cells[3]?.textContent?.trim() || '0'),
        peers: parseInt(cells[4]?.textContent?.trim() || '0'),
        magnet,
        uploader: cells[5]?.textContent?.trim() || 'Torlock',
        date: cells[1]?.textContent?.trim() || 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// Zooqle: Proxied (HTML Scraper)
const searchZooqle = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${ZOOQLE_BASE}/search?q=${encodeURIComponent(query)}&s=ns&v=t&sd=d`, 'text');
  if (!html) return [];

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('table.table-torrents tbody tr'));

  return rows.map(row => {
    try {
      const titleLink = row.querySelector('td a.small');
      const title = titleLink?.textContent?.trim();
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');
      const stats = row.querySelectorAll('td');

      if (!magnet || !title) return null;

      return {
        source: 'Zooqle',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : 'HD',
        releaseTitle: title,
        size: stats[3]?.textContent?.trim() || '?',
        seeds: parseInt(stats[5]?.textContent?.trim() || '0'),
        peers: parseInt(stats[6]?.textContent?.trim() || '0'),
        magnet,
        uploader: 'Zooqle',
        date: 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};

// TorrentGalaxy: Proxied (HTML Scraper)
const searchTGX = async (query: string): Promise<TorrentSource[]> => {
  const html = await fetchProxied(`${TGX_BASE}/torrents.php?search=${encodeURIComponent(query)}&sort=seeders&order=desc`, 'text');
  if (!html) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const rows = Array.from(doc.querySelectorAll('div.tgxtablerow'));

  return rows.map(row => {
    try {
      const title = row.querySelector('div.tgxtablecell a[title]')?.getAttribute('title') || 'Unknown';
      const magnet = row.querySelector('a[href^="magnet:"]')?.getAttribute('href');

      // TGX specific selectors
      const seeds = row.querySelector('font[color="green"] b')?.textContent || '0';
      const peers = row.querySelector('font[color="#ff0000"] b')?.textContent || '0';
      const size = row.querySelector('span.badge.badge-secondary')?.textContent || '?';

      if (!magnet) return null;

      return {
        source: 'TGX',
        quality: title.match(/2160p|4k/i) ? '4K' : title.match(/1080p/i) ? '1080p' : 'HD',
        releaseTitle: title,
        size: size,
        seeds: parseInt(seeds),
        peers: parseInt(peers),
        magnet,
        uploader: 'TGX',
        date: 'Recent'
      };
    } catch { return null; }
  }).filter(Boolean) as TorrentSource[];
};
