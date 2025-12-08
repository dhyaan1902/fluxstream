import axios from "axios";
import cheerio from "cheerio";

class SubsceneService {
    constructor() {
        this.baseURL = 'https://subscene.com';
        this.cache = new Map();
    }

    /**
     * Search subtitles by movie/series title
     * @param {string} title - Movie or series title
     * @param {string} language - Language (default: 'English')
     * @returns {Promise<string|null>} - VTT subtitle content
     */
    async searchByTitle(title, language = 'English') {
        try {
            const cacheKey = `${title}_${language}`;

            // Check cache
            if (this.cache.has(cacheKey)) {
                console.log(`✅ [Subscene] Using cached subtitle: ${title}`);
                return this.cache.get(cacheKey);
            }

            console.log(`[Subscene] Searching for: "${title}", language: ${language}`);

            // Search for the title
            const searchUrl = `${this.baseURL}/subtitles/searchbytitle`;
            const searchResponse = await axios.post(searchUrl, `query=${encodeURIComponent(title)}`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 10000
            });

            const $ = cheerio.load(searchResponse.data);
            const firstResult = $('.title a').first().attr('href');

            if (!firstResult) {
                console.log(`[Subscene] No results found for: ${title}`);
                return null;
            }

            // Get subtitle list for this title
            const titleUrl = `${this.baseURL}${firstResult}`;
            const titleResponse = await axios.get(titleUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            const $$ = cheerio.load(titleResponse.data);

            // Find subtitle in desired language
            let subtitleLink = null;
            $$('.a1').each((i, elem) => {
                const langSpan = $$(elem).find('.l').text().trim();
                if (langSpan === language) {
                    const link = $$(elem).find('a').attr('href');
                    if (link) {
                        subtitleLink = link;
                        return false; // Break loop
                    }
                }
            });

            if (!subtitleLink) {
                console.log(`[Subscene] No ${language} subtitle found for: ${title}`);
                return null;
            }

            // Get download link
            const subtitlePageUrl = `${this.baseURL}${subtitleLink}`;
            const subtitlePageResponse = await axios.get(subtitlePageUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 10000
            });

            const $$$ = cheerio.load(subtitlePageResponse.data);
            const downloadLink = $$$('#downloadButton').attr('href');

            if (!downloadLink) {
                console.log(`[Subscene] No download link found`);
                return null;
            }

            // Download subtitle
            const downloadUrl = `${this.baseURL}${downloadLink}`;
            console.log(`✅ [Subscene] Found subtitle, downloading...`);

            const subtitleData = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                headers: { 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            // Extract SRT from ZIP (most subscene subtitles are zipped)
            const srtContent = await this.extractSRTFromZip(subtitleData.data);

            if (srtContent) {
                const vttContent = this.srtToVtt(srtContent);

                // Cache it
                this.cache.set(cacheKey, vttContent);
                setTimeout(() => this.cache.delete(cacheKey), 24 * 60 * 60 * 1000);

                console.log(`✅ [Subscene] Downloaded subtitle: ${language}`);
                return vttContent;
            }

            return null;
        } catch (error) {
            console.error(`[Subscene] Error:`, error.message);
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
const AdmZip = await import("adm-zip");
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
            // If not a zip, try to use as-is (plain SRT)
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
        console.log('[Subscene] Cache cleared');
    }
}

export default SubsceneService;
