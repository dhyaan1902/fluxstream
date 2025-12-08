import OpenSubtitlesAPI from "opensubtitles-api";
import axios from "axios";

class OpenSubtitlesService {
    constructor() {
        this.client = new OpenSubtitlesAPI({
            useragent: 'FluxStream v1.0',
            ssl: true
        });
        this.cache = new Map();
    }

    /**
     * Search and download subtitles for a movie by IMDB ID
     * @param {string} imdbId - IMDB ID with or without 'tt' prefix
     * @param {string} language - Language code (default: 'en')
     * @returns {Promise<string|null>} - VTT subtitle content
     */
    async searchByImdb(imdbId, language = 'en') {
        try {
            const cacheKey = `${imdbId}_${language}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                console.log(`✅ [OpenSubtitles] Using cached subtitle: ${imdbId}`);
                return this.cache.get(cacheKey);
            }

            // Remove 'tt' prefix if present
            const cleanId = imdbId.replace(/^tt/, '');

            console.log(`[OpenSubtitles] Searching movie: ${cleanId}, lang: ${language}`);

            const result = await this.client.search({
                sublanguageid: this.getLangCode(language),
                imdbid: cleanId,
                limit: 'best',
                gzip: true
            });

            // OpenSubtitles API returns language code without the '3-letter' format
            // E.g., returns 'en' not 'eng', but we search with 'eng'
            // So we need to check both the input language and the mapped code
            const langCode = this.getLangCode(language);

            // Try both the mapped code and the original language
            let subtitleData = result[langCode] || result[language] || result['en'];

            // Also try 2-letter codes
            const twoLetterCode = language.substring(0, 2);
            if (!subtitleData) {
                subtitleData = result[twoLetterCode];
            }

            if (subtitleData && subtitleData.url) {
                const subtitleUrl = subtitleData.url;
                console.log(`[OpenSubtitles] Found subtitle URL: ${subtitleUrl}`);

                // Download subtitle
                const srtContent = await this.downloadSubtitle(subtitleUrl);

                if (srtContent) {
                    const vttContent = this.srtToVtt(srtContent);

                    // Cache it
                    this.cache.set(cacheKey, vttContent);
                    setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

                    console.log(`✅ [OpenSubtitles] Downloaded subtitle: ${language}`);
                    return vttContent;
                }
            }

            console.log(`[OpenSubtitles] No subtitles found for: ${imdbId}`);
            return null;
        } catch (error) {
            console.error(`[OpenSubtitles] Error searching ${imdbId}:`, error.message);
            return null;
        }
    }

    /**
     * Search and download subtitles for a series episode
     * @param {string} imdbId - IMDB ID with or without 'tt' prefix
     * @param {number} season - Season number
     * @param {number} episode - Episode number
     * @param {string} language - Language code (default: 'en')
     * @returns {Promise<string|null>} - VTT subtitle content
     */
    async searchSeries(imdbId, season, episode, language = 'en') {
        try {
            const cacheKey = `${imdbId}_S${season}E${episode}_${language}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                console.log(`✅ [OpenSubtitles] Using cached subtitle: ${cacheKey}`);
                return this.cache.get(cacheKey);
            }

            // Remove 'tt' prefix if present
            const cleanId = imdbId.replace(/^tt/, '');

            console.log(`[OpenSubtitles] Searching series: ${cleanId} S${season}E${episode}, lang: ${language}`);

            const result = await this.client.search({
                sublanguageid: this.getLangCode(language),
                imdbid: cleanId,
                season: parseInt(season),
                episode: parseInt(episode),
                limit: 'best',
                gzip: true
            });

            const langCode = this.getLangCode(language);

            if (result && result[langCode] && result[langCode].url) {
                const subtitleUrl = result[langCode].url;
                console.log(`[OpenSubtitles] Found subtitle URL: ${subtitleUrl}`);

                // Download subtitle
                const srtContent = await this.downloadSubtitle(subtitleUrl);

                if (srtContent) {
                    const vttContent = this.srtToVtt(srtContent);

                    // Cache it
                    this.cache.set(cacheKey, vttContent);
                    setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

                    console.log(`✅ [OpenSubtitles] Downloaded series subtitle: ${language}`);
                    return vttContent;
                }
            }

            console.log(`[OpenSubtitles] No subtitles found for: ${imdbId} S${season}E${episode}`);
            return null;
        } catch (error) {
            console.error(`[OpenSubtitles] Series error:`, error.message);
            return null;
        }
    }

    /**
     * Download subtitle from URL
     * @param {string} url - Subtitle URL
     * @returns {Promise<string>} - SRT content
     */
    async downloadSubtitle(url) {
        try {
            const response = await axios.get(url, {
                responseType: 'text',
                timeout: 15000,
                headers: {
                    'User-Agent': 'FluxStream v1.0'
                }
            });

            return response.data;
        } catch (error) {
            console.error(`[OpenSubtitles] Download error:`, error.message);
            return null;
        }
    }

    /**
     * Convert language name to OpenSubtitles language code
     * @param {string} language - Language name or code
     * @returns {string} - OpenSubtitles language code
     */
    getLangCode(language) {
        const langMap = {
            'english': 'eng',
            'en': 'eng',
            'spanish': 'spa',
            'es': 'spa',
            'español': 'spa',
            'french': 'fre',
            'fr': 'fre',
            'français': 'fre',
            'german': 'ger',
            'de': 'ger',
            'portuguese': 'por',
            'pt': 'por',
            'português': 'por',
            'italian': 'ita',
            'it': 'ita',
            'italiano': 'ita',
            'dutch': 'dut',
            'nl': 'dut',
            'nederlands': 'dut',
            'polish': 'pol',
            'pl': 'pol',
            'polski': 'pol',
            'romanian': 'rum',
            'ro': 'rum',
            'român': 'rum',
            'swedish': 'swe',
            'sv': 'swe',
            'svenska': 'swe',
            'turkish': 'tur',
            'tr': 'tur',
            'türkçe': 'tur'
        };

        return langMap[language.toLowerCase()] || language;
    }

    /**
     * Convert SRT format to WebVTT
     * @param {string} srtContent - SRT subtitle content
     * @returns {string} - VTT subtitle content
     */
    srtToVtt(srtContent) {
        return 'WEBVTT\n\n' + srtContent
            .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
            .replace(/^\d+\s*$/gm, '');
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
        console.log('[OpenSubtitles] Cache cleared');
    }
}

export default OpenSubtitlesService;
