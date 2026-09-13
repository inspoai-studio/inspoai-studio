import express from 'express';
import UserService from '../services/userService.js';

export default function setupUserRoutes(app, { authenticateUser }) {
    // Get user's referral code or generate one if missing
    app.get('/api/user/referral-code', authenticateUser, async (req, res) => {
        try {
            let user = await UserService.findByUid(req.user.uid || req.user.id);
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (!user.referral || !user.referral.referralCode) {
                // Generate a random code
                const code = 'REF-' + Math.random().toString(36).substring(2, 8).toUpperCase();
                const referral = {
                    ...user.referral,
                    referralCode: code,
                    referralsCount: user.referral?.referralsCount || 0
                };
                user = await UserService.updateUser(user.id, { referral });
            }

            res.json({
                success: true,
                referralCode: user.referral.referralCode,
                referralsCount: user.referral.referralsCount
            });
        } catch (error) {
            console.error('Error fetching referral code:', error);
            res.status(500).json({ error: 'Failed to fetch referral code' });
        }
    });

    // Apply a referral code
    app.post('/api/user/refer', authenticateUser, async (req, res) => {
        try {
            const { code } = req.body;
            if (!code) {
                return res.status(400).json({ error: 'Referral code is required' });
            }

            const currentUser = await UserService.findByUid(req.user.uid || req.user.id);
            if (!currentUser) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (currentUser.referral && currentUser.referral.referredBy) {
                return res.status(400).json({ error: 'You have already used a referral code' });
            }

            // Find the referring user by referral code
            const { supabaseAdmin } = await import('../config/supabaseClient.js');
            const { data: refData } = await supabaseAdmin
                .from('profiles')
                .select('id, credits, referral')
                .eq('referral->>referralCode', code)
                .single();

            if (!refData) {
                return res.status(404).json({ error: 'Invalid referral code' });
            }

            if (refData.id === currentUser.id) {
                return res.status(400).json({ error: 'You cannot refer yourself' });
            }

            // Give referring user 50 credits
            const refCredits = { ...(refData.credits || {}) };
            refCredits.bonus = (refCredits.bonus || 0) + 50;
            const refReferral = { ...(refData.referral || {}) };
            refReferral.referralsCount = (refReferral.referralsCount || 0) + 1;
            await UserService.updateUser(refData.id, { credits: refCredits, referral: refReferral });

            // Give new user 50 credits, mark as referred
            const curCredits = { ...(currentUser.credits || {}) };
            curCredits.bonus = (curCredits.bonus || 0) + 50;
            const curReferral = {
                ...currentUser.referral,
                referredBy: refData.id
            };
            await UserService.updateUser(currentUser.id, { credits: curCredits, referral: curReferral });

            res.json({
                success: true,
                message: 'Referral successful! You received 50 bonus credits.',
                bonusCredits: 50
            });
        } catch (error) {
            console.error('Error applying referral:', error);
            res.status(500).json({ error: 'Failed to apply referral code' });
        }
    });

    // ── Merge acquisition data from frontend (called once after first login) ──
    app.post('/api/user/acquisition', authenticateUser, async (req, res) => {
        try {
            const user = await UserService.findByUid(req.user.uid || req.user.id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            // Skip if already has referrer data (don't overwrite)
            if (user.acquisition?.referrer || user.acquisition?.channel) {
                return res.json({ success: true, skipped: true });
            }

            const { utmSource, utmMedium, utmCampaign, referrer, landingPage } = req.body;

            const acqUpdate = { ...(user.acquisition || {}) };

            // Referrer & channel classification
            if (referrer) {
                acqUpdate.referrer = referrer.substring(0, 500);
                try {
                    const refHost = new URL(referrer).hostname.toLowerCase().replace('www.', '');
                    acqUpdate.referrerDomain = refHost;
                    acqUpdate.channel = classifyChannel(refHost);
                } catch (_) {
                    acqUpdate.channel = 'referral';
                }
            } else {
                acqUpdate.channel = 'direct';
            }

            // UTM params override channel if present
            if (utmSource) {
                acqUpdate.utmSource = utmSource.substring(0, 100);
                if (utmMedium === 'cpc' || utmMedium === 'ppc') {
                    acqUpdate.channel = 'paid';
                } else {
                    acqUpdate.channel = 'campaign';
                }
            }
            if (utmMedium)   acqUpdate.utmMedium   = utmMedium.substring(0, 100);
            if (utmCampaign) acqUpdate.utmCampaign = utmCampaign.substring(0, 200);
            if (landingPage) acqUpdate.landingPage  = landingPage.substring(0, 500);

            await UserService.updateUser(user.id, { acquisition: acqUpdate });
            console.log(`Acquisition merged for ${user.email}: channel=${acqUpdate.channel} ref=${acqUpdate.referrerDomain || 'direct'}`);

            res.json({ success: true });
        } catch (error) {
            console.error('Error saving acquisition data:', error);
            res.status(500).json({ error: 'Failed to save acquisition data' });
        }
    });

    // Log user activity (DAU analytics)
    app.post('/api/user/activity', authenticateUser, async (req, res) => {
        try {
            const user = await UserService.findByUid(req.user.uid || req.user.id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const { feature, duration } = req.body;
            await UserService.logUserActivity(user.id, user.email, 'app_activity', { 
                feature: feature || 'General Navigation',
                duration: typeof duration === 'number' ? duration : 0
            });

            res.json({ success: true });
        } catch (error) {
            console.error('Error logging user activity:', error);
            res.status(500).json({ error: 'Failed to log user activity' });
        }
    });
}

// Classify traffic channel from referrer domain
function classifyChannel(domain) {
    const ORGANIC = ['google.com', 'google.co.in', 'google.co.uk', 'bing.com', 'yahoo.com', 'duckduckgo.com', 'baidu.com', 'yandex.ru', 'ecosia.org', 'search.brave.com'];
    const SOCIAL  = ['twitter.com', 'x.com', 't.co', 'linkedin.com', 'lnkd.in', 'facebook.com', 'fb.com', 'instagram.com', 'reddit.com', 'threads.net', 'pinterest.com', 'tiktok.com', 'youtube.com', 'youtu.be', 'mastodon.social'];
    const PRODUCT = ['producthunt.com', 'news.ycombinator.com', 'indiehackers.com', 'betalist.com', 'alternativeto.net'];
    const EMAIL   = ['mail.google.com', 'outlook.live.com', 'mail.yahoo.com'];

    if (ORGANIC.some(d => domain.includes(d))) return 'organic';
    if (SOCIAL.some(d => domain.includes(d)))  return 'social';
    if (PRODUCT.some(d => domain.includes(d))) return 'product_launch';
    if (EMAIL.some(d => domain.includes(d)))   return 'email';
    return 'referral';
}
