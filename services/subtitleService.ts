const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface SubtitleTrack {
    language: string;
    label: string;
    url: string;
}

export const subtitleService = {
    /**
     * Get subtitles for a movie by IMDB ID
     */
    async getMovieSubtitles(imdbId: string, language: string = 'en'): Promise<string | null> {
        try {
            const res = await fetch(`${API_BASE}/api/subtitles/movie/${imdbId}/${language}`);

            if (res.ok) {
                const vttContent = await res.text();
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                return URL.createObjectURL(blob);
            }

            return null;
        } catch (error) {
            console.error('[Subtitles] Movie fetch error:', error);
            return null;
        }
    },

    /**
     * Get subtitles for a series episode by IMDB ID + season + episode
     */
    async getSeriesSubtitles(
        imdbId: string,
        season: number,
        episode: number,
        language: string = 'en'
    ): Promise<string | null> {
        try {
            const res = await fetch(
                `${API_BASE}/api/subtitles/series/${imdbId}/${season}/${episode}/${language}`
            );

            if (res.ok) {
                const vttContent = await res.text();
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                return URL.createObjectURL(blob);
            }

            return null;
        } catch (error) {
            console.error('[Subtitles] Series fetch error:', error);
            return null;
        }
    },

    /**
     * Get subtitles for a torrent by torrent ID + file index + IMDB ID
     */
    async getTorrentSubtitles(
        torrentId: string,
        fileIndex: number,
        imdbId?: string,
        language: string = 'en'
    ): Promise<string | null> {
        try {
            const params = new URLSearchParams();
            if (imdbId) params.append('imdbId', imdbId);
            if (language) params.append('language', language);

            const res = await fetch(
                `${API_BASE}/api/subtitles/torrent/${torrentId}/${fileIndex}?${params.toString()}`
            );

            if (res.ok) {
                const vttContent = await res.text();
                const blob = new Blob([vttContent], { type: 'text/vtt' });
                return URL.createObjectURL(blob);
            }

            return null;
        } catch (error) {
            console.error('[Subtitles] Torrent fetch error:', error);
            return null;
        }
    },

    /**
     * Get multiple subtitle tracks for different languages
     */
    async getMultipleLanguages(
        fetchFn: (lang: string) => Promise<string | null>,
        languages: string[]
    ): Promise<SubtitleTrack[]> {
        const tracks: SubtitleTrack[] = [];

        for (const lang of languages) {
            const url = await fetchFn(lang);
            if (url) {
                tracks.push({
                    language: lang.toLowerCase(),
                    label: this.getLanguageLabel(lang),
                    url
                });
            }
        }

        return tracks;
    },

    /**
     * Get language label from code
     */
    getLanguageLabel(code: string): string {
        const labels: Record<string, string> = {
            'en': 'English',
            'eng': 'English',
            'es': 'Spanish',
            'spa': 'Spanish',
            'fr': 'French',
            'fre': 'French',
            'de': 'German',
            'ger': 'German',
            'pt': 'Portuguese',
            'por': 'Portuguese',
            'it': 'Italian',
            'ita': 'Italian',
            'nl': 'Dutch',
            'dut': 'Dutch',
            'pl': 'Polish',
            'pol': 'Polish',
            'ro': 'Romanian',
            'rum': 'Romanian',
            'sv': 'Swedish',
            'swe': 'Swedish',
            'tr': 'Turkish',
            'tur': 'Turkish'
        };

        return labels[code.toLowerCase()] || code.toUpperCase();
    },

    /**
     * Download subtitle as SRT file
     */
    async downloadSubtitleFile(imdbId: string, title?: string, language: string = 'en'): Promise<void> {
        try {
            const params = new URLSearchParams();
            if (title) params.append('title', title);

            const url = `${API_BASE}/api/subtitles/download/${imdbId}/${language}?${params.toString()}`;

            // Trigger download
            const link = document.createElement('a');
            link.href = url;
            link.download = title ? `${title}.${language}.srt` : `${imdbId}.${language}.srt`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            console.log('[Subtitles] Download triggered for:', imdbId);
        } catch (error) {
            console.error('[Subtitles] Download error:', error);
            throw error;
        }
    }
};
