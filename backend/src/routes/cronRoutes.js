import express from 'express';
import crypto from 'crypto';
import { runTrialCheck } from '../services/trialService.js';

const router = express.Router();

// POST /api/crons/trial-check
router.post('/trial-check', async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const secret = process.env.INSPO_INTERNAL_SECRET;

        if (!secret) {
            console.error('[Error] [Cron Endpoint] INSPO_INTERNAL_SECRET is not configured.');
            return res.status(500).json({ error: 'Server misconfiguration', message: 'Cron authentication is not configured' });
        }

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing cron secret' });
        }

        const token = authHeader.split('Bearer ')[1]?.trim();
        if (!token || token.length !== secret.length) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing cron secret' });
        }

        const isMatch = crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret));
        if (!isMatch) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or missing cron secret' });
        }

        console.log('[Cron Endpoint] Received valid trial check trigger.');
        const result = await runTrialCheck();
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('[Error] [Cron Endpoint] Trial check failed:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

export default router;
