import axios from "axios";
import cheerio from "cheerio";
import AdmZip from "adm-zip"; // Required for extracting SRT from ZIP files

class YIFYService {
    constructor() {
        this.cache = new Map();
        this.baseURL = 'https://yifysubtitles.org';
    }

    /**
     * Search and download subtitles by IMDB ID
     * @param {string} imdbId - IMDB ID (e.g., 'tt0133093')
     * @param {string} language - Language code (default: 'english')
     * @returns {Promise<string|null>} - VTT subtitle content
     */
    async searchByImdb(imdbId, language = 'english') {
        try {
            const cacheKey = `${imdbId}_${language}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                console.log(`✅ [YIFY] Using cached subtitle: ${imdbId}`);
                return this.cache.get(cacheKey);
            }

            console.log(`[YIFY] Searching for: ${imdbId}, language: ${language}`);

            // Fetch movie page
            const movieUrl = `${this.baseURL}/movie-imdb/${imdbId}`;
            const response = await axios.get(movieUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            const $ = cheerio.load(response.data);

            // Find subtitle in desired language
            let downloadUrl = null;
            $('.other-subs tbody tr').each((i, elem) => {
                const lang = $(elem).find('.flag-cell .sub-lang').text().trim().toLowerCase();
                if (lang === language.toLowerCase()) {
                    const href = $(elem).find('.download-cell a').attr('href');
                    if (href) {
                        downloadUrl = href;
                        return false; // Break loop
                    }
                }
            });

            if (!downloadUrl) {
                console.log(`[YIFY] No ${language} subtitle found for: ${imdbId}`);
                return null;
            }

            // Download subtitle
            const fullDownloadUrl = downloadUrl.startsWith('http') ? downloadUrl : `${this.baseURL}${downloadUrl}`;
            const subtitleData = await axios.get(fullDownloadUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            // Extract SRT from ZIP
            const srtContent = await this.extractSRTFromZip(subtitleData.data);

            if (srtContent) {
                const vttContent = this.srtToVtt(srtContent);

                // Cache it
                this.cache.set(cacheKey, vttContent);
                setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

                console.log(`✅ [YIFY] Downloaded subtitle: ${language}`);
                return vttContent;
            }

            return null;
        } catch (error) {
            console.error(`[YIFY] Error searching ${imdbId}:`, error.message);
            return null;
        }
    }

    /**
     * Extract SRT file from ZIP buffer
     * @param {Buffer} zipBuffer - ZIP file buffer
     * @returns {Promise<string|null>} - SRT content
     */
    async extractSRTFromZip(zipBuffer) {
        try {
            const zip = new AdmZip(zipBuffer);
            const zipEntries = zip.getEntries();

            // Find SRT file
            for (const entry of zipEntries) {
                if (entry.entryName.endsWith('.srt')) {
                    return entry.getData().toString('utf8');
                }
            }

            return null;
        } catch (error) {
            // If not a zip, try to use as-is
            return zipBuffer.toString('utf8');
        }
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
        console.log('[YIFY] Cache cleared');
    }
}

export default YIFYService;
