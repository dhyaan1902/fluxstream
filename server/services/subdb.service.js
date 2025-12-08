import axios from "axios";
import crypto from "crypto";

class SubDBService {
    constructor() {
        this.baseURL = 'http://api.thesubdb.com';
        this.userAgent = 'SubDB/1.0 (FluxStream/1.0; http://github.com/fluxstream)';
    }

    /**
     * Search for available subtitle languages by hash
     * @param {string} hash - SubDB file hash
     * @returns {Promise<string[]>} - Array of available language codes
     */
    async search(hash) {
        try {
            const res = await axios.get(`${this.baseURL}/?action=search&hash=${hash}`, {
                headers: { 'User-Agent': this.userAgent }
            });

            // Returns comma-separated languages: "en,es,fr"
            return res.data.split(',');
        } catch (error) {
            console.log(`[SubDB] No subtitles found for hash: ${hash}`);
            return [];
        }
    }

    /**
     * Download subtitle by hash and language
     * @param {string} hash - SubDB file hash
     * @param {string} language - Language code (default: 'en')
     * @returns {Promise<string|null>} - VTT subtitle content
     */
    async download(hash, language = 'en') {
        try {
            const res = await axios.get(
                `${this.baseURL}/?action=download&hash=${hash}&language=${language}`,
                { headers: { 'User-Agent': this.userAgent } }
            );

            console.log(`✅ [SubDB] Downloaded subtitle: ${language}`);
            return this.srtToVtt(res.data);
        } catch (error) {
            console.log(`[SubDB] Download failed for hash: ${hash}, language: ${language}`);
            return null;
        }
    }

    /**
     * Convert SRT format to WebVTT
     * @param {string} srtContent - SRT subtitle content
     * @returns {string} - VTT subtitle content
     */
    srtToVtt(srtContent) {
        return 'WEBVTT\n\n' + srtContent
            .replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2') // Replace comma with period
            .replace(/^\d+\s*$/gm, ''); // Remove subtitle numbers
    }

    /**
     * Calculate SubDB hash for a file
     * Hash = MD5(first 64KB + last 64KB)
     * @param {string} filePath - Path to video file
     * @returns {string} - MD5 hash
     */
    calculateHash(filePath) {
const fs = await import("fs");
        const fileSize = fs.statSync(filePath).size;
        const readSize = 64 * 1024; // 64KB

        if (fileSize < readSize * 2) {
            throw new Error('File too small for SubDB hash');
        }

        const buffer = Buffer.alloc(readSize * 2);
        const fd = fs.openSync(filePath, 'r');

        // Read first 64KB
        fs.readSync(fd, buffer, 0, readSize, 0);

        // Read last 64KB
        fs.readSync(fd, buffer, readSize, readSize, fileSize - readSize);

        fs.closeSync(fd);

        return crypto.createHash('md5').update(buffer).digest('hex');
    }
}

export default SubDBService;
