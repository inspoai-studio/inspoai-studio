import puppeteer from 'puppeteer-core';
import * as cheerio from 'cheerio';
import { URL } from 'url';
import sharp from 'sharp';
import { validateSafeUrl } from '../utils/ssrfGuard.js';

/**
 * TITAN SCANNER ENGINE (Algorithm-Only Edition)
 * ------------------------------------------------
 * A pure, heuristic-based scraping engine with:
 * 1. Advanced DOM traversal
 * 2. Statistical pixel analysis (K-Means)
 * 3. Deep Infrastructure Fingerprinting (Hosting, APIs, Payments)
 * 4. Smart Font Cleaning
 */

class WebsiteScanner {
    constructor() {
        this.browser = null;
        this.activeScans = 0;
        this.maxConcurrentScans = 2;
    }

    async init() {
        if (!this.browser) {
            const remoteWSEndpoint = process.env.BROWSERLESS_WSEXT;
            if (remoteWSEndpoint) {
                console.log(`[TITAN] Connecting to remote Chrome at: ${remoteWSEndpoint}`);
                this.browser = await puppeteer.connect({
                    browserWSEndpoint: remoteWSEndpoint,
                    ignoreHTTPSErrors: true
                });
            } else {
                // Resolve Chrome executable: puppeteer cache → system Chrome (Windows / Mac / Linux)
                const puppeteerCacheChrome = 'C:\\Users\\hp\\.cache\\puppeteer\\chrome\\win64-145.0.7632.77\\chrome-win64\\chrome.exe';
                const systemChromeWin = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
                const systemChromeWinUser = process.env.LOCALAPPDATA
                    ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`
                    : null;
                const systemChromeMac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                const systemChromiumMac = '/Applications/Chromium.app/Contents/MacOS/Chromium';
                const systemChromeLinux = '/usr/bin/google-chrome';

                const fs = await import('fs');
                let executablePath = null;
                for (const candidate of [puppeteerCacheChrome, systemChromeWinUser, systemChromeWin, systemChromeMac, systemChromiumMac, systemChromeLinux].filter(Boolean)) {
                    if (fs.existsSync(candidate)) {
                        executablePath = candidate;
                        break;
                    }
                }

                console.log(` [TITAN] Launching local headless Chrome: ${executablePath || 'auto-detect'}`);
                this.browser = await puppeteer.launch({
                    headless: 'new',
                    executablePath: executablePath || undefined,
                    ignoreHTTPSErrors: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--disable-web-security',
                        '--disable-features=IsolateOrigins,site-per-process'
                    ]
                });
            }
        }
    }


    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    /**
     * MAIN EXECUTION PIPELINE
     */
    async scan(url) {
        // Validate URL against SSRF (blocks private IPs, localhost, AWS metadata)
        const urlValidation = await validateSafeUrl(url);
        if (!urlValidation.isSafe) {
            throw new Error(`SSRF Blocked: ${urlValidation.error}`);
        }

        // Throttle concurrent browser instances to prevent resource exhaustion
        while (this.activeScans >= this.maxConcurrentScans) {
            await new Promise(r => setTimeout(r, 500));
        }
        this.activeScans++;

        let page = null;
        try {
            if (!this.browser) await this.init();
            page = await this.browser.newPage();

            /* ------------------------------------------------------
               PHASE 1: NETWORK & LOADING
               ------------------------------------------------------ */
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

            console.log(`\n [TITAN] Starting heavy-duty scan: ${url}`);

            // Navigate with advanced wait conditions
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Bypass WAF/Bot Checks
            const title = await page.title();
            if (this.isBlocked(title)) throw new Error('WAF Blocked Access');

            // Hydration Wait (for SPA)
            await new Promise(r => setTimeout(r, 3000));

            // Scroll to trigger lazy-loads
            await this.performHumanScroll(page);

            /* ------------------------------------------------------
               PHASE 2: DATA ACQUISITION
               ------------------------------------------------------ */
            // A. Capture Screenshot & Resize for Frontend (Optimization)
            const screenshotBuffer = await page.screenshot({ encoding: 'binary', fullPage: false });

            const displayBuffer = await sharp(screenshotBuffer)
                .resize(800, null, { fit: 'inside' })
                .jpeg({ quality: 80 })
                .toBuffer();

            const screenshotBase64 = displayBuffer.toString('base64');

            // B. Get Raw Content
            const content = await page.content();
            const $ = cheerio.load(content);
            const domain = new URL(url).hostname.replace('www.', '');

            /* ------------------------------------------------------
               PHASE 3: ADVANCED PROCESSING ENGINES
               ------------------------------------------------------ */

            console.log('[TITAN] Running Pixel-Level Color Extraction...');
            const colorProcessor = new ColorMatrix();
            const brandColors = await colorProcessor.extractPalette(displayBuffer); // Use smaller buffer

            console.log(' [TITAN] Running Deep Tech & Infra Fingerprinting...');
            const techDetector = new TechFingerprint();
            const techStack = await techDetector.detect(page, $);

            console.log(' [TITAN] Finding Video & Payment Sources...');
            const videos = await this.extractVideosLive(page);
            const paymentLinks = await this.extractPaymentLinks(page);

            console.log('[TITAN] Fetching Subdomains (Public Records)...');
            const domainScanner = new ExternalSubdomainScanner();
            const subdomainList = await domainScanner.findSubdomains(domain);

            console.log(' [TITAN] Mining Assets & Contacts...');
            const assets = await this.extractAssets(page, $, url);
            const contacts = this.extractContactsAdvanced($, content);
            const fonts = await this.extractFonts(page);

            console.log(' [TITAN] Launching Pricing Heuristics Engine...');
            const pricingEngine = new PricingHeuristics(this.browser);
            const pricingData = await pricingEngine.findAndExtract(page, url);

            /* ------------------------------------------------------
               PHASE 4: SYNTHESIS
               ------------------------------------------------------ */
            console.log('[Success] [TITAN] Scan Complete.');

            return {
                url,
                title,
                description: $('meta[name="description"]').attr('content')
                    || $('meta[property="og:description"]').attr('content')
                    || $('meta[name="twitter:description"]').attr('content')
                    || '',
                logo: assets.logo,
                screenshot: `data:image/jpeg;base64,${screenshotBase64}`,

                // Pure Algorithmic Results
                colors: brandColors,
                fonts: fonts,
                techStack: techStack, // Returns Objects {name, type}

                // Deep Data
                pricing: pricingData,
                subdomains: subdomainList, // Added Subdomains
                emails: contacts.emails,
                phones: contacts.phones,
                social: contacts.social,
                images: assets.images,
                videos: {
                    count: videos.length,
                    sources: videos
                },
                payments: {
                    links: paymentLinks
                },
                videos: {
                    count: videos.length,
                    sources: videos
                },
                payments: {
                    links: paymentLinks
                },

                // SEO Metadata
                meta: contacts.meta
            };

        } catch (error) {
            console.error('[Error] [TITAN] Fatal Error:', error);
            throw error;
        } finally {
            this.activeScans = Math.max(0, this.activeScans - 1);
            if (page && !page.isClosed()) {
                try {
                    await page.close();
                } catch {
                    // ignore cleanup error
                }
            }
        }
    }

    // --- UTILITIES ---

    async performHumanScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 150;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight || totalHeight > 10000) {
                        clearInterval(timer);
                        window.scrollTo(0, 0); // Reset
                        resolve();
                    }
                }, 40);
            });
        });
        await new Promise(r => setTimeout(r, 1000));
    }

    isBlocked(title) {
        return title.includes('Just a moment') || title.includes('Access denied') || title.includes('CAPTCHA');
    }

    async extractAssets(page, $, baseUrl) {
        let logo = $('link[rel="icon"]').attr('href')
            || $('meta[property="og:image"]').attr('content')
            || $('img[src*="logo"]').attr('src');

        if (logo && !logo.startsWith('http')) {
            try { logo = new URL(logo, baseUrl).href; } catch (e) { }
        }

        // Return more images for the modal view (Limit 60)
        const images = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
                .filter(img => img.naturalWidth > 50 && img.naturalHeight > 50 && !img.src.endsWith('.svg'))
                .map(img => img.src)
                .slice(0, 60);
        });

        return { logo, images };
    }

    extractContactsAdvanced($, content) {
        const text = $('body').text();

        // SEO / Meta Data (Strict: No default /sitemap.xml)
        const meta = {};
        const sitemap = $('link[rel="sitemap"]').attr('href') || $('link[rel="alternate"][type="application/rss+xml"]').attr('href');
        if (sitemap) meta.sitemap = sitemap;

        const keywords = $('meta[name="keywords"]').attr('content');
        if (keywords) meta.keywords = keywords;

        const generator = $('meta[name="generator"]').attr('content');
        if (generator) meta.generator = generator;

        // Strict Filter for Emails to remove junk/hashes
        const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
        const rawEmails = text.match(emailRegex) || [];

        const junkDomains = ['sentry.io', 'wix.com', 'example.com', 'node_modules', 'webpack', 'react', '2x.png', '.jpg', 'loader.js', 'sentry.io'];

        const emails = [...new Set(rawEmails.filter(e => {
            if (junkDomains.some(j => e.includes(j))) return false;

            const userPart = e.split('@')[0];
            if (userPart.length > 20 && /[0-9]/.test(userPart) && /[a-f]/.test(userPart)) return false;
            if (userPart.length > 25) return false;

            return true;
        }))].slice(0, 5);

        const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
        const rawPhones = text.match(phoneRegex) || [];

        const social = {};
        $('a[href]').each((_, el) => {
            const h = $(el).attr('href') || '';
            if (h.includes('twitter.com') || h.includes('x.com')) social.twitter = h;
            if (h.includes('linkedin.com')) social.linkedin = h;
            if (h.includes('facebook.com')) social.facebook = h;
            if (h.includes('instagram.com')) social.instagram = h;
            if (h.includes('youtube.com')) social.youtube = h;
        });

        return { emails, phones: [...new Set(rawPhones)].slice(0, 3), social, meta };
    }

    async extractFonts(page) {
        return await page.evaluate(() => {
            const fontData = new Map();
            const elements = document.querySelectorAll('h1, h2, h3, p, a, button, span');

            elements.forEach(el => {
                const style = window.getComputedStyle(el);
                const family = style.fontFamily;
                if (!family || family === 'inherit') return;

                // SMART CLEANING LOGIC (Strips hashes)
                const candidates = family.split(',').map(f => f.trim().replace(/['"]/g, ''));

                // Find first "Human" font
                let cleanName = candidates.find(f =>
                    !f.startsWith('wf_') &&
                    !f.startsWith('wfont_') &&
                    !f.includes('wix-madefor-text') &&
                    !f.startsWith('__') &&
                    f.length < 30
                );

                if (!cleanName) cleanName = candidates[0];

                if (['sans-serif', 'serif', 'monospace', 'system-ui'].includes(cleanName.toLowerCase())) return;

                let category = 'Sans-serif';
                if (cleanName.toLowerCase().includes('serif') && !cleanName.toLowerCase().includes('sans')) category = 'Serif';
                if (cleanName.toLowerCase().includes('mono')) category = 'Monospace';
                if (style.fontWeight > 600) category = 'Display';
                if (style.fontStyle === 'italic') category += ' Italic';
                if (cleanName.toLowerCase().includes('cursive') || cleanName.toLowerCase().includes('script')) category = 'Script';

                const key = cleanName;
                if (!fontData.has(key)) {
                    fontData.set(key, {
                        name: cleanName,
                        fullStack: family,
                        stats: { count: 0, colors: new Set(), weights: new Set() },
                        category
                    });
                }

                const entry = fontData.get(key);
                entry.stats.count++;
                if (style.color && style.color !== 'rgba(0, 0, 0, 0)' && style.color !== 'rgb(0, 0, 0)') {
                    entry.stats.colors.add(style.color);
                }
                entry.stats.weights.add(style.fontWeight);
            });

            return Array.from(fontData.values())
                .sort((a, b) => b.stats.count - a.stats.count)
                .slice(0, 5)
                .map(f => ({
                    name: f.name,
                    category: f.category,
                    colors: Array.from(f.stats.colors).slice(0, 3),
                    weights: Array.from(f.stats.weights).sort()
                }));
        });
    }

    async extractVideosLive(page) {
        return await page.evaluate(() => {
            const vids = new Set();
            // IFRAMES
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(el => {
                const src = el.src || el.getAttribute('data-src') || '';
                if (src.includes('youtube') || src.includes('vimeo') || src.includes('player') || src.includes('video')) {
                    vids.add(src);
                }
            });
            // VIDEO TAGS
            const videos = document.querySelectorAll('video');
            videos.forEach(el => {
                if (el.src && el.src.startsWith('http')) vids.add(el.src);
                el.querySelectorAll('source').forEach(s => {
                    if (s.src && s.src.startsWith('http')) vids.add(s.src);
                });
            });
            // LINKS
            const links = document.querySelectorAll('a[href]');
            links.forEach(el => {
                const href = el.href;
                if (!href) return;
                if (href.match(/\.(mp4|mov|webm)$/i)) vids.add(href);
                if (href.includes('youtube.com/watch') || href.includes('vimeo.com/')) vids.add(href);
            });
            return Array.from(vids).slice(0, 8);
        });
    }

    async extractPaymentLinks(page) {
        return await page.evaluate(() => {
            const paymentGateways = ['stripe.com', 'paypal.com', 'gumroad.com', 'lemonsqueezy.com', 'shopify.com/cart', 'buy.stripe.com', 'checkout.stripe.com'];
            const links = new Set();
            const anchors = document.querySelectorAll('a[href]');
            anchors.forEach(el => {
                const href = el.href || '';
                if (paymentGateways.some(gw => href.includes(gw)) && !href.includes('status')) {
                    links.add(href);
                }
            });
            return Array.from(links).slice(0, 5);
        });
    }
}

/**
 * MODULE 1: COLOR MATRIX
 */
class ColorMatrix {
    async extractPalette(imageBuffer) {
        try {
            const { data, info } = await sharp(imageBuffer)
                .resize(100, 100, { fit: 'cover' })
                .removeAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            const pixelCount = info.width * info.height;
            const colorMap = {};

            for (let i = 0; i < pixelCount * 3; i += 3) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                if (this.isBoring(r, g, b)) continue;

                const qr = Math.round(r / 15) * 15;
                const qg = Math.round(g / 15) * 15;
                const qb = Math.round(b / 15) * 15;

                const hex = this.rgbToHex(qr, qg, qb);
                colorMap[hex] = (colorMap[hex] || 0) + 1;
            }

            return Object.entries(colorMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 8)
                .map(entry => entry[0]);

        } catch (e) {
            console.error('ColorMatrix Error:', e);
            return [];
        }
    }

    isBoring(r, g, b) {
        const isWhite = r > 240 && g > 240 && b > 240;
        const isBlack = r < 20 && g < 20 && b < 20;
        const isGray = Math.abs(r - g) < 10 && Math.abs(g - b) < 10;
        return isWhite || isBlack || isGray;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }
}

/**
 * MODULE 2: DEEP TECH & INFRASTRUCTURE FINGERPRINT
 */
class TechFingerprint {
    async detect(page, $) {
        // 1. JavaScript Runtime Detection
        const jsTech = await page.evaluate(() => {
            const tech = {
                platform: [],
                hosting: [],
                payments: [],
                apis: [],
                libs: []
            };

            // --- CORE CMS / PLATFORM (Global Vars) ---
            if (window.wix || document.querySelector('[href*="wix.com"]')) tech.platform.push('Wix');
            if (window.Shopify) tech.platform.push('Shopify');
            if (window.Webflow) tech.platform.push('Webflow');
            if (window.Squarespace) tech.platform.push('Squarespace');
            if (window.WordPress || window.wp) tech.platform.push('WordPress');
            if (window.Ghost) tech.platform.push('Ghost');
            if (window.Framer || document.querySelector('meta[name="generator"][content*="Framer"]')) tech.platform.push('Framer');
            if (window.__NEXT_DATA__) tech.libs.push('Next.js');
            if (window.BCData || document.querySelector('[data-content-region]')) tech.platform.push('BigCommerce');
            if (window._hsq || window.hubspot) tech.platform.push('HubSpot CMS');

            // --- PAYMENTS ---
            const scripts = Array.from(document.querySelectorAll('script')).map(s => s.src);
            if (window.Stripe || scripts.some(s => s.includes('js.stripe.com'))) tech.payments.push('Stripe');
            if (window.paypal || scripts.some(s => s.includes('paypal.com/sdk'))) tech.payments.push('PayPal');
            if (window.Razorpay || scripts.some(s => s.includes('razorpay.com'))) tech.payments.push('Razorpay');

            // --- 3rd PARTY APIs ---
            if (window.ga || window.gtag) tech.apis.push('Google Analytics');
            if (window.fbq) tech.apis.push('Meta Pixel');
            if (window.Intercom) tech.apis.push('Intercom');
            if (window.HSCW) tech.apis.push('HubSpot');

            // --- HOSTING (Client Clues) ---
            if (window.__vercel_analytics) tech.hosting.push('Vercel');

            return tech;
        });

        // 2. HTML Signals (Cheerio) — Expanded CMS Detection
        const html = $.html();
        const generator = $('meta[name="generator"]').attr('content') || '';

        // WordPress
        if (generator.includes('WordPress') || $('link[rel="wp-json"]').length > 0 || html.includes('wp-content')) {
            jsTech.platform.push('WordPress');
        }
        // Joomla
        if (generator.includes('Joomla') || html.includes('/media/jui/') || html.includes('Joomla!')) {
            jsTech.platform.push('Joomla');
        }
        // Drupal
        if (generator.includes('Drupal') || html.includes('drupal.js') || html.includes('Drupal.settings')) {
            jsTech.platform.push('Drupal');
        }
        // Ghost
        if (generator.includes('Ghost') || html.includes('ghost-')) {
            jsTech.platform.push('Ghost');
        }
        // Adobe Commerce (Magento)
        if (html.includes('Mage.') || html.includes('mage/cookies') || html.includes('magento') || $('script[src*="mage"]').length > 0) {
            jsTech.platform.push('Adobe Commerce (Magento)');
        }
        // PrestaShop
        if (generator.includes('PrestaShop') || html.includes('prestashop') || html.includes('PrestaShop')) {
            jsTech.platform.push('PrestaShop');
        }
        // TYPO3
        if (generator.includes('TYPO3') || html.includes('typo3')) {
            jsTech.platform.push('TYPO3');
        }
        // Sitecore
        if (html.includes('sitecore') || html.includes('Sitecore') || html.includes('sc_site')) {
            jsTech.platform.push('Sitecore');
        }
        // Adobe Experience Manager
        if (html.includes('/etc.clientlibs/') || html.includes('cq5dam') || html.includes('aem-')) {
            jsTech.platform.push('Adobe Experience Manager');
        }
        // Kentico
        if (generator.includes('Kentico') || html.includes('CMSPages') || html.includes('Kentico')) {
            jsTech.platform.push('Kentico');
        }
        // Blogger
        if (generator.includes('Blogger') || html.includes('blogger.com') || html.includes('blogspot.com')) {
            jsTech.platform.push('Blogger');
        }
        // Umbraco
        if (generator.includes('Umbraco') || html.includes('umbraco')) {
            jsTech.platform.push('Umbraco');
        }
        // Contentful
        if (html.includes('contentful') || html.includes('ctfassets')) {
            jsTech.platform.push('Contentful');
        }
        // Strapi
        if (html.includes('strapi') || (html.includes('/uploads/') && html.includes('api::'))) {
            jsTech.platform.push('Strapi');
        }
        // HubSpot CMS (HTML)
        if (html.includes('hs-scripts.com') || html.includes('hs_cos_wrapper')) {
            jsTech.platform.push('HubSpot CMS');
        }
        // Framer (HTML)
        if (generator.includes('Framer') || html.includes('framer.com') || html.includes('framerusercontent')) {
            jsTech.platform.push('Framer');
        }
        // Webflow (HTML)
        if (generator.includes('Webflow') || html.includes('webflow') || $('html[data-wf-site]').length > 0) {
            jsTech.platform.push('Webflow');
        }
        // Squarespace (HTML)
        if (html.includes('squarespace.com') || html.includes('squarespace-cdn')) {
            jsTech.platform.push('Squarespace');
        }
        // Wix (HTML)
        if (html.includes('wix.com') || html.includes('parastorage.com') || html.includes('wixsite.com')) {
            jsTech.platform.push('Wix');
        }
        // Ceros
        if (html.includes('ceros.com') || html.includes('view.ceros.com')) {
            jsTech.platform.push('Ceros');
        }
        // Turtl
        if (html.includes('turtl.co') || html.includes('turtl')) {
            jsTech.platform.push('Turtl');
        }
        // Cleverstory
        if (html.includes('cleverstory') || html.includes('paperflite.com/cleverstory')) {
            jsTech.platform.push('Cleverstory');
        }

        // Gatsby
        if (generator.includes('Gatsby') || $('div#___gatsby').length > 0) jsTech.libs.push('Gatsby');

        // Hosting & Libs
        if (html.includes('amazonaws.com') || html.includes('cloudfront.net')) jsTech.hosting.push('AWS');

        // Libraries (Only Major)
        if ($('link[href*="tailwind"]').length || $('div[class*="text-"]').length > 20) jsTech.libs.push('Tailwind CSS');
        if ($('link[href*="bootstrap"]').length) jsTech.libs.push('Bootstrap');

        // Combine all findings
        const allTech = [
            ...jsTech.platform.map(t => ({ name: t, type: 'Platform' })),
            ...jsTech.hosting.map(t => ({ name: t, type: 'Hosting' })),
            ...jsTech.payments.map(t => ({ name: t, type: 'Payment' })),
            ...jsTech.apis.map(t => ({ name: t, type: 'API' })),
            ...jsTech.libs.map(t => ({ name: t, type: 'Library' }))
        ];

        // De-duplicate by name
        const uniqueTech = [];
        const seen = new Set();
        for (const t of allTech) {
            if (!seen.has(t.name)) {
                seen.add(t.name);
                uniqueTech.push(t);
            }
        }

        return uniqueTech;
    }
}

/**
 * MODULE 3: PRICING HEURISTICS (SHOTGUN STRATEGY)
 * 1. Forcefully navigates to /pricing if link missing.
 * 2. Greedily grabs ANY container with a price in it.
 */
class PricingHeuristics {
    constructor(browser) {
        this.browser = browser;
    }

    async findAndExtract(rootPage, baseUrl) {
        let pricingUrl = await this.findPricingLink(rootPage, baseUrl);

        // FORCE FALLBACK: If no link found, blindly go to /pricing
        // This fixes sites where the link is hidden/named uniquely
        if (!pricingUrl) {
            // Check if we are already on the pricing page logic from before
            if (rootPage.url().includes('/pricing') || rootPage.url().includes('/plans')) {
                return await this.extractGreedy(rootPage);
            }
            // Construct standard URL
            const urlObj = new URL(baseUrl);
            pricingUrl = `${urlObj.origin}/pricing`;
            console.log(`    -> Force-navigating to standard path: ${pricingUrl}`);
        } else {
            console.log(`    -> Found Pricing Link: ${pricingUrl}`);
        }

        // Navigate and Scrape
        const pPage = await this.browser.newPage();
        try {
            await pPage.goto(pricingUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
            // Wait for JS rendering
            await new Promise(r => setTimeout(r, 2000));

            const data = await this.extractGreedy(pPage);
            await pPage.close();

            if (data.hasPricing) {
                return { ...data, url: pricingUrl };
            }

            console.log('    [Warning] /pricing page loaded but no data found. Trying /plans...');
            return { hasPricing: false, plans: [] };

        } catch (e) {
            console.log(`    [Warning] Could not load pricing page: ${e.message}`);
            await pPage.close();
            // If forced nav failed, try extracting from Home Page as last resort
            return await this.extractGreedy(rootPage);
        }
    }

    async findPricingLink(page, baseUrl) {
        return await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            // STRICT MATCH: Only "Pricing" or "Plans"
            const match = anchors.find(a => {
                const txt = (a.innerText || '').trim().toLowerCase();
                return txt === 'pricing' || txt === 'plans';
            });
            return match ? match.href : null;
        });
    }

    /**
     * GREEDY EXTRACTOR
     * Finds "$", grabs the box its in, returns it.
     */
    async extractGreedy(page) {
        return await page.evaluate(() => {
            const plans = [];

            // 1. Find all Dollar Signs / Currencies
            const nodeIterator = document.createNodeIterator(
                document.body,
                NodeFilter.SHOW_TEXT,
                (node) => /[$€£₹]\s?\d+/.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
            );

            const priceNodes = [];
            let currentNode;
            while (currentNode = nodeIterator.nextNode()) {
                priceNodes.push(currentNode.parentElement);
            }

            // 2. For each price, find its "Card"
            const processedCards = new Set();

            priceNodes.forEach(priceEl => {
                // Walk up to find a "substantial" container (div/section/article)
                let card = priceEl;
                let depth = 0;

                // Heuristic: Stop at the first container that has a border, shadow, or specific class
                // OR just stop at 4 levels up (standard HTML structure)
                while (card && card.tagName !== 'BODY' && depth < 5) {
                    const style = window.getComputedStyle(card);
                    const isGrid = style.display === 'flex' || style.display === 'grid';
                    const hasBorder = style.borderWidth !== '0px' || style.boxShadow !== 'none';
                    const hasClass = (card.className || '').toString().includes('card') || (card.className || '').toString().includes('plan');

                    if ((hasBorder || hasClass || isGrid) && card.innerText.length > 50) {
                        break;
                    }
                    card = card.parentElement;
                    depth++;
                }

                if (!card || processedCards.has(card)) return;
                processedCards.add(card);

                // 3. Extract Data from this "Card"
                const text = card.innerText.trim();
                const lines = text.split('\n').filter(l => l.trim().length > 0);

                // Price: The text node we started with (or regex match the whole card)
                const priceMatch = text.match(/[$€£₹]\s?(\d+([.,]\d{1,2})?)(\s?\/(\s?mo|yr|month|year))?/i);
                const price = priceMatch ? priceMatch[0] : 'Free';

                // Title: The first meaningful line that ISN'T the price
                let title = lines[0];
                if (title.length > 30 || title.includes('$')) title = lines.find(l => l.length < 20 && !l.includes('$')) || 'Plan';

                // Features: Any line starting with a checkmark OR simple text lines
                const features = lines.filter(l =>
                    (l.length > 5 && l.length < 60) &&
                    l !== title &&
                    !l.includes(price) &&
                    !l.toLowerCase().includes('sign up')
                ).slice(0, 5);

                if (title && price) {
                    plans.push({ name: title, price, features });
                }
            });

            // Clean & Sort
            const uniquePlans = [];
            const seenNames = new Set();
            plans.forEach(p => {
                if (!seenNames.has(p.name)) {
                    seenNames.add(p.name);
                    uniquePlans.push(p);
                }
            });

            return {
                hasPricing: uniquePlans.length > 0,
                plans: uniquePlans.sort((a, b) => a.price.length - b.price.length).slice(0, 4)
            };
        });
    }
}

/**
 * MODULE 4: EXTERNAL SUBDOMAIN SCANNER (crt.sh)
 * Uses Certificate Transparency logs to find subdomains.
 */
class ExternalSubdomainScanner {
    async findSubdomains(domain) {
        try {
            // Using crt.sh (free public API for certificate transparency)
            // fetch is available in Node 18+ natively.
            const response = await fetch(`https://crt.sh/?q=%.${domain}&output=json`);
            if (!response.ok) return [];

            const data = await response.json();

            // Extract and clean subdomains
            const subdomains = new Set();
            data.forEach(entry => {
                const names = entry.name_value.split('\n');
                names.forEach(name => {
                    const clean = name.trim().toLowerCase().replace('*.', '');
                    if (clean !== domain && clean.endsWith(domain)) {
                        subdomains.add(clean);
                    }
                });
            });

            return Array.from(subdomains).slice(0, 15); // Return top 15
        } catch (error) {
            console.log('    [Warning] Subdomain scan failed/timed out (crt.sh busy).');
            return [];
        }
    }
}

export const websiteScanner = new WebsiteScanner();
