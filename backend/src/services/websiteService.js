import { supabase } from '../config/supabaseClient.js';
import { webSemanticSearch, isWebSemanticReady } from './webPineconeService.js';

class WebsiteService {

    // ── KNOWN CATEGORIES in Lapa & Landbook databases ──
    // Maps common search terms → actual category values stored in the DB
    static CATEGORY_MAP = {
        'portfolio': 'Portfolio', 'landing': 'Landing', 'agency': 'Agency',
        'ecommerce': 'E-Commerce', 'e-commerce': 'E-Commerce', 'shop': 'E-Commerce',
        'store': 'E-Commerce', 'saas': 'Saas', 'startup': 'Startup',
        'corporate': 'Corporate', 'business': 'Corporate', 'minimal': 'Minimal',
        'minimalist': 'Minimal', 'creative': 'Creative', 'blog': 'Blog',
        'magazine': 'Magazine', 'photography': 'Photography', 'photo': 'Photography',
        'education': 'Education', 'food': 'Food & Drink', 'restaurant': 'Food & Drink',
        'travel': 'Travel', 'health': 'Health', 'healthcare': 'Health',
        'fitness': 'Health', 'finance': 'Finance', 'fintech': 'Finance',
        'crypto': 'Finance', 'tech': 'Tech', 'technology': 'Tech',
        'software': 'Software', 'app': 'App', 'mobile': 'App',
        'gaming': 'Entertainment', 'music': 'Entertainment', 'video': 'Entertainment',
        'fashion': 'Fashion', 'real estate': 'Real Estate', 'property': 'Real Estate',
        'architecture': 'Architecture', 'interior': 'Furniture Interiors',
        'furniture': 'Furniture Interiors', 'sport': 'Sport', 'sports': 'Sport',
        'nonprofit': 'Non-Profit', 'charity': 'Non-Profit', 'ngo': 'Non-Profit',
        'illustration': 'Illustration', 'typography': 'Typography', 'type': 'Typography',
        'animation': 'Animation', 'animated': 'Animation', 'dark': 'Dark',
        'gradient': 'Gradient', 'parallax': 'Parallax', 'studio': 'Studio',
        'marketing': 'Marketing', 'community': 'Community', 'social': 'Community',
        'webflow': 'Webflow', 'framer': 'Framer',
    };

    /**
     * Extract matching DB categories from query keywords.
     * e.g. "portfolio website dark" → ["Portfolio", "Dark"]
     */
    _extractCategories(query) {
        const q = query.toLowerCase();
        const matched = new Set();

        // Single-word matches
        for (const [keyword, category] of Object.entries(WebsiteService.CATEGORY_MAP)) {
            if (q.includes(keyword)) {
                matched.add(category);
            }
        }

        return [...matched];
    }

    /**
     * Search website assets (Lapa Ninja and Landbook) using Supabase directly.
     * Searches across: title, description, AND categories.
     * Uses both query keywords and LLM extracted intents for comprehensive matching.
     */
    async searchWebsiteAssets(query, llmExtracted = {}, limit = 40, page = 0) {
        if (!supabase) return [];
        const q = (query || '').trim().toLowerCase();
        if (!q) return [];

        // ── Semantic search (Pinecone inspoai-websites index) ──
        // page=0: first 60 results (fast, curated)
        // page=1: next 60 results (show more — semantic offset)
        // page=2+: [] returned by semantic, scrapers + keyword handle it
        if (isWebSemanticReady()) {
            try {
                const MIN_SEMANTIC_RESULTS = 10;
                const semanticMatches = await webSemanticSearch(query, limit, page);
                if (semanticMatches.length > 0) {
                    const results = await this._fetchByIds(semanticMatches);
                    if (results.length >= MIN_SEMANTIC_RESULTS) {
                        const pageLabel = page === 0 ? 'page 1' : `show more (page ${page + 1})`;
                        console.log(`Web semantic: ${results.length} results for "${query}" [${pageLabel}]`);
                        return results;
                    }
                    console.log(`[Warning] Web semantic only returned ${results.length} results (< ${MIN_SEMANTIC_RESULTS}) — merging with keyword fallback`);
                }
                console.log(`[Warning] Web semantic returned 0 results, falling back to keyword + scrapers`);
            } catch (err) {
                console.error('[Warning] Web semantic error, falling back:', err.message);
            }
        }

        const { categories: llmCategories = [], colors = [], typefaces = [] } = llmExtracted;

        // Auto-extract categories from the query itself (not just LLM)
        const queryCategories = this._extractCategories(q);

        // Merge LLM categories + query-extracted categories (deduplicated)
        const allCategories = [...new Set([...llmCategories, ...queryCategories])];

        console.log(`Website Search: q="${q}"`);
        console.log(`    Categories (auto): ${JSON.stringify(queryCategories)}`);
        console.log(`    Categories (LLM):  ${JSON.stringify(llmCategories)}`);
        console.log(`    Categories (all):  ${JSON.stringify(allCategories)}`);
        console.log(`   Colors: ${JSON.stringify(colors)}, Typefaces: ${JSON.stringify(typefaces)}`);

        const fetchLimit = Math.max(limit * 3, 120); // Fetch more for better ranking
        const promises = [];
        const keywords = q.split(/\s+/).filter(k => k.length > 2);

        // ── STRATEGY 1: Category search (HIGHEST priority) ──
        // This is the MAIN search path — categories contain rich metadata like "Portfolio", "Landing", "SaaS"
        if (allCategories.length > 0) {
            for (const cat of allCategories) {
                // Lapa category search
                promises.push(
                    supabase.from('lapa_websites')
                        .select('*')
                        .contains('categories', [cat])
                        .limit(fetchLimit)
                        .then(res => ({ source: 'Lapa Ninja', method: 'category', data: res.data || [], error: res.error }))
                );
                // Landbook category search
                promises.push(
                    supabase.from('landbook_websites')
                        .select('*')
                        .contains('categories', [cat])
                        .limit(fetchLimit)
                        .then(res => ({ source: 'Land-book', method: 'category', data: res.data || [], error: res.error }))
                );
            }
        }

        // ── STRATEGY 2: Title search ──
        if (keywords.length > 0) {
            const titleOr = keywords.map(kw => `title.ilike.%${kw}%`).join(',');

            promises.push(
                supabase.from('lapa_websites').select('*').or(titleOr).limit(fetchLimit)
                    .then(res => ({ source: 'Lapa Ninja', method: 'title', data: res.data || [], error: res.error }))
            );
            promises.push(
                supabase.from('landbook_websites').select('*').or(titleOr).limit(fetchLimit)
                    .then(res => ({ source: 'Land-book', method: 'title', data: res.data || [], error: res.error }))
            );
        }

        // ── STRATEGY 3: Description search (Lapa only — Landbook has no description) ──
        if (keywords.length > 0) {
            const descOr = keywords.map(kw => `description.ilike.%${kw}%`).join(',');
            promises.push(
                supabase.from('lapa_websites').select('*').or(descOr).limit(fetchLimit)
                    .then(res => ({ source: 'Lapa Ninja', method: 'description', data: res.data || [], error: res.error }))
            );
        }

        const startMs = Date.now();
        const settled = await Promise.allSettled(promises);
        const elapsed = Date.now() - startMs;

        // Log per-method results
        const methodCounts = {};
        for (const s of settled) {
            if (s.status === 'fulfilled' && s.value && !s.value.error) {
                const key = `${s.value.source}:${s.value.method}`;
                methodCounts[key] = (methodCounts[key] || 0) + s.value.data.length;
            }
        }
        console.log(`${promises.length} queries in ${elapsed}ms — ${JSON.stringify(methodCounts)}`);

        const allRows = [];
        const seenIds = new Set();

        for (const s of settled) {
            if (s.status === 'fulfilled' && s.value && !s.value.error) {
                const source = s.value.source;
                const method = s.value.method;
                for (const row of s.value.data) {
                    const uniqueId = `${source}_${row.id}`;
                    if (!seenIds.has(uniqueId)) {
                        seenIds.add(uniqueId);
                        const formatted = this.formatWebsiteRow(row, source);
                        formatted._matchMethod = method; // Track HOW it was found
                        allRows.push(formatted);
                    }
                }
            } else if (s.status === 'fulfilled' && s.value?.error) {
                console.error(`[Error] Supabase error querying ${s.value.source} (${s.value.method}):`, s.value.error);
            }
        }

        if (allRows.length === 0) {
            console.log(`ℹ No website results from Supabase for "${q}"`);
            return [];
        }

        // ── RANKING: Score each result based on relevance ──
        const ranked = allRows
            .map(row => {
                let score = 0.3; // Base score
                const titleLower = (row.image.title || '').toLowerCase();
                const descLower = (row.image.description || '').toLowerCase();
                const rowCats = (row.image.categories || []).map(c => c.toLowerCase());

                // Category match is the STRONGEST signal
                for (const cat of allCategories) {
                    if (rowCats.includes(cat.toLowerCase())) score += 0.5;
                }

                // Title keyword match
                for (const term of keywords) {
                    if (titleLower.includes(term)) score += 0.3;
                }

                // Description keyword match
                for (const term of keywords) {
                    if (descLower.includes(term)) score += 0.15;
                }

                // LLM color match bonus
                if (colors && colors.length > 0 && row.image.colors) {
                    const rowColorsText = row.image.colors.join(' ').toLowerCase();
                    for (const color of colors) {
                        if (rowColorsText.includes(color.toLowerCase())) score += 0.2;
                    }
                }

                // Typeface match bonus
                if (typefaces && typefaces.length > 0 && row.image.typefaces) {
                    const rowTypefacesText = row.image.typefaces.join(' ').toLowerCase();
                    for (const font of typefaces) {
                        if (rowTypefacesText.includes(font.toLowerCase())) score += 0.2;
                    }
                }

                // Multi-category match bonus (e.g. "portfolio dark" matching both)
                const catMatchCount = allCategories.filter(c => rowCats.includes(c.toLowerCase())).length;
                if (catMatchCount >= 2) score += 0.4; // Bonus for matching multiple categories

                return { ...row, score };
            })
            .sort((a, b) => b.score - a.score);

        const results = ranked.slice(0, limit).map(item => {
            return {
                image: {
                    ...item.image,
                    relevanceScore: 0.9 + (item.score * 0.05)
                },
                similarity: 0.9 + (item.score * 0.05),
                reasons: ['Found in Local Website Library', 'Curated Source'],
            };
        });

        console.log(`[Success] Website keyword search: ${results.length} results (${allRows.length} pooled, top score: ${ranked[0]?.score?.toFixed(2)})`);
        return results;
    }

    /**
     * Given Pinecone matches [{id, score, metadata}], fetch full rows from Supabase.
     * id format: 'lapa-{n}' or 'landbook-{n}'
     */
    async _fetchByIds(matches) {
        const lapaIds = [];
        const landbookIds = [];
        const scoreMap = new Map();

        for (const m of matches) {
            scoreMap.set(m.id, m.score);
            if (m.id.startsWith('lapa-')) {
                lapaIds.push(parseInt(m.id.replace('lapa-', ''), 10));
            } else if (m.id.startsWith('landbook-')) {
                landbookIds.push(parseInt(m.id.replace('landbook-', ''), 10));
            }
        }

        const results = [];

        if (lapaIds.length > 0) {
            const { data } = await supabase
                .from('lapa_websites')
                .select('*')
                .in('id', lapaIds);

            for (const row of (data || [])) {
                const id = `lapa-${row.id}`;
                const score = scoreMap.get(id) || 0.6;
                const formatted = this.formatWebsiteRow(row, 'Lapa Ninja');
                results.push({
                    image: { ...formatted.image, relevanceScore: score },
                    similarity: score,
                    reasons: ['Semantic match', 'Lapa Ninja'],
                    _pineconeId: id,
                    _score: score,
                });
            }
        }

        if (landbookIds.length > 0) {
            const { data } = await supabase
                .from('landbook_websites')
                .select('*')
                .in('id', landbookIds);

            for (const row of (data || [])) {
                const id = `landbook-${row.id}`;
                const score = scoreMap.get(id) || 0.6;
                const formatted = this.formatWebsiteRow(row, 'Land-book');
                results.push({
                    image: { ...formatted.image, relevanceScore: score },
                    similarity: score,
                    reasons: ['Semantic match', 'Land-book'],
                    _pineconeId: id,
                    _score: score,
                });
            }
        }

        // Preserve Pinecone ranking order
        results.sort((a, b) => b._score - a._score);
        return results;
    }

    formatWebsiteRow(row, source) {
        if (source === 'Lapa Ninja') {
            return {
                image: {
                    image: row.thumbnail_url || row.main_image_url,
                    fullImage: row.main_image_url || row.thumbnail_url,
                    title: row.title || row.slug,
                    description: row.description || '',
                    source: 'Lapa Ninja',
                    url: row.source_url || `https://lapa.ninja${row.lapa_url}`,
                    _internalId: `lapa-${row.id}`,
                    width: 1200,
                    height: 800,
                    categories: row.categories || [],
                    colors: row.colors || [],
                    typefaces: row.typefaces || [],
                    platform: row.platform || null,
                    publishedYear: row.published_year || null,
                    extraImages: row.extra_images || [],
                    isWebsiteResult: true,
                }
            };
        } else if (source === 'Land-book') {
            return {
                image: {
                    image: row.main_image_url,
                    fullImage: row.main_image_url,
                    title: row.title || row.slug,
                    source: 'Land-book',
                    url: row.source_url || `https://land-book.com${row.landbook_url}`,
                    _internalId: `landbook-${row.id}`,
                    width: 1200,
                    height: 800,
                    categories: row.categories || [],
                    colors: row.colors || [],
                    components: row.components || [],
                    isWebsiteResult: true,
                }
            };
        }
        return { image: { ...row, source } };
    }
}

export const websiteService = new WebsiteService();
