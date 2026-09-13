/**
 * Icon Service — Aggregates icons from multiple sources
 * 
 * Priority order:
 *   1. Google Material Icons (35 icons — in-memory fuzzy search, zero API calls)
 *   2. Iconoir (30 icons — via Iconify prefix=iconoir)
 *   3. Remix Icons (25 icons — via Iconify prefix=ri)
 *   4. Flaticon / Freepik (50 icons — paid API)
 *   5. Iconify general (10 icons — fallback variety)
 * 
 * Each result includes a `capabilities` field that tells the frontend
 * which edit controls to show (color, size, weight, fill, strokeWidth, variants).
 * 
 * Caching: Results are saved to Supabase per query.
 * On repeat queries, 50% chance to serve from cache (fast + saves API calls).
 */

import { supabase, supabaseAdmin } from '../config/supabaseClient.js';

// ─── Capabilities templates per source ───────────────────────────
const CAPS = {
    material: { color: true, size: true, weight: true, fill: true, strokeWidth: false, variants: null },
    iconoir: { color: true, size: true, weight: false, fill: false, strokeWidth: true, variants: null },
    remix: { color: true, size: true, weight: false, fill: false, strokeWidth: false, variants: ['line', 'fill'] },
    iconify: { color: true, size: true, weight: false, fill: false, strokeWidth: true, variants: null },
    flaticon: { color: false, size: true, weight: false, fill: false, strokeWidth: false, variants: null },
    svgrepo: { color: true, size: true, weight: false, fill: false, strokeWidth: true, variants: null },
};

class IconService {
    constructor() {
        this.iconifyBaseUrl = 'https://api.iconify.design';
        this.svgRepoBaseUrl = 'https://www.svgrepo.com';
        // Flaticon API (via Freepik Icons API)
        this.flaticonApiKey = process.env.FLATICON_API_KEY || null;
        // Cache settings
        this.CACHE_THRESHOLD = 10000;
        this.CACHE_HIT_PROBABILITY = 0.5;
        this.CACHE_TTL_HOURS = 72;
        this._totalCachedIcons = null;

        // Google Material Icons — in-memory index (loaded once on first search)
        this._materialIndex = null;
        this._materialIndexLoading = false;
    }

    // =========================================================================
    // MAIN SEARCH
    // =========================================================================

    async searchIcons(query, limit = 100) {
        if (!query || query.trim().length === 0) return [];

        const cleanQuery = this.stripIconKeywords(query);
        const cacheKey = cleanQuery.toLowerCase().trim();
        console.log(`Icon search: "${query}" → cleaned: "${cleanQuery}" (limit: ${limit})`);

        // --- CACHE CHECK ---
        const totalCached = await this.getTotalCachedIconCount();
        const cacheReady = totalCached >= this.CACHE_THRESHOLD;

        if (cacheReady && Math.random() < this.CACHE_HIT_PROBABILITY) {
            const cached = await this.getCachedIcons(cacheKey);
            if (cached && cached.length > 0) {
                console.log(`Cache HIT for "${cacheKey}" — returning ${cached.length} cached icons`);
                return cached.slice(0, limit);
            }
            console.log(` Cache MISS for "${cacheKey}" — fetching live`);
        } else {
            console.log(`Live fetch for "${cacheKey}" (${totalCached}/${this.CACHE_THRESHOLD} icons cached)`);
        }

        // --- LIVE FETCH from all sources in parallel ---
        const sources = [];

        // 1. Google Material Icons (PRIORITY #1 — 35 icons)
        sources.push(
            this.searchMaterialIcons(cleanQuery, 35).catch(err => {
                console.error('[Warning] Material Icons search failed:', err.message);
                return [];
            })
        );

        // 2. Iconoir (PRIORITY #2 — 30 icons via Iconify prefix)
        sources.push(
            this.searchIconoir(cleanQuery, 30).catch(err => {
                console.error('[Warning] Iconoir search failed:', err.message);
                return [];
            })
        );

        // 3. Remix Icons (PRIORITY #3 — 25 icons via Iconify prefix)
        sources.push(
            this.searchRemixIcons(cleanQuery, 25).catch(err => {
                console.error('[Warning] Remix Icons search failed:', err.message);
                return [];
            })
        );

        // 4. Flaticon (PRIORITY #4 — 50 icons, paid)
        if (this.flaticonApiKey) {
            sources.push(
                this.searchFlaticon(cleanQuery, 50).catch(err => {
                    console.error('[Warning] Flaticon search failed:', err.message);
                    return [];
                })
            );
        }

        // 5. Iconify general (PRIORITY #5 — 10 icons fallback)
        sources.push(
            this.searchIconify(cleanQuery, 10).catch(err => {
                console.error('[Warning] Iconify search failed:', err.message);
                return [];
            })
        );

        const allResults = await Promise.allSettled(sources);
        const resultArrays = allResults
            .filter(r => r.status === 'fulfilled')
            .map(r => r.value || []);

        // Merge in priority order (index matches the push order above)
        const icons = resultArrays.flat();

        // Log source breakdown
        const sourceCounts = {};
        icons.forEach(i => { sourceCounts[i.source] = (sourceCounts[i.source] || 0) + 1; });
        console.log(`Icon sources:`, sourceCounts);

        // Deduplicate by title+source (keep first occurrence = higher priority)
        const seen = new Set();
        const unique = icons.filter(icon => {
            const key = `${(icon.title || '').toLowerCase()}_${icon.source}`;
            if (!icon.image || seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const finalResults = unique.slice(0, limit);
        console.log(`[Success] Icon search returned ${finalResults.length} unique icons`);

        // --- SAVE TO CACHE (background) ---
        this.cacheIcons(cacheKey, finalResults).catch(err => {
            console.error('[Warning] Failed to cache icons:', err.message);
        });

        return finalResults;
    }

    // =========================================================================
    // GOOGLE MATERIAL ICONS — In-memory fuzzy search (zero API calls)
    // =========================================================================

    /**
     * Load the full Material Icons metadata once, cache in memory forever.
     * This JSON is ~2MB and contains name, categories, tags for 2,900+ icons.
     */
    async loadMaterialIndex() {
        if (this._materialIndex) return this._materialIndex;
        if (this._materialIndexLoading) {
            // Wait for the other load to finish
            await new Promise(resolve => {
                const check = setInterval(() => {
                    if (this._materialIndex || !this._materialIndexLoading) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            });
            return this._materialIndex || [];
        }

        this._materialIndexLoading = true;
        try {
            console.log('Loading Google Material Icons index...');
            const res = await fetch('https://fonts.google.com/metadata/icons?key=material_symbols&incomplete=true', {
                signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) throw new Error(`Material metadata returned ${res.status}`);

            let text = await res.text();
            // Google prepends ")]}\n" to the JSON response — strip it
            if (text.startsWith(")]}'")) {
                text = text.substring(text.indexOf('\n') + 1);
            }

            const data = JSON.parse(text);
            this._materialIndex = data.icons || [];
            console.log(`[Success] Material Icons index loaded: ${this._materialIndex.length} icons`);
            return this._materialIndex;
        } catch (err) {
            console.error('[Error] Failed to load Material Icons index:', err.message);
            this._materialIndex = [];
            return [];
        } finally {
            this._materialIndexLoading = false;
        }
    }

    async searchMaterialIcons(query, limit = 35) {
        const index = await this.loadMaterialIndex();
        if (index.length === 0) return [];

        const q = query.toLowerCase().trim();
        const queryWords = q.split(/\s+/).filter(w => w.length > 1);

        // Score each icon by relevance
        const scored = index.map(icon => {
            const name = (icon.name || '').toLowerCase();
            const tags = (icon.tags || []).map(t => t.toLowerCase());
            const cats = (icon.categories || []).map(c => c.toLowerCase());
            let score = 0;

            // Exact name match = highest priority
            if (name === q) score += 100;
            // Name contains query
            else if (name.includes(q)) score += 50;
            // Name starts with query
            else if (name.startsWith(queryWords[0] || '')) score += 30;

            // Word-level matching
            for (const word of queryWords) {
                if (name.includes(word)) score += 15;
                if (tags.some(t => t.includes(word))) score += 8;
                if (cats.some(c => c.includes(word))) score += 5;
            }

            // Popularity boost (normalized — top icons get a small boost)
            if (icon.popularity > 10000) score += 3;
            else if (icon.popularity > 5000) score += 2;
            else if (icon.popularity > 1000) score += 1;

            return { icon, score };
        })
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        console.log(`Material Icons: ${scored.length} matches for "${query}"`);

        return scored.map(({ icon }) => {
            const name = icon.name;
            // Use Material Symbols Outlined for the preview (clean, consistent)
            const svgUrl = `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/default/48px.svg`;

            return {
                image: svgUrl,
                title: name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                source: 'Material',
                editable: true,
                url: `https://fonts.google.com/icons?selected=Material+Symbols+Outlined:${name}`,
                width: 48,
                height: 48,
                category: 'Icons',
                displayMode: 'icon-grid',
                iconMeta: {
                    iconId: name,
                    collection: 'Material Symbols',
                    license: 'Apache 2.0',
                    svgUrl,
                    capabilities: { ...CAPS.material }
                }
            };
        });
    }

    // =========================================================================
    // ICONOIR — Via Iconify API with prefix filter
    // =========================================================================

    async searchIconoir(query, limit = 30) {
        const url = `${this.iconifyBaseUrl}/search?query=${encodeURIComponent(query)}&prefix=iconoir&limit=${limit}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) throw new Error(`Iconoir search returned ${response.status}`);

        const data = await response.json();
        const icons = data.icons || [];

        console.log(` Iconoir: ${icons.length} matches for "${query}"`);

        return icons.map(iconId => {
            const [prefix, name] = iconId.split(':');
            const svgUrl = `${this.iconifyBaseUrl}/${prefix}/${name}.svg?width=128&height=128`;
            const cleanName = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            return {
                image: svgUrl,
                title: cleanName,
                source: 'Iconoir',
                editable: true,
                url: `https://iconoir.com/icons/${name}`,
                width: 128,
                height: 128,
                category: 'Icons',
                displayMode: 'icon-grid',
                iconMeta: {
                    iconId,
                    prefix,
                    name,
                    collection: 'Iconoir',
                    license: 'MIT',
                    svgUrl,
                    capabilities: { ...CAPS.iconoir },
                }
            };
        });
    }

    // =========================================================================
    // REMIX ICONS — Via Iconify API with prefix filter
    // =========================================================================

    async searchRemixIcons(query, limit = 25) {
        const url = `${this.iconifyBaseUrl}/search?query=${encodeURIComponent(query)}&prefix=ri&limit=${limit * 2}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) throw new Error(`Remix Icons search returned ${response.status}`);

        const data = await response.json();
        const icons = data.icons || [];

        console.log(`Remix Icons: ${icons.length} raw matches for "${query}"`);

        // Group line/fill variants — prefer -line first, keep -fill as variant info
        const lineIcons = icons.filter(id => id.endsWith('-line'));
        const fillIcons = icons.filter(id => id.endsWith('-fill'));
        const otherIcons = icons.filter(id => !id.endsWith('-line') && !id.endsWith('-fill'));

        // Deduplicate: prefer line, attach fill variant
        const seen = new Set();
        const results = [];

        for (const iconId of [...lineIcons, ...otherIcons]) {
            const [prefix, name] = iconId.split(':');
            const baseName = name.replace(/-line$/, '');
            if (seen.has(baseName)) continue;
            seen.add(baseName);

            const svgUrl = `${this.iconifyBaseUrl}/${prefix}/${name}.svg?width=128&height=128`;
            const fillName = `${baseName}-fill`;
            const hasFill = fillIcons.some(id => id === `${prefix}:${fillName}`);
            const cleanName = baseName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            results.push({
                image: svgUrl,
                title: cleanName,
                source: 'Remix',
                editable: true,
                url: `https://remixicon.com/icon/${baseName}`,
                width: 128,
                height: 128,
                category: 'Icons',
                displayMode: 'icon-grid',
                iconMeta: {
                    iconId,
                    prefix,
                    name,
                    baseName,
                    collection: 'Remix Icons',
                    license: 'Apache 2.0',
                    svgUrl,
                    // Variant URLs for line/fill toggle
                    lineUrl: `${this.iconifyBaseUrl}/${prefix}/${baseName}-line.svg?width=128&height=128`,
                    fillUrl: hasFill ? `${this.iconifyBaseUrl}/${prefix}/${fillName}.svg?width=128&height=128` : null,
                    capabilities: { ...CAPS.remix, variants: hasFill ? ['line', 'fill'] : null },
                }
            });

            if (results.length >= limit) break;
        }

        console.log(`Remix Icons: ${results.length} unique icons after dedup`);
        return results;
    }

    // =========================================================================
    // FLATICON API (Freepik) — Existing, PRIORITY #4
    // =========================================================================

    async searchFlaticon(query, limit = 50) {
        if (!this.flaticonApiKey) return [];

        try {
            const url = `https://api.freepik.com/v1/icons?term=${encodeURIComponent(query)}&per_page=${limit}&order=relevance&thumbnail_size=256`;

            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'x-freepik-api-key': this.flaticonApiKey
                },
                signal: AbortSignal.timeout(12000)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Freepik Icons API returned ${response.status}: ${errorText.slice(0, 200)}`);
            }

            const data = await response.json();
            const results = this.parseFreepikIcons(data);
            console.log(`Freepik Icons returned ${results.length} icons for "${query}"`);
            return results;
        } catch (err) {
            console.error('[Error] Freepik Icons search error:', err.message);
            return [];
        }
    }

    parseFreepikIcons(data) {
        const icons = data.data || [];
        return icons.map(icon => {
            const thumbnails = icon.thumbnails || [];
            const bestThumb = thumbnails.sort((a, b) => (b.width || 0) - (a.width || 0))[0];
            const thumbUrl = bestThumb?.url || null;

            return {
                image: thumbUrl,
                title: icon.name || 'Freepik Icon',
                source: 'Flaticon',
                editable: false,
                url: `https://www.flaticon.com/free-icon/${icon.slug || icon.id}`,
                width: bestThumb?.width || 128,
                height: bestThumb?.height || 128,
                category: 'Icons',
                displayMode: 'icon-grid',
                iconMeta: {
                    iconId: icon.id,
                    collection: icon.family?.name || icon.style?.name || 'Flaticon',
                    author: icon.author?.name,
                    style: icon.style?.name,
                    freeSvg: icon.free_svg || false,
                    pngUrl: thumbUrl,
                    license: 'Flaticon License',
                    capabilities: { ...CAPS.flaticon },
                }
            };
        }).filter(i => i.image);
    }

    // =========================================================================
    // ICONIFY API — General fallback, PRIORITY #5
    // =========================================================================

    async searchIconify(query, limit = 10) {
        const url = `${this.iconifyBaseUrl}/search?query=${encodeURIComponent(query)}&limit=${limit}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) throw new Error(`Iconify API returned ${response.status}`);

        const data = await response.json();
        const icons = data.icons || [];
        const collections = data.collections || {};

        return icons
            // Exclude iconoir and ri prefixes (already fetched as dedicated sources)
            .filter(iconId => {
                const prefix = iconId.split(':')[0];
                return prefix !== 'iconoir' && prefix !== 'ri';
            })
            .map(iconId => {
                const [prefix, name] = iconId.split(':');
                const collection = collections[prefix] || {};
                const svgUrl = `${this.iconifyBaseUrl}/${prefix}/${name}.svg?width=128&height=128`;
                const collectionName = collection.name || prefix;
                const cleanName = name.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                return {
                    image: svgUrl,
                    title: cleanName,
                    source: 'Iconify',
                    editable: true,
                    url: `https://icon-sets.iconify.design/${prefix}/${name}/`,
                    width: 128,
                    height: 128,
                    category: 'Icons',
                    displayMode: 'icon-grid',
                    iconMeta: {
                        iconId,
                        prefix,
                        name,
                        collection: collectionName,
                        license: collection.license?.title || 'Open Source',
                        svgUrl,
                        capabilities: { ...CAPS.iconify },
                    }
                };
            });
    }

    // =========================================================================
    // SVG REPO — Scraper fallback (kept for variety)
    // =========================================================================

    async searchSvgRepo(query, limit = 20) {
        const url = `https://www.svgrepo.com/vectors/${encodeURIComponent(query)}/`;

        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                    'Accept': 'text/html'
                },
                signal: AbortSignal.timeout(8000)
            });

            if (!response.ok) {
                if (response.status === 429) {
                    console.log('[Warning] SVG Repo rate limited, skipping');
                    return [];
                }
                throw new Error(`SVG Repo returned ${response.status}`);
            }

            const html = await response.text();
            const results = [];
            const imgRegex = /<img[^>]*src="(https:\/\/www\.svgrepo\.com\/[^"]*\.svg)"[^>]*alt="([^"]*)"[^>]*>/gi;
            let match;

            while ((match = imgRegex.exec(html)) !== null && results.length < limit) {
                const src = match[1];
                const alt = match[2] || 'SVG Icon';
                if (src.includes('logo') || src.includes('favicon')) continue;
                const directUrl = src.replace('/show/', '/download/');

                results.push({
                    image: src,
                    title: alt.replace(/ SVG$/i, '').trim(),
                    source: 'SVG Repo',
                    editable: true,
                    url: src.replace('/show/', '/svg/').replace('.svg', ''),
                    width: 128,
                    height: 128,
                    category: 'Icons',
                    displayMode: 'icon-grid',
                    iconMeta: {
                        svgUrl: directUrl,
                        collection: 'SVG Repo',
                        license: 'Various (CC, MIT)',
                        capabilities: { ...CAPS.svgrepo },
                    }
                });
            }

            console.log(`SVG Repo returned ${results.length} icons`);
            return results;
        } catch (err) {
            console.error('SVG Repo fetch error:', err.message);
            return [];
        }
    }

    // =========================================================================
    // SUPABASE CACHE
    // =========================================================================

    async getCachedIcons(cacheKey) {
        if (!supabase) return null;

        try {
            const { data, error } = await supabase
                .from('icon_cache')
                .select('icons, created_at')
                .eq('query', cacheKey)
                .single();

            if (error || !data) return null;

            const cachedAt = new Date(data.created_at);
            const hoursOld = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
            if (hoursOld > this.CACHE_TTL_HOURS) {
                console.log(` Cache expired for "${cacheKey}" (${Math.round(hoursOld)}h old)`);
                return null;
            }

            return data.icons || null;
        } catch (err) {
            console.error('[Warning] Cache read error:', err.message);
            return null;
        }
    }

    async cacheIcons(cacheKey, icons) {
        if (!supabaseAdmin || !icons || icons.length === 0) return;

        try {
            const { error } = await supabaseAdmin
                .from('icon_cache')
                .upsert({
                    query: cacheKey,
                    icons: icons,
                    icon_count: icons.length,
                    created_at: new Date().toISOString()
                }, { onConflict: 'query' });

            if (error) {
                console.error('[Warning] Cache write error:', error.message);
            } else {
                console.log(` Cached ${icons.length} icons for "${cacheKey}"`);
                this._totalCachedIcons = null;
            }
        } catch (err) {
            console.error('[Warning] Cache write error:', err.message);
        }
    }

    async getTotalCachedIconCount() {
        if (!supabase) return 0;

        if (this._totalCachedIcons !== null && this._countLastChecked) {
            const minutesSinceCheck = (Date.now() - this._countLastChecked) / (1000 * 60);
            if (minutesSinceCheck < 5) return this._totalCachedIcons;
        }

        try {
            const { data, error } = await supabase
                .from('icon_cache')
                .select('icon_count');

            if (error) {
                console.error('[Warning] Count query error:', error.message);
                return this._totalCachedIcons || 0;
            }

            const total = (data || []).reduce((sum, row) => sum + (row.icon_count || 0), 0);
            this._totalCachedIcons = total;
            this._countLastChecked = Date.now();
            return total;
        } catch (err) {
            console.error('[Warning] Count query error:', err.message);
            return this._totalCachedIcons || 0;
        }
    }

    // =========================================================================
    // UTILITIES
    // =========================================================================

    stripIconKeywords(query) {
        return query
            .replace(/\b(icons?|symbols?|glyph|glyphs|pictogram|pictograms)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim() || query.trim();
    }

    async healthCheck() {
        try {
            const response = await fetch(`${this.iconifyBaseUrl}/search?query=test&limit=1`, {
                signal: AbortSignal.timeout(5000)
            });
            const data = await response.json();
            const materialCount = this._materialIndex?.length || 0;

            return {
                status: 'healthy',
                service: 'Icon Service',
                sources: {
                    material: materialCount > 0 ? `${materialCount} icons indexed [OK]` : 'not loaded yet',
                    iconoir: 'via Iconify prefix [OK]',
                    remix: 'via Iconify prefix [OK]',
                    flaticon: this.flaticonApiKey ? 'configured [OK]' : 'no API key',
                    iconify: response.ok && (data.icons?.length > 0) ? 'available [OK]' : 'unavailable',
                    supabaseCache: supabase ? 'connected [OK]' : 'not configured'
                }
            };
        } catch (err) {
            return { status: 'unhealthy', error: err.message };
        }
    }
}

export const iconService = new IconService();
export default iconService;
