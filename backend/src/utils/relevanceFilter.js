// ═══════════════════════════════════════════════════════════════════════════
// RELEVANCE FILTER — Scores and filters search results by query-to-title
// keyword overlap. Drops garbage results that don't match the user's intent.
// ═══════════════════════════════════════════════════════════════════════════

// Common stop words to ignore during scoring
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'it', 'its', 'this', 'that', 'as',
    'are', 'was', 'were', 'be', 'been', 'has', 'have', 'had', 'do', 'does',
    'did', 'will', 'can', 'may', 'should', 'would', 'could', 'not', 'no',
    'up', 'out', 'if', 'about', 'which', 'when', 'what', 'how', 'all',
    'more', 'than', 'some', 'very', 'so', 'just', 'get', 'got', 'also',
    'into', 'over', 'such', 'them', 'then', 'these', 'those', 'your',
    'our', 'his', 'her', 'we', 'they', 'you', 'i', 'my', 'me', 'us',
]);

// Design/UI terms that are always considered relevant
const DESIGN_BOOST_WORDS = new Set([
    'ui', 'ux', 'design', 'screen', 'interface', 'app', 'mobile', 'web',
    'template', 'mockup', 'wireframe', 'prototype', 'component', 'layout',
    'dashboard', 'landing', 'page', 'homepage', 'login', 'signup',
    'dribbble', 'behance', 'figma', 'sketch', 'adobe',
    'modern', 'minimal', 'clean', 'premium', 'professional',
    'tutorial', 'kit', 'system', 'pattern', 'guide'
]);

// Terms that indicate literal objects instead of design concepts
const LITERAL_PENALTY_WORDS = new Set([
    'fruit', 'juice', 'drink', 'food', 'vegetable', 'eating', 'cooking',
    'recipe', 'tasty', 'organic', 'fresh', 'raw', 'delicious', 'ingredients'
]);

// Terms that should be boosted for tech brand searches
const TECH_BOOST_WORDS = new Set([
    'ios', 'android', 'os', 'system', 'concept', 'wwdc', 'interface',
    'vision', 'glassmorphism', 'dynamic', 'brand', 'strategy', 'identity'
]);

// Terms that indicate generic 3D assets rather than real UI designs
const UI_ASSET_PENALTY_WORDS = new Set([
    'illustration', '3d', 'icon', 'render', 'clay', 'abstract', 'character',
    'background', 'isolated', 'element', 'pack', 'set'
]);

// Semantic synonyms — maps related terms so "chat" matches "chatbot", etc.
const SYNONYM_MAP = {
    'chat': ['chatbot', 'chatbox', 'messenger', 'messaging', 'conversation', 'live chat', 'support chat'],
    'chatbot': ['chat', 'chatbox', 'ai assistant', 'conversational', 'bot'],
    'chatbox': ['chat', 'chatbot', 'messenger', 'chat widget', 'chat window'],
    'login': ['signin', 'sign-in', 'sign in', 'authentication', 'log in'],
    'signup': ['register', 'registration', 'sign up', 'sign-up', 'create account', 'onboarding'],
    'dashboard': ['admin', 'analytics', 'overview', 'panel', 'control panel'],
    'modal': ['dialog', 'popup', 'overlay', 'lightbox'],
    'navbar': ['navigation', 'header', 'menu bar', 'top bar', 'app bar'],
    'sidebar': ['side menu', 'navigation panel', 'drawer', 'side panel'],
    'carousel': ['slider', 'slideshow', 'gallery', 'image slider'],
    'toast': ['notification', 'snackbar', 'alert', 'message'],
    'card': ['tile', 'panel', 'card component', 'content card'],
    'button': ['cta', 'call to action', 'action button'],
    'dropdown': ['select', 'combobox', 'picker', 'menu'],
    'pricing': ['plans', 'subscription', 'billing', 'tier'],
    'checkout': ['payment', 'billing', 'purchase', 'order'],
    'profile': ['account', 'user page', 'settings', 'my account'],
    'search': ['search bar', 'find', 'lookup', 'typeahead', 'autocomplete'],
    'onboarding': ['welcome', 'tutorial', 'walkthrough', 'first time', 'intro'],
    'ai': ['artificial intelligence', 'machine learning', 'smart', 'intelligent'],
    'dark': ['dark mode', 'dark theme', 'night mode'],
    'light': ['light mode', 'light theme', 'day mode'],
};

/**
 * Tokenize a string into meaningful lowercase words
 */
function tokenize(text) {
    if (text === null || text === undefined || text === '') return [];
    // Force to string — handles arrays, objects, numbers gracefully
    const str = typeof text === 'string' ? text : (Array.isArray(text) ? text.join(' ') : String(text));
    if (!str.trim()) return [];
    return str
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 1 && !STOP_WORDS.has(w));
}


/**
 * Get expanded keywords including synonyms
 */
function expandWithSynonyms(words) {
    const expanded = new Set(words);
    for (const word of words) {
        if (SYNONYM_MAP[word]) {
            for (const syn of SYNONYM_MAP[word]) {
                // Add individual tokens from multi-word synonyms
                tokenize(syn).forEach(t => expanded.add(t));
            }
        }
    }
    return expanded;
}

/**
 * Score how relevant a result is to the user's query.
 * Returns a score from 0.0 (irrelevant) to 1.0 (perfect match).
 *
 * @param {string} query       — The user's original search query
 * @param {Object} result      — The image result object
 * @param {Set}    queryTokens — Pre-computed expanded query tokens
 * @param {string} intent      — The detected search intent (TECH_BRAND, etc.)
 * @returns {number} Relevance score 0.0 — 1.0
 */
function scoreRelevance(query, result, queryTokens, intent = 'GENERAL') {
    const title = result.title || result.name || '';
    const url = result.image || result.url || '';
    const source = result.source || '';
    const category = result.category || '';

    const titleTokens = tokenize(title);
    const urlTokens = tokenize(url);

    if (titleTokens.length === 0 && urlTokens.length === 0) return 0.3; // Unknown — give benefit of doubt

    let score = 0;
    let maxScore = queryTokens.size;
    if (maxScore === 0) return 0.5; // No meaningful query words

    // ── 1. Title keyword match (highest weight: 0.6) ──
    let titleHits = 0;
    for (const qt of queryTokens) {
        // Exact token match
        if (titleTokens.includes(qt)) {
            titleHits++;
            continue;
        }
        // Partial match (e.g., "chatbox" contains "chat")
        if (titleTokens.some(tt => tt.includes(qt) || qt.includes(tt))) {
            titleHits += 0.7;
        }
    }
    const titleScore = Math.min(titleHits / maxScore, 1.0);

    // ── 2. URL keyword match (medium weight: 0.2) ──
    let urlHits = 0;
    for (const qt of queryTokens) {
        if (urlTokens.some(ut => ut.includes(qt) || qt.includes(ut))) {
            urlHits++;
        }
    }
    const urlScore = Math.min(urlHits / maxScore, 1.0);

    // ── 3. Design source bonus (low weight: 0.1) ──
    let sourceBonus = 0;
    const combinedText = `${source} ${category} ${url}`.toLowerCase();
    const designSources = ['dribbble', 'behance', 'freepik', 'uplabs', 'uigarage', 'screenlane', 'pinterest'];
    if (designSources.some(ds => combinedText.includes(ds))) {
        sourceBonus = 0.5;
    }

    // ── 4. Design keyword bonus (low weight: 0.1) ──
    let designBonus = 0;
    const allTokens = [...titleTokens, ...urlTokens];
    const designHits = allTokens.filter(t => DESIGN_BOOST_WORDS.has(t)).length;
    designBonus = Math.min(designHits / 3, 1.0);

    // ── Weighted final score ──
    score = (titleScore * 0.6) + (urlScore * 0.2) + (sourceBonus * 0.1) + (designBonus * 0.1);

    // ── 5. Intent-based adjustments (softened — only penalize obvious mismatches) ──
    if (intent === 'TECH_BRAND' || intent === 'UI_PATTERN') {
        const hasLiteral = allTokens.some(t => LITERAL_PENALTY_WORDS.has(t));
        if (hasLiteral) {
            score -= 0.25; // Soft penalty (was -0.6 — too aggressive)
        }

        if (intent === 'TECH_BRAND') {
            const hasTechBoost = allTokens.some(t => TECH_BOOST_WORDS.has(t));
            if (hasTechBoost) score += 0.2;
        }

        if (intent === 'UI_PATTERN') {
            const hasAssetPenalty = allTokens.some(t => UI_ASSET_PENALTY_WORDS.has(t));
            if (hasAssetPenalty) score -= 0.15; // Soft penalty (was -0.4)
        }
    }

    return Math.max(0, Math.min(Math.round(score * 100) / 100, 1.0));
}

/**
 * Filter an array of image results by relevance to the query.
 *
 * @param {Array}  results   — Array of image objects (must have .title or .name, .image)
 * @param {string} query     — The user's original search query
 * @param {Object} options
 * @param {number} options.threshold     — Minimum score to keep (default: 0.15)
 * @param {number} options.minResults    — Always keep at least this many (default: 5)
 * @param {boolean} options.sort         — Sort by relevance score descending (default: true)
 * @param {boolean} options.verbose      — Log filtering details (default: false)
 * @returns {Array} Filtered (and optionally sorted) results
 */
export function filterByRelevance(results, query, options = {}) {
    const {
        threshold = 0.15,
        minResults = 5,
        sort = true,
        verbose = false,
        intent = 'GENERAL',
    } = options;

    if (!results || results.length === 0 || !query) return results || [];

    const queryWords = tokenize(query);
    const expandedTokens = expandWithSynonyms(queryWords);

    if (verbose) {
        console.log(`Relevance filter: query="${query}" → tokens=[${[...expandedTokens].join(', ')}]`);
    }

    // Score each result
    const scored = results.map(result => ({
        result,
        score: scoreRelevance(query, result, expandedTokens, intent),
    }));

    // Sort by score descending
    if (sort) {
        scored.sort((a, b) => b.score - a.score);
    }

    // Filter by threshold, but keep at least minResults
    let filtered = scored.filter(s => s.score >= threshold);

    // If we filtered too aggressively, keep the top results regardless
    if (filtered.length < minResults && scored.length >= minResults) {
        filtered = scored.slice(0, minResults);
    } else if (filtered.length < minResults) {
        filtered = scored; // Keep everything if we have fewer than minResults total
    }

    if (verbose) {
        const dropped = scored.length - filtered.length;
        console.log(`Relevance: kept ${filtered.length}/${scored.length} (dropped ${dropped} below ${threshold})`);
        // Log some rejections for debugging
        const rejected = scored.filter(s => s.score < threshold).slice(0, 3);
        rejected.forEach(r => {
            console.log(`   [Error] score=${r.score} "${(r.result.title || r.result.name || '').substring(0, 60)}"`);
        });
    }

    return filtered.map(s => ({
        ...s.result,
        relevanceScore: s.score
    }));
}

/**
 * Quick check if a single result is relevant enough
 */
export function isRelevant(result, query, threshold = 0.15) {
    const queryWords = tokenize(query);
    const expandedTokens = expandWithSynonyms(queryWords);
    return scoreRelevance(query, result, expandedTokens) >= threshold;
}
