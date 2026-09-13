import { supabaseAdmin as supabase } from '../config/supabaseClient.js';
import NodeCache from 'node-cache';

// Cache with 15-minute TTL
const inspireCache = new NodeCache({ stdTTL: 900 });

// Source names shown on cards
const SOURCE_LABELS = {
    design_assets: 'Design Assets',
    design_spells: 'Design Spells',
    landbook_websites: 'Landbook',
    lapa_websites: 'Lapa Ninja',
    view_port_designs: 'ViewPort',
    curated_collections: 'Curated by Inspo',
};

// Proportion of items to fetch from each table per page — total = 25
const PAGE_SIZE = 25;
// Fixed weights — must add up to PAGE_SIZE
const TABLE_WEIGHTS = {
    design_assets: 10,
    lapa_websites: 6,
    landbook_websites: 5,
    view_port_designs: 2,
    design_spells: 1,
    curated_collections: 1,  // admin-curated always gets a slot each page
};

// Simple deterministic shuffle — same seed → same order, different seed → different order
function seededShuffle(arr, seed) {
    const a = [...arr];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
        s = (s * 1664525 + 1013904223) & 0xffffffff;
        const j = Math.abs(s) % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * Normalize a row from any table into a shared InspireItem shape:
 * { id, source, type, title, author, image_url, video_url, tags, categories, source_url }
 */
function normalize(row, table) {
    switch (table) {
        case 'design_assets':
            return {
                id: `da_${row.id}`,
                source: 'design_assets',
                source_label: SOURCE_LABELS.design_assets,
                type: 'image',
                title: row.title || row.site_name || null,
                author: row.site_domain || null,
                image_url: row.thumbnail || row.src || null,        // fast thumbnail for grid
                hq_image_url: row.src || row.thumbnail || null,     // full-res for lightbox
                video_url: null,
                tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
                categories: Array.isArray(row.page_types) ? row.page_types : [],
                source_url: row.url || null,
            };

        case 'lapa_websites':
            return {
                id: `lp_${row.id}`,
                source: 'lapa_websites',
                source_label: SOURCE_LABELS.lapa_websites,
                type: 'image',
                title: row.title || null,
                author: null,
                image_url: row.thumbnail_url || row.main_image_url || null,   // thumbnail for grid
                hq_image_url: row.main_image_url || row.thumbnail_url || null, // full-res for lightbox
                video_url: null,
                tags: [],
                categories: Array.isArray(row.categories) ? row.categories : [],
                // Use actual website URL first, fall back to lapa page only if no direct URL
                source_url: row.source_url || row.lapa_url || null,
            };

        case 'landbook_websites':
            return {
                id: `lb_${row.id}`,
                source: 'landbook_websites',
                source_label: SOURCE_LABELS.landbook_websites,
                type: 'image',
                title: row.title || null,
                author: null,
                image_url: row.main_image_url || null,
                hq_image_url: row.main_image_url || null, // same — landbook only has one size
                video_url: null,
                tags: [],
                categories: Array.isArray(row.categories) ? row.categories : [],
                // Use actual website URL first, fall back to landbook page only if no direct URL
                source_url: row.source_url || row.landbook_url || null,
            };

        case 'view_port_designs':
            return {
                id: `vp_${row.id}`,
                source: 'view_port_designs',
                source_label: SOURCE_LABELS.view_port_designs,
                type: row.video_url ? 'video' : 'image',
                title: row.title || null,
                author: row.author || null,
                image_url: row.image_url || null,
                video_url: row.video_url || null,
                tags: [],
                categories: row.category ? [row.category] : [],
                source_url: row.source_url || null,
            };

        case 'design_spells':
            return {
                id: `ds_${row.id}`,
                source: 'design_spells',
                source_label: SOURCE_LABELS.design_spells,
                type: row.video_url ? 'video' : 'image',
                title: row.title || null,
                author: row.app_name || null,
                image_url: row.thumbnail_url || null,
                video_url: row.video_url || null,
                tags: Array.isArray(row.tags) ? row.tags : [],
                categories: [],
                source_url: row.app_url || null,
            };

        case 'curated_collections': {
            const media = Array.isArray(row.media) ? row.media : [];
            const cover = media.find(m => m.type === 'image') || media[0] || null;
            return {
                id: `cc_${row.id}`,
                source: 'curated_collections',
                source_label: SOURCE_LABELS.curated_collections,
                type: 'collection',      // special type for CollectionCard
                title: row.title || null,
                body: row.body || null,
                source_url: row.source_url || null,
                tags: Array.isArray(row.tags) ? row.tags : [],
                categories: Array.isArray(row.tags) ? row.tags : [],
                media,
                image_url: cover?.thumbnail_url || cover?.url || null,   // card cover
                hq_image_url: cover?.url || null,
                video_url: null,
                author: null,
            };
        }

        default:
            return null;
    }
}

/**
 * Fetch a paginated slice from a single table with optional tag/category filter.
 * Uses Supabase .range() — efficient, no full scan.
 */
async function fetchFromTable(table, offset, count, tagFilter) {
    try {
        let query = supabase.from(table).select('*').range(offset, offset + count - 1);

        // Apply tag/category filter where applicable
        if (tagFilter) {
            if (table === 'design_assets') {
                query = query.ilike('title_query_tags', `%${tagFilter}%`);
            } else if (table === 'lapa_websites' || table === 'landbook_websites') {
                query = query.contains('categories', [tagFilter]);
            } else if (table === 'design_spells') {
                query = query.contains('tags', [tagFilter]);
            } else if (table === 'view_port_designs') {
                query = query.ilike('category', `%${tagFilter}%`);
            } else if (table === 'curated_collections') {
                // Only show published collections in the feed
                query = query.eq('is_published', true);
                if (tagFilter) query = query.contains('tags', [tagFilter]);
            }
        } else if (table === 'curated_collections') {
            // Always filter to published even when no tag filter
            query = query.eq('is_published', true);
        }

        const { data, error } = await query;
        if (error || !data) return [];
        if (table === 'curated_collections') {
            console.log(`[DEBUG] curated_collections query returned ${data.length} rows:`, data.map(r => ({ id: r.id, title: r.title, mediaCount: r.media?.length })));
        }
        return data.map(row => normalize(row, table)).filter(Boolean);
    } catch (err) {
        console.error(`[InspireFeed] Error fetching ${table}:`, err.message);
        return [];
    }
}

/**
 * Shuffle array in place (Fisher-Yates) — keeps source diversity within the grid.
 */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Pre-warm the cache on server startup.
 * Fetches first page (no filters) and stores it.
 */
export async function prewarmInspireCache() {
    console.log('Pre-warming Inspire feed cache...');
    try {
        const cacheKey = 'inspire_page_0_no_filter';
        if (inspireCache.has(cacheKey)) return;

        const tables = Object.keys(TABLE_WEIGHTS);
        const results = await Promise.all(
            tables.map(table => fetchFromTable(table, 0, TABLE_WEIGHTS[table], null))
        );

        const items = seededShuffle(results.flat(), 42);
        inspireCache.set(cacheKey, items);
        console.log(`[Success] Inspire feed cache warm — ${items.length} items ready`);
    } catch (err) {
        console.error('[Error] Inspire feed cache warm failed:', err.message);
    }
}

/**
 * Setup /api/inspire/feed route.
 * Query params:
 *   page=0        — page index (0-based), each page = 100 items
 *   source=all    — filter by table name (optional)
 *   tag=ui        — filter by tag/category string (optional)
 */
export default function setupInspireRoutes(app, { authenticateUser }) {
    app.get('/api/inspire/feed', authenticateUser, async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 0;
            const sourceFilter = req.query.source || null;
            const tagFilter = req.query.tag || null;

            // Cache key encodes all filter params
            const cacheKey = `inspire_page_${page}_src_${sourceFilter || 'all'}_tag_${tagFilter || 'none'}`;

            // Return from cache if available
            if (inspireCache.has(cacheKey)) {
                return res.json({
                    items: inspireCache.get(cacheKey),
                    page,
                    cached: true,
                });
            }

            // Determine which tables to query
            const tables = sourceFilter
                ? [sourceFilter].filter(t => TABLE_WEIGHTS[t])
                : Object.keys(TABLE_WEIGHTS);

            // Calculate per-table offsets and counts for this page
            // Use fixed weight per table regardless of total, so offsets are consistent
            const results = await Promise.all(
                tables.map(table => {
                    const count = sourceFilter ? PAGE_SIZE : (TABLE_WEIGHTS[table] || 1);
                    const offset = page * count; // page 0 → rows 0..count-1, page 1 → count..2*count-1, etc.
                    return fetchFromTable(table, offset, count, tagFilter);
                })
            );

            // Seeded shuffle with page number so each page is consistently ordered
            const items = seededShuffle(results.flat(), page * 31337 + 1);

            // Cache result
            inspireCache.set(cacheKey, items);

            return res.json({ items, page, cached: false });
        } catch (err) {
            console.error('[InspireFeed] Route error:', err.message);
            res.status(500).json({ error: 'Failed to load inspire feed' });
        }
    });

    // Get available filter categories (cached for 1 hour)
    app.get('/api/inspire/filters', async (req, res) => {
        const cacheKey = 'inspire_filters';
        if (inspireCache.has(cacheKey)) {
            return res.json(inspireCache.get(cacheKey));
        }

        try {
            // Fetch distinct categories from the tables that support it
            const [lapaData, landbookData, viewportData, spellsData] = await Promise.all([
                supabase.from('lapa_websites').select('categories').limit(500),
                supabase.from('landbook_websites').select('categories').limit(500),
                supabase.from('view_port_designs').select('category').limit(200),
                supabase.from('design_spells').select('tags').limit(286),
            ]);

            const categorySet = new Set();

            // Collect lapa categories
            (lapaData.data || []).forEach(row => {
                if (Array.isArray(row.categories)) row.categories.forEach(c => c && categorySet.add(c));
            });
            // Collect landbook categories
            (landbookData.data || []).forEach(row => {
                if (Array.isArray(row.categories)) row.categories.forEach(c => c && categorySet.add(c));
            });
            // Collect viewport categories
            (viewportData.data || []).forEach(row => {
                if (row.category) categorySet.add(row.category);
            });
            // Collect design_spells tags
            (spellsData.data || []).forEach(row => {
                if (Array.isArray(row.tags)) row.tags.forEach(t => t && categorySet.add(t));
            });

            const categories = Array.from(categorySet).sort();
            const sources = Object.entries(SOURCE_LABELS).map(([key, label]) => ({ key, label }));

            const payload = { categories, sources };
            inspireCache.set(cacheKey, payload, 3600); // 1-hour TTL

            return res.json(payload);
        } catch (err) {
            console.error('[InspireFeed] Filters error:', err.message);
            res.status(500).json({ error: 'Failed to load filters' });
        }
    });
}
