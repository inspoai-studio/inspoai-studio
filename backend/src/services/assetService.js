import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { understandUIQuery, embedText } from '../utils/queryUnderstanding.js';
import { semanticSearch, isSemanticSearchReady } from './pineconeService.js';
import crypto from 'crypto';

class AssetService {
    /**
     * Saves unique assets to Supabase
     */
    async saveAssets(assets, query) {
        if (!supabase) return { success: false, message: 'Supabase client not initialized' };
        if (!assets || assets.length === 0) return { success: true, saved: 0 };

        try {
            const formattedAssets = assets.map(asset => {
                const image = asset.image || asset;
                const src = image.image || image.src;
                const sourceUrl = image.url || image.sourceUrl;
                const fingerprint = crypto.createHash('md5').update(src).digest('hex');

                return {
                    id: crypto.randomUUID(),
                    src: src,
                    url: sourceUrl,
                    title: image.title || 'Untitled Design',
                    source: image.source || 'Scraped',
                    query: query.toLowerCase().trim(),
                    tags: this.extractKeywords(image.title || query),
                    width: image.width || null,
                    height: image.height || null,
                    fingerprint: fingerprint
                };
            });

            const { data, error } = await supabase
                .from('design_assets')
                .upsert(formattedAssets, { onConflict: 'src' });

            if (error) {
                console.error('[Error] Supabase upsert error:', error.message);
                return { success: false, error: error.message };
            }

            return { success: true, saved: formattedAssets.length };
        } catch (error) {
            console.error('[Error] AssetService.saveAssets failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * WORLD-CLASS UI SEARCH
     *
     * Strategy:
     * 1. Build local intent from keywords (page_types, ux_patterns, tags)
     * 2. Run structured Supabase queries (Tier 1) — highest precision
     * 3. Brand pinning for known apps (Brand Tier) — pins to very top
     * 4. FTS with noise-word stripping (Tier 2) — broad fallback
     * 5. Final order: Brand > Tier1 > Tier2
     * ═══════════════════════════════════════════════════════════════════
     */
    async searchUIAssets(query, limit = 100, page = 0) {
        if (!supabase) return [];
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];

        // ── Cache check ──────────────────────────────────────────────────
        const cacheKey = `ui-v3:${q}:${limit}:${page}`;
        const cached = AssetService._cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
            return cached.data;
        }

        const offset = page * limit;

        try {
            // ── Semantic search via Pinecone (when available) ─────────
            const USE_SEMANTIC = isSemanticSearchReady();

            // ── AI QUERY UNDERSTANDING (GPT-4o-mini) ──────────────────
            // Use AI to enrich the query BEFORE searching Pinecone.
            // "fintech dashboard" → "fintech financial services app dashboard UI design"
            // This dramatically improves semantic search relevance.
            let intent;
            if (USE_SEMANTIC && page === 0) {
                try {
                    intent = await understandUIQuery(query);
                } catch (aiErr) {
                    console.warn('[Warning] AI query understanding failed, using local intent:', aiErr.message);
                    intent = this._buildLocalIntent(q);
                }
            } else {
                intent = this._buildLocalIntent(q);
            }

            if (USE_SEMANTIC && page === 0) {
                // Page 1: Semantic search first — use AI-enhanced query
                const MIN_SEMANTIC_RESULTS = 10;
                const searchQuery = intent.enhanced_query || q;
                const semanticResults = await this._semanticSearchPath(searchQuery, limit, 0, intent);

                if (semanticResults.length >= MIN_SEMANTIC_RESULTS) {
                    // ── Apply app diversity to semantic results ──
                    const diversified = this._enforceAppDiversity(semanticResults);
                    AssetService._cache.set(cacheKey, { ts: Date.now(), data: diversified });
                    if (AssetService._cache.size > 100) {
                        AssetService._cache.delete(AssetService._cache.keys().next().value);
                    }
                    return diversified;
                }

                // If semantic returns nothing or too few, fall through to keyword
                if (semanticResults.length > 0) {
                } else {
                }
            }

            // Page 2+ or semantic unavailable: Keyword search from Supabase
            return this._keywordFallback(q, limit, offset, intent);

            // ── Vector search path (requires OpenAI for embeddings) ──────
            intent = await understandUIQuery(query);
            let embedding;
            try {
                embedding = await embedText(intent.enhanced_query);
            } catch (embedErr) {
                console.warn('[Warning] Embedding failed, falling back to keyword search:', embedErr.message);
                return this._keywordFallback(q, limit, offset, intent);
            }

            const filterPlatform = intent.platforms.length === 1 ? intent.platforms[0] : null;
            const filterUxPattern = intent.ux_patterns.length > 0 ? intent.ux_patterns[0] : null;
            const filterPageType = intent.page_types.length > 0 ? intent.page_types[0] : null;


            const rpcPromise = supabaseAdmin.rpc('match_design_assets', {
                query_embedding: embedding,
                filter_platform: filterPlatform,
                filter_ux_pattern: filterUxPattern,
                filter_page_type: filterPageType,
                match_count: limit,
                offset_val: offset,
            });
            const timeoutPromise = new Promise(resolve =>
                setTimeout(() => resolve({ data: null, error: { message: 'RPC timeout (20s) – falling back to keyword search' } }), 20000)
            );
            const { data: vectorResults, error: rpcError } = await Promise.race([rpcPromise, timeoutPromise]);

            if (rpcError) {
                console.error('[Error] Vector RPC error:', rpcError.message);
                return this._keywordFallback(q, limit, offset, intent);
            }

            const rows = vectorResults || [];

            const results = rows.map(row => {
                const formatted = this.formatAssetForResult(row);
                return {
                    image: { ...formatted.image, relevanceScore: row.similarity },
                    similarity: row.similarity,
                    reasons: ['Real App Screenshot', 'Semantic Match', 'UI Reference Library'],
                    _vectorResult: true,
                };
            });

            AssetService._cache.set(cacheKey, { ts: Date.now(), data: results });
            if (AssetService._cache.size > 100) {
                AssetService._cache.delete(AssetService._cache.keys().next().value);
            }

            return results;

        } catch (err) {
            console.error('[Error] searchUIAssets failed:', err.message);
            return this._keywordFallback(q, limit, offset, intent);
        }
    }

    /**
     * Semantic search via Pinecone — returns formatted results with full asset data.
     */
    async _semanticSearchPath(query, limit = 80, offset = 0, intent = {}) {
        try {
            // Build Pinecone metadata filter
            let filter = null;
            if (intent.platforms?.length === 1) {
                filter = { platform: intent.platforms[0] };
            }

            const matches = await semanticSearch(query, limit + offset, filter);
            if (!matches || matches.length === 0) return [];

            // Get the IDs for this page
            const pageMatches = matches.slice(offset, offset + limit);
            const ids = pageMatches.map(m => m.id);

            // Fetch full records from Supabase
            const COLS = 'id, src, thumbnail, url, title, site_name, site_domain, source, platform, ux_patterns, ui_elements, page_types, tags, width, height';
            const { data: rows, error } = await supabase
                .from('design_assets')
                .select(COLS)
                .in('id', ids);

            if (error || !rows) return [];

            // Map by ID for easy lookup
            const rowMap = new Map(rows.map(r => [r.id, r]));

            // Preserve Pinecone ranking order
            return pageMatches
                .filter(m => rowMap.has(m.id))
                .map((match, i) => {
                    const row = rowMap.get(match.id);
                    const formatted = this.formatAssetForResult(row);
                    return {
                        image: {
                            ...formatted.image,
                            relevanceScore: match.score,
                        },
                        similarity: match.score,
                        reasons: ['Semantic Match', 'AI-Powered', 'UI Reference Library'],
                        _vectorResult: true,
                    };
                });

        } catch (err) {
            console.error('[Error] _semanticSearchPath failed:', err.message);
            return [];
        }
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * 3-TIER KEYWORD SEARCH
     *
     * TIER 1 (Structured) — page_types, ux_patterns, tags, ui_elements
     *   Exact array-contains queries against curated metadata columns.
     *   "login screen" → contains('page_types', ['Log In']) → real login UIs
     *   → fills tier1Rows (highest precision, ranks 2nd after brand)
     *
     * BRAND TIER — known product/app names
     *   ilike on site_name + title + source for exact brand matches.
     *   "airbnb login" → site_name contains 'airbnb' → Airbnb screens first
     *   → fills brandRows (ranks 1st)
     *
     * TIER 2 (FTS + ilike) — broad fallback
     *   FTS on title_query_tags with noise words stripped first.
     *   "login screen" → FTS on "login" (not "screen" which returns everything)
     *   → fills tier2Rows (ranks last)
     *
     * FINAL ORDER: brandRows > tier1Rows > tier2Rows
     * ═══════════════════════════════════════════════════════════════════
     */
    async _keywordFallback(q, limit = 100, offset = 0, intent = {}) {

        const COLS = 'id, src, thumbnail, url, title, site_name, site_domain, source, platform, ux_patterns, ui_elements, page_types, tags, width, height';
        const seenIds = new Set();

        // Three priority buckets
        const brandRows = [];  // exact brand match — ranks 1st
        const tier1Rows = [];  // structured metadata match — ranks 2nd
        const tier2Rows = [];  // FTS/ilike broad fallback — ranks 3rd

        const mergeBrand = (rows) => {
            for (const row of (rows || [])) {
                if (row?.id && !seenIds.has(row.id)) { seenIds.add(row.id); brandRows.push(row); }
            }
        };
        const mergeTier1 = (rows) => {
            for (const row of (rows || [])) {
                if (row?.id && !seenIds.has(row.id)) { seenIds.add(row.id); tier1Rows.push(row); }
            }
        };
        const mergeTier2 = (rows) => {
            for (const row of (rows || [])) {
                if (row?.id && !seenIds.has(row.id)) { seenIds.add(row.id); tier2Rows.push(row); }
            }
        };

        // ── Platform filter ──────────────────────────────────────────
        const filterPlatform = (intent.platforms && intent.platforms.length === 1)
            ? intent.platforms[0] : null;

        const withPlatform = (qb) => {
            if (!filterPlatform) return qb;
            if (filterPlatform === 'web') return qb.or('platform.eq.web,platform.is.null');
            return qb.eq('platform', filterPlatform);
        };

        const FETCH = Math.min(limit + 30, 150);

        // ═══════════════════════════════════════════════════════════════
        // TIER 1 — Structured array queries (highest precision, run FIRST)
        // ═══════════════════════════════════════════════════════════════
        const tier1Promises = [];

        // page_types (e.g. 'Log In', 'Sign Up', 'Dashboard')
        for (const pt of (intent.page_types || []).slice(0, 3)) {
            tier1Promises.push(
                withPlatform(supabase.from('design_assets').select(COLS).contains('page_types', [pt])).limit(FETCH).then(r => r.data)
            );
        }
        // ux_patterns (e.g. 'Onboarding', 'Dark Mode', 'Chat')
        for (const ux of (intent.ux_patterns || []).slice(0, 3)) {
            tier1Promises.push(
                withPlatform(supabase.from('design_assets').select(COLS).contains('ux_patterns', [ux])).limit(FETCH).then(r => r.data)
            );
        }
        // tags (e.g. 'Dark Mode', 'Login', 'Payment')
        for (const tag of (intent.tags || []).slice(0, 3)) {
            tier1Promises.push(
                withPlatform(supabase.from('design_assets').select(COLS).contains('tags', [tag])).limit(FETCH).then(r => r.data)
            );
        }
        // ui_elements (e.g. 'Button', 'Modal', 'Tabs')
        for (const el of (intent.ui_elements || []).slice(0, 2)) {
            tier1Promises.push(
                withPlatform(supabase.from('design_assets').select(COLS).contains('ui_elements', [el])).limit(FETCH).then(r => r.data)
            );
        }

        if (tier1Promises.length > 0) {
            const t1res = await Promise.allSettled(tier1Promises);
            for (const s of t1res) { if (s.status === 'fulfilled' && s.value) mergeTier1(s.value); }
        }

        // ═══════════════════════════════════════════════════════════════
        // BRAND TIER — known product/app name pinning
        // ═══════════════════════════════════════════════════════════════
        const KNOWN_BRANDS = [
            // AI / Productivity
            'claude', 'anthropic', 'chatgpt', 'openai', 'perplexity', 'copilot',
            'microsoft copilot', 'google bard', 'sana ai', 'copy.ai', 'loom', 'lensa ai',
            // Design tools
            'figma', 'framer', 'webflow', 'sketch', 'invision', 'mural', 'miro',
            'artboard studio', 'jitter', 'pixso', 'editor x', 'excalidraw', 'bezi',
            'flutterflow', 'modyfi', 'vectary', 'relume', 'tilda', 'squarespace',
            'wix', 'lottiefiles', 'craftwork design', 'flowmapp', 'canva', 'adobe',
            // Productivity / Project management
            'notion', 'asana', 'monday', 'monday.com', 'wrike', 'clickup', 'airtable', 'fibery',
            'retool', 'rows', 'slite', 'slab', 'pitch', 'cron', 'amie', 'superlist',
            'todoist', 'around', 'twist', 'missive', 'front', 'ifttt', 'make', 'zapier',
            'jira', 'aboard', 'attio', 'dock', 'hubspot', 'trello', 'evernote',
            'obsidian', 'coda', 'linear', 'raycast', 'superhuman',
            // Communication / Social
            'slack', 'discord', 'telegram', 'whatsapp', 'threads', 'twitter',
            'linkedin', 'instagram', 'tiktok', 'youtube', 'pinterest', 'medium',
            'peerlist', 'intercom', 'zendesk', 'luma', 'reddit', 'snapchat',
            'zoom', 'teams', 'substack',
            // Finance / Payments
            'revolut', 'klarna', 'wise', 'coinbase', 'stripe', 'square', 'robinhood',
            'kraken', 'acorns', 'wealthsimple', 'opensea', 'phantom', 'lemon squeezy',
            'patreon', 'gofundme', 'kickstarter', 'monzo', 'nubank', 'world app',
            'venmo', 'cashapp', 'cash app', 'paypal', 'afterpay', 'binance', 'metamask',
            'zerodha',
            // Developer tools
            'github', 'vercel', 'supabase', 'jetbrains', 'arc', 'arc browser', 'httpie',
            'doppler', 'stellate', 'apollo graphql', 'scale ai', 'cohere', 'dub',
            'producthunt', 'product hunt', 'wordpress',
            // E-commerce / Shopping
            'shopify', 'asos', 'zara', 'walmart', 'west elm', 'lulu and georgia',
            'urban outfitters', 'new balance', 'lego', 'dji', 'blue apron',
            'amazon', 'ebay', 'etsy', 'nike', 'adidas', 'sephora', 'meesho',
            // Streaming / Media
            'netflix', 'spotify', 'twitch', 'vimeo', 'suno', 'stable audio', 'soundtrap',
            'apple music', 'the athletic', 'bloomberg', 'the new york times',
            'masterclass', 'skillshare', 'headspace', 'calm', 'endel', 'rise',
            'dropbox', 'pexels', 'vsco',
            // Health / Fitness
            'hims', 'flo', 'classpass', 'nike training club', 'gentler streak',
            'any distance', 'foodvisor', 'kitchen stories', 'yummly',
            'peloton', 'strava', 'myfitnesspal', 'fitbit',
            // Travel / Transport
            'airbnb', 'uber', 'uber eats', 'rivian', 'seatgeek', 'expedia', 'trulia',
            'google maps', 'gowalla', 'doordash',
            // Dating
            'hinge', 'bumble', 'tinder',
            // Education
            'duolingo', 'quizlet', 'brilliant', 'coursera', 'udemy',
            'khan academy', 'byju', 'practo',
            // Misc apps
            'grammarly', 'mailchimp', 'salesforce', 'dream11', 'blinkit',
            'docusign', 'yelp', 'coolors', 'tome', 'savee', 'skiff',
            'awwwards', 'bear', 'flighty', 'carrot weather',
            'dribbble', 'behance',
        ];

        const lq = q.toLowerCase();
        const detectedBrand = KNOWN_BRANDS.find(brand => lq.includes(brand));

        if (detectedBrand) {
            const [bySiteName, byTitle, bySource] = await Promise.allSettled([
                withPlatform(supabase.from('design_assets').select(COLS).ilike('site_name', `%${detectedBrand}%`)).limit(120).then(r => r.data),
                withPlatform(supabase.from('design_assets').select(COLS).ilike('title', `%${detectedBrand}%`)).limit(60).then(r => r.data),
                withPlatform(supabase.from('design_assets').select(COLS).ilike('source', `%${detectedBrand}%`)).limit(60).then(r => r.data),
            ]);
            for (const s of [bySiteName, byTitle, bySource]) {
                mergeBrand(s.status === 'fulfilled' ? s.value : []);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // TIER 2 — FTS + ilike (broad fallback with noise-word stripping)
        //
        // UI noise words are stripped before FTS so:
        //   "login screen"   → FTS on "login"       (not "screen" = 91k records)
        //   "chat interface" → FTS on "chat"
        //   "dark mode dashboard" → FTS on "dark mode dashboard" (all meaningful)
        // ═══════════════════════════════════════════════════════════════
        const UI_NOISE_WORDS = new Set([
            'screen', 'screens', 'ui', 'ux', 'interface', 'interfaces',
            'design', 'designs', 'app', 'apps', 'mobile', 'view', 'views',
            'page', 'pages', 'layout', 'layouts', 'component', 'components',
            'inspire', 'inspiration', 'inspo', 'example', 'examples',
            'template', 'templates', 'mockup', 'mockups', 'concept',
            'show', 'me', 'the', 'a', 'an', 'give', 'find', 'get',
        ]);

        const ftsQuery = q
            .split(/\s+/)
            .filter(w => !UI_NOISE_WORDS.has(w.toLowerCase()) && w.length > 1)
            .join(' ')
            .trim() || q;


        const tier2Promises = [
            withPlatform(
                supabase.from('design_assets').select(COLS)
                    .textSearch('title_query_tags', ftsQuery, { type: 'websearch', config: 'english' })
            ).limit(FETCH).then(r => r.data)
        ];

        // ilike on meaningful words
        const meaningfulWords = ftsQuery.split(/\s+/).filter(w => w.length > 3);
        for (const w of meaningfulWords.slice(0, 2)) {
            if (detectedBrand && w.toLowerCase() === detectedBrand) continue;
            tier2Promises.push(
                withPlatform(supabase.from('design_assets').select(COLS).ilike('title', `%${w}%`)).limit(FETCH).then(r => r.data)
            );
        }

        const t2res = await Promise.allSettled(tier2Promises);
        for (const s of t2res) { if (s.status === 'fulfilled' && s.value) mergeTier2(s.value); }

        // ═══════════════════════════════════════════════════════════════
        // TIER 3 — Industry-aware query expansion
        // If we detected an industry (e.g. fintech, ecommerce), search for
        // well-known apps in that category to diversify results.
        // ═══════════════════════════════════════════════════════════════
        const INDUSTRY_WELL_KNOWN = {
            'fintech': ['revolut', 'monzo', 'robinhood', 'coinbase', 'venmo', 'paypal', 'stripe', 'wise', 'n26', 'klarna', 'acorns', 'cash app'],
            'ecommerce': ['shopify', 'amazon', 'etsy', 'nike', 'zara', 'asos', 'shein', 'wish', 'ebay'],
            'health': ['headspace', 'calm', 'flo', 'myfitnesspal', 'strava', 'peloton', 'fitbit', 'noom'],
            'social': ['instagram', 'tiktok', 'discord', 'twitter', 'bumble', 'hinge', 'tinder', 'slack'],
            'travel': ['airbnb', 'uber', 'booking', 'expedia', 'lyft', 'doordash', 'uber eats', 'tripadvisor'],
            'education': ['duolingo', 'coursera', 'khan academy', 'quizlet', 'brilliant', 'udemy'],
            'productivity': ['notion', 'todoist', 'asana', 'trello', 'linear', 'clickup', 'things', 'toggl'],
            'music': ['spotify', 'apple music', 'tidal', 'soundcloud', 'deezer', 'pandora', 'shazam'],
        };

        const industry = intent.industry || this._detectIndustry(q);
        const wellKnownApps = INDUSTRY_WELL_KNOWN[industry] || [];

        if (wellKnownApps.length > 0 && (brandRows.length + tier1Rows.length + tier2Rows.length) < limit) {
            // Pick up to 4 well-known apps we don't already have
            const existingApps = new Set([
                ...brandRows.map(r => (r.site_name || '').toLowerCase()),
                ...tier1Rows.map(r => (r.site_name || '').toLowerCase()),
                ...tier2Rows.map(r => (r.site_name || '').toLowerCase()),
            ]);

            const missingApps = wellKnownApps.filter(app => !existingApps.has(app) && app !== detectedBrand);
            const appsToFetch = missingApps.slice(0, 4);

            if (appsToFetch.length > 0) {
                const industryPromises = appsToFetch.map(appName =>
                    withPlatform(supabase.from('design_assets').select(COLS).ilike('site_name', `%${appName}%`)).limit(6).then(r => r.data)
                );
                const indRes = await Promise.allSettled(industryPromises);
                for (const s of indRes) { if (s.status === 'fulfilled' && s.value) mergeTier2(s.value); }
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // FINAL MERGE: Brand > Tier1 > Tier2
        // ═══════════════════════════════════════════════════════════════
        let ranked = [...brandRows, ...tier1Rows, ...tier2Rows];

        if (filterPlatform) {
            ranked = [
                ...ranked.filter(r => r.platform === filterPlatform),
                ...ranked.filter(r => !r.platform),
            ];
        }


        const pageSlice = ranked.slice(offset, offset + limit);
        const formatted = pageSlice.map((row, i) => {
            const fmtd = this.formatAssetForResult(row);
            const isBrand = brandRows.some(b => b.id === row.id);
            const isTier1 = !isBrand && tier1Rows.some(t => t.id === row.id);
            const baseScore = isBrand ? 0.98 - (i * 0.0005)
                : isTier1 ? 0.92 - (i * 0.001)
                    : 0.75 - (i * 0.001);
            const reasons = isBrand
                ? [`${detectedBrand.charAt(0).toUpperCase() + detectedBrand.slice(1)} App Screen`, 'Brand Match', 'UI Reference Library']
                : isTier1 ? ['Exact UI Category Match', 'UI Reference Library']
                    : ['Real App Screenshot', 'UI Reference Library'];
            return {
                image: { ...fmtd.image, relevanceScore: Math.max(0.01, baseScore) },
                similarity: Math.max(0.01, baseScore),
                reasons,
                _vectorResult: false,
            };
        });

        // ── Apply app diversity ──
        return this._enforceAppDiversity(formatted);
    }

    /**
     * Build a local intent object from query keywords — no OpenAI needed.
     * Extracts platform, ux_patterns, page_types, ui_elements, and tags
     * using alias maps so "login" → "Log In", "signup" → "Sign Up", etc.
     */
    _buildLocalIntent(query) {
        const q = (query || '').toLowerCase();

        // ── Platform detection ─────────────────────────────────────────
        const platforms = [];
        if (/\b(ios|iphone|ipad|swift|apple)\b/i.test(q)) platforms.push('ios');
        if (/\b(web|website|landing|saas|dashboard)\b/i.test(q)) platforms.push('web');
        if (/\b(android)\b/i.test(q)) platforms.push('android');

        // ── UX patterns ───────────────────────────────────────────────
        const UX_PATTERN_LIST = [
            'Shopping', 'Dark Mode', 'Booking', 'Map', 'Reviews & Rating',
            'Filter & Sorting', 'Empty State', 'Onboarding', 'Calendar',
            'Stats', 'Video Player', 'Chat', 'Social Feed', 'Navigation',
            'Search', 'Notifications', 'Payment', 'Checkout', 'Dashboard',
            'Profile', 'Settings', 'Authentication', 'Gallery', 'List',
            'Cards', 'Modal', 'Form', 'Upload', 'Loading'
        ];
        const UX_ALIASES = {
            'auth': 'Authentication', 'authenticate': 'Authentication', 'login flow': 'Authentication',
            'sign in flow': 'Authentication', 'notification': 'Notifications',
            'dark': 'Dark Mode', 'night mode': 'Dark Mode',
            'like': 'Reviews & Rating', 'rating': 'Reviews & Rating', 'review': 'Reviews & Rating',
            'sort': 'Filter & Sorting', 'filter': 'Filter & Sorting',
            'empty': 'Empty State', 'zero state': 'Empty State',
            'welcome': 'Onboarding', 'intro': 'Onboarding',
            'video': 'Video Player', 'player': 'Video Player',
            'message': 'Chat', 'inbox': 'Chat', 'dm': 'Chat',
            'social': 'Social Feed', 'news feed': 'Social Feed',
            'nav': 'Navigation', 'menu': 'Navigation', 'tab bar': 'Navigation',
            'pay': 'Payment', 'wallet': 'Payment', 'bank': 'Payment',
            'buy': 'Shopping', 'shop': 'Shopping', 'product': 'Shopping',
            'book': 'Booking', 'reservation': 'Booking',
            'calendar': 'Calendar', 'schedule': 'Calendar',
            'statistics': 'Stats', 'analytics': 'Stats', 'chart': 'Stats',
            'gallery': 'Gallery', 'photo': 'Gallery',
            'card': 'Cards', 'tile': 'Cards',
            'upload': 'Upload', 'file': 'Upload',
        };
        const ux_patterns = [
            ...UX_PATTERN_LIST.filter(p => q.includes(p.toLowerCase()) || q.includes(p.split(' ')[0].toLowerCase())),
            ...Object.entries(UX_ALIASES).filter(([alias]) => q.includes(alias)).map(([, v]) => v),
        ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);

        // ── Page types — alias map ─────────────────────────────────────
        // Common spellings → exact DB values
        const PAGE_TYPE_ALIASES = {
            'login': 'Log In', 'log in': 'Log In', 'sign in': 'Log In', 'signin': 'Log In',
            'signup': 'Sign Up', 'sign up': 'Sign Up', 'register': 'Sign Up', 'registration': 'Sign Up',
            'forgot password': 'Reset Password', 'reset password': 'Reset Password', 'forgot': 'Reset Password',
            'profile': 'Profile & Account', 'account': 'Profile & Account', 'my account': 'Profile & Account',
            'home': 'Home', 'homepage': 'Home', 'home screen': 'Home',
            'dashboard': 'Dashboard',
            'search': 'Search', 'search results': 'Search',
            'checkout': 'Checkout', 'payment page': 'Checkout', 'order': 'Checkout',
            'cart': 'Cart', 'basket': 'Cart', 'shopping cart': 'Cart',
            'chat': 'Chat', 'messaging': 'Chat', 'messages': 'Chat',
            'feed': 'Feed', 'newsfeed': 'Feed', 'timeline': 'Feed',
            'explore': 'Explore', 'discover': 'Explore', 'browse': 'Explore',
            'pricing': 'Pricing', 'pricing page': 'Pricing', 'plans': 'Pricing',
            'verify': 'Verification', 'verification': 'Verification', 'otp': 'Verification', '2fa': 'Verification',
            'onboarding': 'Onboarding', 'welcome': 'Onboarding', 'get started': 'Onboarding',
            'settings': 'Settings', 'preferences': 'Settings', 'options': 'Settings',
            'product detail': 'Product Details', 'product page': 'Product Details', 'item detail': 'Product Details',
        };
        const PAGE_TYPE_LIST = [
            'Log In', 'Sign Up', 'Profile & Account', 'Settings',
            'Product Details', 'Reset Password', 'Verification',
            'Onboarding', 'Home', 'Dashboard', 'Search', 'Checkout',
            'Cart', 'Chat', 'Feed', 'Explore', 'Pricing'
        ];
        const page_types = [
            ...PAGE_TYPE_LIST.filter(p => q.includes(p.toLowerCase())),
            ...Object.entries(PAGE_TYPE_ALIASES)
                .filter(([alias]) => q.includes(alias))
                .map(([, canonical]) => canonical),
        ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);

        // ── UI elements ───────────────────────────────────────────────
        const UI_ELEMENT_LIST = [
            'Button', 'Cards & Tiles', 'List', 'Tabs', 'Text Field',
            'Dropdown', 'Accordion & Collapse', 'Switch & Toggle',
            'Progress Bar', 'Checkbox & Radio', 'Sidebar & Drawer',
            'Icon', 'Avatar', 'Badge', 'Tooltip', 'Pagination',
            'Table', 'Chart', 'Modal', 'Snackbar', 'Carousel'
        ];
        const ui_elements = UI_ELEMENT_LIST.filter(el =>
            q.includes(el.toLowerCase()) || q.includes(el.split(' ')[0].toLowerCase())
        ).slice(0, 3);

        // ── Tags ──────────────────────────────────────────────────────
        const TAG_LIST = [
            'Wallet & Balance', 'Dark Mode', 'Select', 'Cards & Tiles',
            'List', 'Button', 'Dropdown', 'Tabs', 'Checkbox & Radio',
            'Switch & Toggle', 'Sidebar & Drawer', 'Icon', 'Avatar',
            'Currency', 'Search Bar', 'Map', 'Chart', 'Timeline',
            'Notifications', 'Feed', 'Gallery', 'Form', 'Login',
            'Onboarding', 'Profile', 'Settings', 'Payment', 'Checkout',
            'Empty State', 'Loading', 'Success', 'Error'
        ];
        const TAG_ALIASES = {
            'login': 'Login', 'log in': 'Login', 'sign in': 'Login',
            'notification': 'Notifications',
            'dark': 'Dark Mode',
            'wallet': 'Wallet & Balance', 'balance': 'Wallet & Balance',
            'currency': 'Currency',
            'search bar': 'Search Bar',
        };
        const tags = [
            ...TAG_LIST.filter(tag => q.includes(tag.toLowerCase()) || q.includes(tag.split(' ')[0].toLowerCase())),
            ...Object.entries(TAG_ALIASES).filter(([alias]) => q.includes(alias)).map(([, v]) => v),
        ].filter((v, i, arr) => arr.indexOf(v) === i).slice(0, 3);

        // ── Industry detection for query expansion ─────────────────────
        const industry = this._detectIndustry(q);

        return {
            enhanced_query: `${query} UI design app screen`,
            industry,
            platforms,
            ux_patterns,
            ui_elements,
            page_types,
            tags,
            confidence: 0.7,
            original_query: query,
        };
    }

    /**
     * Detect industry from query for query expansion.
     */
    _detectIndustry(q) {
        const INDUSTRY_MAP = {
            'fintech': ['fintech', 'banking', 'bank', 'wallet', 'finance', 'payment', 'money', 'crypto', 'trading', 'invest', 'stock', 'neobank'],
            'ecommerce': ['ecommerce', 'e-commerce', 'shopping', 'store', 'shop', 'marketplace', 'retail', 'fashion', 'checkout', 'cart'],
            'health': ['health', 'fitness', 'wellness', 'workout', 'exercise', 'meditation', 'sleep', 'diet', 'nutrition', 'gym', 'yoga'],
            'social': ['social', 'community', 'feed', 'messaging', 'chat', 'network', 'dating', 'forum'],
            'travel': ['travel', 'booking', 'hotel', 'flight', 'trip', 'vacation', 'restaurant', 'food delivery', 'delivery', 'ride'],
            'education': ['education', 'learning', 'course', 'study', 'quiz', 'school', 'tutorial', 'lesson'],
            'productivity': ['productivity', 'tracker', 'timer', 'todo', 'task', 'planner', 'calendar', 'schedule', 'habit', 'time track', 'pomodoro', 'notes'],
            'music': ['music', 'streaming', 'audio', 'podcast', 'sound', 'playlist', 'song'],
        };
        for (const [industry, keywords] of Object.entries(INDUSTRY_MAP)) {
            if (keywords.some(k => q.includes(k))) return industry;
        }
        return '';
    }

    /**
     * ═══════════════════════════════════════════════════════════════════
     * APP DIVERSITY ENFORCEMENT
     *
     * Prevents single-app dominance in results.
     * Max 3 screens from any one app in the first pass;
     * overflow is appended at the end.
     * ═══════════════════════════════════════════════════════════════════
     */
    _enforceAppDiversity(results, maxPerApp = 3) {
        if (!results || results.length <= maxPerApp) return results;

        const appCounts = new Map();
        const diversified = [];
        const overflow = [];

        for (const result of results) {
            const appName = result?.image?.siteName
                || result?.image?.source
                || result?.siteName
                || result?.source
                || 'unknown';

            // Normalize app name for counting
            const key = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const count = appCounts.get(key) || 0;

            if (count < maxPerApp) {
                diversified.push(result);
                appCounts.set(key, count + 1);
            } else {
                overflow.push(result);
            }
        }

        const final = [...diversified, ...overflow];
        const apps = [...appCounts.entries()].filter(([, c]) => c > 0).length;
        if (overflow.length > 0) {
        }
        return final;
    }

    /**
     * Generic full-text search (non-UI queries)
     */
    async searchAssets(query, limit = 20) {
        if (!supabase) return [];
        try {
            const { data, error } = await supabase
                .from('design_assets')
                .select('*')
                .textSearch('title_query_tags', query.toLowerCase().trim())
                .limit(limit);

            if (error) {
                const { data: fallbackData } = await supabase
                    .from('design_assets')
                    .select('*')
                    .ilike('query', `%${query}%`)
                    .limit(limit);
                return (fallbackData || []).map(r => this.formatAssetForResult(r));
            }
            return (data || []).map(r => this.formatAssetForResult(r));
        } catch (error) {
            console.error('[Error] AssetService.searchAssets failed:', error.message);
            return [];
        }
    }

    async getAssetCount() {
        if (!supabase) return 0;
        try {
            const { count, error } = await supabase
                .from('design_assets')
                .select('*', { count: 'exact', head: true });
            return error ? 0 : count;
        } catch { return 0; }
    }

    extractKeywords(text) {
        if (!text) return [];
        return text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(w => w.length > 3)
            .filter((w, i, a) => a.indexOf(w) === i);
    }

    /**
     * Maps a Supabase design_assets row → standard InspoAI result.
     * image.image     = thumbnail (fast grid display)
     * image.fullImage = src (HD for detail panel)
     */
    formatAssetForResult(record) {
        const fixImageUrl = (url) => {
            if (!url) return url;
            // Upgrade HTTP to HTTPS (b2bpic/Freepik images use http:// which browsers block on HTTPS pages)
            if (url.startsWith('http://')) {
                url = url.replace('http://', 'https://');
            }
            // Fix Pinterest PNG hotlink blocks
            if (url.includes('pinimg.com')) {
                url = url.replace(/\.png(\?|$)/, '.jpg$1');
            }
            return url;
        };

        const thumbnailUrl = fixImageUrl(record.thumbnail || record.src);
        const hdUrl = fixImageUrl(record.src || record.thumbnail);

        // Fill missing site_name from URL domain
        let siteName = record.site_name;
        if (!siteName && record.url) {
            try {
                const hostname = new URL(record.url).hostname
                    .replace(/^www\./, '')
                    .replace(/\.com$|\.io$|\.co$|\.org$|\.net$|\.app$/, '');
                siteName = hostname.charAt(0).toUpperCase() + hostname.slice(1);
            } catch { /* ignore bad URLs */ }
        }

        return {
            image: {
                image: thumbnailUrl,
                fullImage: hdUrl,
                title: record.title || siteName || 'UI Design',
                source: record.source || siteName || 'UI Reference',
                url: record.url,
                _internalId: record.id,
                width: record.width,
                height: record.height,
                platform: record.platform,
                siteName: siteName || null,
                siteDomain: record.site_domain,
                uxPatterns: record.ux_patterns || [],
                pageTypes: record.page_types || [],
                uiElements: record.ui_elements || [],
                fonts: record.fonts || [],
                colors: record.colors || [],
            },
            similarity: 0.9,
            reasons: ['Found in Local UI Library', 'Real App Screen']
        };
    }
}

// In-memory LRU cache (5-min TTL, max 100 entries)
AssetService._cache = new Map();

export const assetService = new AssetService();
