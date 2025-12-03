
import { MediaType, MediaItem, TorrentSource } from "../types";

// (existing imports and code above...)

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
