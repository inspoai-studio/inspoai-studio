import express from 'express';
import { logoService } from '../services/logoService.js';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Define a route that handles both brand logo searches and trend searches
router.get('/', async (req, res) => {
    try {
        const { q: query, type } = req.query;
        // APPEND LOG TO test_debug.log
        const logMsg = `\n--- NEW REQUEST [${new Date().toISOString()}] ---\nQuery: ${query} | Type: ${type}\n`;
        fs.appendFileSync(path.join(__dirname, 'test_debug.log'), logMsg);

        console.log(`[LOGO SEARCH API HIT] User requested: "${query}" | Type: ${type}`);

        if (!query) {
            fs.appendFileSync(path.join(__dirname, 'test_debug.log'), `Error: No query provided\n`);
            return res.status(400).json({ success: false, error: 'Query parameter "q" is required' });
        }

        let data;
        // The frontend can specify type='brand' or type='trend'. We can also auto-detect easily.
        const isTrendQuery = type === 'trend' ||
            query.toLowerCase().includes('trend') ||
            query.toLowerCase().includes('top ten') ||
            query.toLowerCase().includes('top 10') ||
            query.toLowerCase().includes('best logos');

        if (isTrendQuery) {
            data = await logoService.searchLogoTrends(query);
            fs.appendFileSync(path.join(__dirname, 'test_debug.log'), `Success TREND: ${JSON.stringify(data).substring(0, 100)}\n`);
            return res.json({ success: true, type: 'trend', data });
        } else {
            data = await logoService.searchBrandLogo(query);
            fs.appendFileSync(path.join(__dirname, 'test_debug.log'), `Success BRAND: ${JSON.stringify(data).substring(0, 100)}\n`);
            return res.json({ success: true, type: 'brand', data });
        }

    } catch (error) {
        console.error('Logo Search API Error:', error);
        fs.appendFileSync(path.join(__dirname, 'test_debug.log'), `CATCH ERROR: ${error.message}\n${error.stack}\n`);
        res.status(500).json({ success: false, error: error.message || 'Internal server error during logo search' });
    }
});

export default router;
