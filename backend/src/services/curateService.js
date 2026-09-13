/**
 * curateService.js
 *
 * Smart Curation engine for InspoAI.
 * Detects generative intent, builds app flow templates or component collections,
 * and fetches curated screens from Pinecone + Supabase design_assets.
 */

import { supabase } from '../config/supabaseClient.js';
import { semanticSearch, isSemanticSearchReady } from './pineconeService.js';
import { understandUIQuery } from '../utils/queryUnderstanding.js';

// ═══════════════════════════════════════════════════════════════════
// INTENT DETECTION
// ═══════════════════════════════════════════════════════════════════

const CURATE_TRIGGERS = [
    // Core action words (anywhere in query)
    /\b(create|generate|build|design|make|collect|curate|compile|assemble|gather)\s/i,
    // Common misspellings of action words
    /\b(cretae|creat|desgin|buid|biuld|genrate|generete|mak)\s/i,
    // Flow & journey keywords
    /\b(flow|journey|screens for|app like|full app|user flow)\b/i,
    // Moodboard keywords + misspellings
    /\b(moodboard|mood board|moodborad|moodbaord|moodbord|mooodboard|mood bored|inspo board|inspiration board)\b/i,
    // Natural language intent ("I need", "I want", "show me", "give me")
    /\b(i need|i want|show me|give me|get me|find me|put together)\b.*\b(screens?|app|moodboard|flow|design|ui|ux|layout|board|page|pages)\b/i,
    // Wireframe/prototype/mockup intent
    /\b(wireframe|prototype|mockup|mock up|layout for)\b/i,
];

// UI component/pattern keywords (no flow needed)
const COMPONENT_KEYWORDS = [
    'dropdown', 'filter', 'modal', 'popup', 'bottom sheet', 'tab bar',
    'card', 'list', 'table', 'chart', 'graph', 'form', 'input',
    'button', 'toggle', 'switch', 'slider', 'carousel', 'pagination',
    'notification', 'toast', 'snackbar', 'avatar', 'badge', 'tooltip',
    'accordion', 'sidebar', 'drawer', 'navbar', 'header', 'footer',
    'empty state', 'loading', 'skeleton', 'error state', 'success state',
    'stepper', 'progress bar', 'rating', 'review',
];

// Flow keywords — triggers multi-step flow layout
const FLOW_KEYWORDS = [
    'app', 'application', 'flow', 'journey', 'screens for', 'full app',
    'user flow', 'onboarding flow', 'checkout flow', 'sign up flow',
    'tracker', 'platform', 'dashboard app', 'mobile app', 'web app',
];

/**
 * Detect if a query should trigger curate mode.
 * Returns { isCurate, type: 'flow'|'collection', cleanQuery, brand, platform, styles }
 */
export function detectCurateIntent(query) {
    const q = (query || '').trim();
    if (!q || q.length < 10) return { isCurate: false };

    // Check trigger patterns
    const triggered = CURATE_TRIGGERS.some(rx => rx.test(q));
    if (!triggered) return { isCurate: false };

    const lq = q.toLowerCase();

    // Detect platform
    let platform = null;
    if (/\b(ios|iphone|ipad|swift|apple)\b/i.test(q)) platform = 'ios';
    else if (/\b(android)\b/i.test(q)) platform = 'android';
    else if (/\b(web|website|saas|landing)\b/i.test(q)) platform = 'web';

    // Detect style modifiers
    const styles = [];
    if (/\bdark\s*mode\b/i.test(q)) styles.push('Dark Mode');
    if (/\bminimal(ist)?\b/i.test(q)) styles.push('Minimal');
    if (/\bmodern\b/i.test(q)) styles.push('Modern');
    if (/\bclean\b/i.test(q)) styles.push('Clean');
    if (/\bcolorful\b/i.test(q)) styles.push('Colorful');
    if (/\bglass(morphism)?\b/i.test(q)) styles.push('Glassmorphism');

    // Detect brand reference ("like Opal", "like Airbnb")
    let brand = null;
    const likeMatch = q.match(/\b(?:like|similar to|inspired by)\s+([A-Za-z][A-Za-z0-9\s.]+)/i);
    if (likeMatch) {
        brand = likeMatch[1].trim().replace(/\s+/g, ' ');
    }

    // Determine type: flow vs collection
    const hasFlowKeywords = FLOW_KEYWORDS.some(k => lq.includes(k));
    const hasComponentKeywords = COMPONENT_KEYWORDS.some(k => lq.includes(k));

    // If component keywords dominate → collection; otherwise → flow
    let type = 'flow';
    if (hasComponentKeywords && !hasFlowKeywords) {
        type = 'collection';
    } else if (hasComponentKeywords && hasFlowKeywords) {
        // Both present — check if it's more component-focused
        const componentCount = COMPONENT_KEYWORDS.filter(k => lq.includes(k)).length;
        const flowCount = FLOW_KEYWORDS.filter(k => lq.includes(k)).length;
        type = componentCount > flowCount ? 'collection' : 'flow';
    }

    // Clean the query for search (remove trigger words)
    const cleanQuery = q
        .replace(/^(create|generate|build|design|make|collect|curate)\s+(a|an|the|some|me)?\s*/i, '')
        .replace(/\b(like|similar to|inspired by)\s+[A-Za-z0-9\s.]+$/i, '')
        .replace(/\b(for|on)\s+(ios|android|web|mobile|iphone|ipad)\b/gi, '')
        .trim() || q;

    console.log(`Curate intent: type=${type} platform=${platform} brand=${brand} styles=[${styles}] query="${cleanQuery}"`);

    return {
        isCurate: true,
        type,
        cleanQuery,
        brand,
        platform,
        styles,
        originalQuery: q,
    };
}

// ═══════════════════════════════════════════════════════════════════
// FLOW TEMPLATES
// ═══════════════════════════════════════════════════════════════════

const FLOW_TEMPLATES = {
    productivity: {
        keywords: ['productivity', 'tracker', 'timer', 'todo', 'task', 'planner', 'calendar', 'schedule', 'habit', 'time track', 'pomodoro', 'notes', 'note taking'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Dashboard'], count: 3 },
            { label: 'Task View', pageTypes: ['Task Management', 'Content Management Page'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Stats', pageTypes: ['Dashboard'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    fintech: {
        keywords: ['fintech', 'banking', 'bank', 'wallet', 'finance', 'payment', 'money', 'crypto', 'trading', 'invest', 'stock'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Verification'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Wallet & Balance'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details'], count: 2 },
            { label: 'Transfer', pageTypes: ['Checkout', 'Paywall & Subscription'], count: 2 },
            { label: 'Analytics', pageTypes: ['Dashboard'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    ecommerce: {
        keywords: ['ecommerce', 'shopping', 'store', 'shop', 'marketplace', 'retail', 'fashion', 'clothing', 'product'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Discover'], count: 3 },
            { label: 'Catalog', pageTypes: ['Catalog Page', 'Product Page & Landing'], count: 2 },
            { label: 'Detail', pageTypes: ['Product Details'], count: 2 },
            { label: 'Cart', pageTypes: ['Carts & Bags'], count: 2 },
            { label: 'Checkout', pageTypes: ['Checkout'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    social: {
        keywords: ['social', 'community', 'feed', 'messaging', 'chat', 'network', 'dating', 'forum', 'post'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Feed', pageTypes: ['Social Feed', 'Home Page', 'Stories'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Chat', pageTypes: ['Content Management Page'], count: 2 },
            { label: 'Search', pageTypes: ['Catalog Page', 'Discover'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    health: {
        keywords: ['health', 'fitness', 'wellness', 'workout', 'exercise', 'meditation', 'sleep', 'diet', 'nutrition', 'gym', 'yoga'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Quiz & Poll'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Dashboard'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Activity', pageTypes: ['Task Management', 'Content Management Page'], count: 2 },
            { label: 'Stats', pageTypes: ['Dashboard'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    education: {
        keywords: ['education', 'learning', 'course', 'study', 'quiz', 'school', 'tutorial', 'lesson', 'teach'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Discover'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Course', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Quiz', pageTypes: ['Quiz & Poll'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings', 'Dashboard'], count: 2 },
        ],
    },
    travel: {
        keywords: ['travel', 'booking', 'hotel', 'flight', 'trip', 'vacation', 'restaurant', 'food delivery', 'delivery', 'ride', 'transportation'],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Discover'], count: 3 },
            { label: 'Search', pageTypes: ['Catalog Page'], count: 2 },
            { label: 'Detail', pageTypes: ['Product Details', 'Product Page & Landing'], count: 2 },
            { label: 'Booking', pageTypes: ['Checkout'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
        ],
    },
    default: {
        keywords: [],
        steps: [
            { label: 'Onboarding', pageTypes: ['Walkthrough', 'Onboarding'], count: 2 },
            { label: 'Sign Up', pageTypes: ['Sign Up', 'Log In'], count: 2 },
            { label: 'Home', pageTypes: ['Home Page', 'Dashboard'], count: 3 },
            { label: 'Detail', pageTypes: ['Product Details', 'Content Management Page'], count: 2 },
            { label: 'Explore', pageTypes: ['Catalog Page', 'Discover'], count: 2 },
            { label: 'Profile', pageTypes: ['Profile & Account'], count: 2 },
            { label: 'Settings', pageTypes: ['Settings'], count: 2 },
            { label: 'Dashboard', pageTypes: ['Dashboard'], count: 2 },
        ],
    },
};

/**
 * Pick the best flow template based on query keywords.
 */
function pickFlowTemplate(query) {
    const lq = query.toLowerCase();
    for (const [name, template] of Object.entries(FLOW_TEMPLATES)) {
        if (name === 'default') continue;
        if (template.keywords.some(k => lq.includes(k))) {
            console.log(`Flow template: ${name}`);
            return { name, ...template };
        }
    }
    console.log('Flow template: default');
    return { name: 'default', ...FLOW_TEMPLATES.default };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN CURATION ENGINE
// ═══════════════════════════════════════════════════════════════════

const COLS = 'id, src, thumbnail, url, title, site_name, site_domain, source, platform, ux_patterns, ui_elements, page_types, tags, width, height';

// Page type flow order — for sorting screens within an app
const PAGE_TYPE_ORDER = [
    'Walkthrough', 'Onboarding', 'Welcome Screen',
    'Sign Up', 'Log In', 'Verification', 'Reset Password',
    'Home Page', 'Dashboard', 'Discover',
    'Catalog Page', 'Product Page & Landing', 'Product Details',
    'Carts & Bags', 'Checkout', 'Paywall & Subscription',
    'Wallet & Balance', 'Task Management', 'Content Management Page',
    'Social Feed', 'Stories', 'Quiz & Poll',
    'Profile & Account', 'Settings',
];

/**
 * Build a curated flow — multi-step app journey.
 * Detects if the user wants a SPECIFIC page type (grouped by app) or a FULL app flow (template mode).
 */
export async function buildCuratedFlow(intent) {
    const { cleanQuery, brand, platform, styles } = intent;

    // Use GPT-4o-mini to understand the query and extract structured intent
    let aiIntent;
    try {
        aiIntent = await understandUIQuery(intent.originalQuery || cleanQuery);
        console.log(`AI understood: industry="${aiIntent.industry}" page_types=${JSON.stringify(aiIntent.page_types)} enhanced="${aiIntent.enhanced_query}"`);
    } catch (err) {
        console.warn('[Warning] AI query understanding failed, using raw query:', err.message);
        aiIntent = { industry: '', enhanced_query: cleanQuery, page_types: [], ux_patterns: [] };
    }

    // ── LOCAL PAGE TYPE DETECTION (fallback when AI returns empty) ──
    // The AI sometimes returns page_types=[] for moodboard-style queries.
    // Detect page types locally from keywords as a safety net.
    const LOCAL_PAGE_TYPE_MAP = {
        'onboarding': ['Onboarding', 'Walkthrough'],
        'walkthrough': ['Walkthrough', 'Onboarding'],
        'welcome': ['Welcome Screen', 'Onboarding'],
        'login': ['Log In'],
        'log in': ['Log In'],
        'sign up': ['Sign Up'],
        'signup': ['Sign Up'],
        'register': ['Sign Up'],
        'settings': ['Settings'],
        'profile': ['Profile & Account'],
        'account': ['Profile & Account'],
        'dashboard': ['Dashboard'],
        'home': ['Home Page', 'Dashboard'],
        'checkout': ['Checkout'],
        'payment': ['Checkout', 'Paywall & Subscription'],
        'pricing': ['Paywall & Subscription'],
        'cart': ['Carts & Bags'],
        'product': ['Product Details'],
        'detail': ['Product Details'],
        'catalog': ['Catalog Page'],
        'search': ['Catalog Page', 'Discover'],
        'explore': ['Discover'],
        'feed': ['Social Feed'],
        'chat': ['Content Management Page'],
        'verification': ['Verification'],
        'reset password': ['Reset Password'],
    };

    const originalQ = (intent.originalQuery || cleanQuery).toLowerCase();
    if (!aiIntent.page_types || aiIntent.page_types.length === 0) {
        for (const [keyword, pageTypes] of Object.entries(LOCAL_PAGE_TYPE_MAP)) {
            if (originalQ.includes(keyword)) {
                aiIntent.page_types = pageTypes;
                console.log(`Local page_type detection: "${keyword}" → ${JSON.stringify(pageTypes)}`);
                break;
            }
        }
    }

    // ── ROUTING: Specific page type → app-grouped mode ──
    // If page types detected (AI or local), and user isn't asking for a full app,
    // use app-grouped mode (group results by real app name).
    const hasSpecificPageTypes = aiIntent.page_types && aiIntent.page_types.length > 0;
    const lq = cleanQuery.toLowerCase();
    const isFullAppQuery = /\b(full app|complete app|entire app|app flow|user flow)\b/i.test(lq)
        || (brand && !hasSpecificPageTypes);

    if (hasSpecificPageTypes && !isFullAppQuery) {
        console.log(` App-grouped mode: page_types=${JSON.stringify(aiIntent.page_types)}`);
        return buildAppGroupedFlow(intent, aiIntent);
    }

    // ── TEMPLATE MODE: Full app flow ──
    console.log(`Template flow mode`);
    const template = pickFlowTemplate(cleanQuery);
    console.log(`Building curated flow: "${cleanQuery}" (template=${template.name}, brand=${brand}, platform=${platform})`);

    const steps = [];
    const usedIds = new Set();

    for (const stepDef of template.steps) {
        const stepScreens = await findScreensForStep(
            cleanQuery,
            stepDef,
            brand,
            platform,
            styles,
            usedIds,
            aiIntent
        );

        steps.push({
            label: stepDef.label,
            pageTypes: stepDef.pageTypes,
            screens: stepScreens,
        });

        for (const s of stepScreens) {
            if (s._internalId) usedIds.add(s._internalId);
        }
    }

    return {
        mode: 'curate',
        type: 'flow',
        title: buildTitle(cleanQuery, brand, platform),
        reference: brand,
        platform,
        styles,
        template: template.name,
        steps,
        totalScreens: steps.reduce((sum, s) => sum + s.screens.length, 0),
    };
}

// ═══════════════════════════════════════════════════════════════════
// APP-GROUPED CURATION
// Shows top N real apps, each with their complete screens for the
// requested page type. e.g. "onboarding fintech ios" → 5 fintech
// apps each with all their onboarding screens.
// ═══════════════════════════════════════════════════════════════════

async function buildAppGroupedFlow(intent, aiIntent) {
    const { cleanQuery, platform, styles } = intent;
    const targetApps = 6;

    // Map AI page_types to actual DB page_types values
    const requestedPageTypes = aiIntent.page_types || [];
    const PAGE_TYPE_ALIASES = {
        'Onboarding': ['Onboarding', 'Walkthrough', 'Welcome Screen'],
        'Walkthrough': ['Walkthrough', 'Onboarding', 'Welcome Screen'],
        'Log In': ['Log In', 'Sign Up', 'Reset Password'],
        'Sign Up': ['Sign Up', 'Log In', 'Verification'],
        'Settings': ['Settings'],
        'Dashboard': ['Dashboard', 'Home Page'],
        'Home Page': ['Home Page', 'Dashboard', 'Discover'],
        'Profile & Account': ['Profile & Account'],
        'Checkout': ['Checkout', 'Carts & Bags', 'Paywall & Subscription'],
        'Product Details': ['Product Details', 'Product Page & Landing'],
    };

    const expandedPageTypes = new Set();
    for (const pt of requestedPageTypes) {
        expandedPageTypes.add(pt);
        const aliases = PAGE_TYPE_ALIASES[pt];
        if (aliases) aliases.forEach(a => expandedPageTypes.add(a));
    }
    const pageTypeArray = [...expandedPageTypes];

    console.log(`App-grouped: page_types=[${pageTypeArray.join(', ')}] platform=${platform} industry=${aiIntent.industry}`);

    // ── DUAL PINECONE SEARCH (parallel) ──
    // Search 1: AI enhanced query + strict page_type filter (high precision)
    // Search 2: Focused query without page_type filter (Pinecone semantics handle relevance)
    const searchQuery = aiIntent.enhanced_query || cleanQuery;
    const focusedQuery = `${requestedPageTypes[0] || 'onboarding'} ${aiIntent.industry || ''} ${platform || ''} app screen`.trim();
    let allRows = [];

    if (isSemanticSearchReady()) {
        const pineconeFilter = {};
        if (platform) pineconeFilter.platform = platform;

        // Run both searches in parallel
        const [matches1, matches2] = await Promise.all([
            semanticSearch(searchQuery, 60, pineconeFilter),
            semanticSearch(focusedQuery, 60, pineconeFilter),
        ]);

        console.log(`Search 1 (enhanced): ${matches1.length} results for "${searchQuery.substring(0, 50)}..."`);
        console.log(`Search 2 (focused):  ${matches2.length} results for "${focusedQuery}"`);

        // Merge and deduplicate, keeping best score
        const scoreMap = new Map();
        for (const m of [...matches1, ...matches2]) {
            if (m.score < 0.2) continue;
            const existing = scoreMap.get(m.id);
            if (!existing || m.score > existing) {
                scoreMap.set(m.id, m.score);
            }
        }

        const ids = [...scoreMap.keys()];
        console.log(`Merged: ${ids.length} unique results above 0.2 score`);

        if (ids.length > 0) {
            // Fetch full data — NO page_type filter here (Pinecone already handled relevance)
            let qb = supabase
                .from('design_assets')
                .select(COLS)
                .in('id', ids);
            if (platform) qb = qb.eq('platform', platform);

            const { data: rows } = await qb;
            if (rows) {
                allRows = rows.map(r => ({
                    ...r,
                    _score: scoreMap.get(r.id) || 0.5,
                    // Boost screens that match the requested page types
                    _pageTypeMatch: pageTypeArray.some(pt => (r.page_types || []).includes(pt)),
                }));
                // Sort: page_type matches first, then by score
                allRows.sort((a, b) => {
                    if (a._pageTypeMatch !== b._pageTypeMatch) return b._pageTypeMatch ? 1 : -1;
                    return (b._score) - (a._score);
                });
            }
        }
    }

    console.log(`After Pinecone: ${allRows.length} screens (${allRows.filter(r => r._pageTypeMatch).length} with matching page_types)`);

    // Enforce style modifiers (dark mode, minimal, etc.)
    if (styles.length > 0) {
        const styleFiltered = allRows.filter(row => {
            const rowStr = [...(row.ux_patterns || []), ...(row.tags || [])].join(' ').toLowerCase();
            return styles.some(s => rowStr.includes(s.toLowerCase()));
        });
        if (styleFiltered.length >= 5) allRows = styleFiltered;
    }

    // Hard platform filter
    if (platform) {
        allRows = allRows.filter(r => r.platform && r.platform.toLowerCase() === platform.toLowerCase());
    }

    console.log(`After filters: ${allRows.length} screens`);

    // ── GROUP BY APP ──
    const appMap = new Map();
    for (const row of allRows) {
        const appName = row.site_name || 'Unknown';
        if (appName === 'Unknown' || appName.length < 2) continue;
        if (!appMap.has(appName)) appMap.set(appName, { screens: [], totalScore: 0, allTags: new Set() });
        const app = appMap.get(appName);
        app.screens.push(row);
        app.totalScore += row._score || 0.5;
        // Collect all tags for industry matching
        for (const t of (row.tags || [])) app.allTags.add(t.toLowerCase());
        for (const t of (row.ux_patterns || [])) app.allTags.add(t.toLowerCase());
    }

    // ── INDUSTRY FILTERING ──
    // Map the AI industry to expanded keywords so we can check app tags
    const INDUSTRY_KEYWORDS = {
        'fintech': ['fintech', 'banking', 'bank', 'finance', 'payment', 'money', 'crypto', 'trading', 'invest', 'stock', 'wallet', 'neobank', 'billing', 'invoice', 'payroll', 'expense', 'budget'],
        'food & restaurant': ['food', 'restaurant', 'delivery', 'menu', 'recipe', 'cooking', 'grocery', 'ordering', 'dine'],
        'health': ['health', 'fitness', 'wellness', 'workout', 'medical', 'gym', 'yoga', 'meditation', 'sleep', 'doctor', 'patient', 'hospital', 'clinic'],
        'fitness': ['fitness', 'workout', 'gym', 'exercise', 'training', 'health', 'running', 'cycling'],
        'travel': ['travel', 'booking', 'hotel', 'flight', 'trip', 'vacation', 'transportation', 'ride', 'tour', 'itinerary'],
        'social': ['social', 'community', 'dating', 'messaging', 'chat', 'network', 'feed', 'friends'],
        'education': ['education', 'learning', 'course', 'study', 'quiz', 'school', 'tutorial', 'student', 'teacher'],
        'ecommerce': ['ecommerce', 'shopping', 'store', 'shop', 'marketplace', 'retail', 'fashion', 'cart', 'checkout'],
        'productivity': ['productivity', 'task', 'todo', 'planner', 'calendar', 'notes', 'timer', 'work', 'project', 'team'],
    };

    const WELL_KNOWN_APPS = {
        'fintech': ['acorns', 'revolut', 'klarna', 'coinbase', 'monzo', 'chime', 'venmo', 'paypal', 'robinhood', 'wealthfront', 'betterment', 'n26', 'stripe', 'square', 'block', 'gemini', 'binance', 'kraken', 'stash', 'digit', 'qapital', 'nubank', 'sofi', 'affirm'],
        'health': ['flo', 'calm', 'headspace', 'myfitnesspal', 'clue', 'glow', 'natural cycles', 'zocdoc', 'betterhelp'],
        'fitness': ['strava', 'fitbit', 'peloton', 'nike training', 'adidas running', 'sweat', '8fit'],
        'travel': ['airbnb', 'expedia', 'booking.com', 'tripadvisor', 'uber', 'lyft', 'hopper', 'skyscanner'],
        'social': ['tinder', 'bumble', 'hinge', 'facebook', 'instagram', 'discord', 'telegram', 'whatsapp', 'slack', 'feels'],
        'ecommerce': ['amazon', 'shopify', 'etsy', 'ebay', 'nike', 'zara', 'asos', 'shein'],
    };

    const industry = (aiIntent.industry || '').toLowerCase();
    const industryTags = INDUSTRY_KEYWORDS[industry] || (industry ? [industry] : []);
    const knownApps = WELL_KNOWN_APPS[industry] || [];

    // Check each app for industry match
    for (const [appName, app] of appMap) {
        const tagStr = [...app.allTags].join(' ');
        const nameMatch = knownApps.some(k => appName.toLowerCase().includes(k));
        const tagMatch = industryTags.length > 0 && industryTags.some(k => tagStr.includes(k));
        app.industryMatch = industryTags.length === 0 || nameMatch || tagMatch;
    }

    // Rank: industry matches FIRST, then by screen count, then avg score
    let appsForRanking = [...appMap.entries()];

    // STRICt FILTER: if we found industry matches, remove all non-matches
    const hasMatches = appsForRanking.some(([_, a]) => a.industryMatch);
    if (hasMatches && industry) {
        appsForRanking = appsForRanking.filter(([_, a]) => a.industryMatch);
    }

    const rankedApps = appsForRanking
        .sort((a, b) => {
            const countDiff = b[1].screens.length - a[1].screens.length;
            if (countDiff !== 0) return countDiff;
            return (b[1].totalScore / b[1].screens.length) - (a[1].totalScore / a[1].screens.length);
        })
        .slice(0, targetApps);

    const matchCount = rankedApps.filter(([_, a]) => a.industryMatch).length;
    console.log(`Found ${appMap.size} apps, ${matchCount} match industry "${industry}", keeping top ${rankedApps.length}: ${rankedApps.map(([n, a]) => `${n}${a.industryMatch ? '[OK]' : ''}`).join(', ')}`);

    // ── RE-FETCH COMPLETE FLOWS (parallel) ──
    // For each qualifying app, grab ALL their screens for this page type
    const TARGET_TOTAL = 30;
    const refetchPromises = rankedApps.map(async ([appName]) => {
        let qb = supabase
            .from('design_assets')
            .select(COLS)
            .eq('site_name', appName)
            .overlaps('page_types', pageTypeArray);
        if (platform) qb = qb.eq('platform', platform);
        const { data } = await qb.limit(8);
        return { appName, screens: data || [] };
    });

    const appResults = await Promise.all(refetchPromises);

    const steps = [];
    let totalScreens = 0;
    for (const { appName, screens } of appResults) {
        if (totalScreens >= TARGET_TOTAL) break;
        if (screens.length === 0) continue;

        const sorted = screens.sort((a, b) => getPageTypeOrder(a.page_types) - getPageTypeOrder(b.page_types));
        steps.push({
            label: appName,
            pageTypes: requestedPageTypes,
            screens: sorted.map(row => formatScreen(row, 0.7)),
        });
        totalScreens += sorted.length;
    }

    // If we couldn't find enough apps, fall back to old template approach
    if (steps.length < 2) {
        console.log('[Warning] Not enough apps found for app-grouped mode, falling back to template flow');
        const template = pickFlowTemplate(cleanQuery);
        const fallbackSteps = [];
        const usedIds = new Set();
        for (const stepDef of template.steps) {
            const stepScreens = await findScreensForStep(
                cleanQuery, stepDef, intent.brand, platform, styles, usedIds, aiIntent
            );
            fallbackSteps.push({ label: stepDef.label, pageTypes: stepDef.pageTypes, screens: stepScreens });
            for (const s of stepScreens) { if (s._internalId) usedIds.add(s._internalId); }
        }
        return {
            mode: 'curate', type: 'flow',
            title: buildTitle(cleanQuery, intent.brand, platform),
            reference: intent.brand, platform, styles,
            template: template.name, steps: fallbackSteps,
            totalScreens: fallbackSteps.reduce((sum, s) => sum + s.screens.length, 0),
        };
    }

    const pageLabel = requestedPageTypes[0] || 'Screens';
    const industryLabel = aiIntent.industry ? ` ${aiIntent.industry}` : '';
    const platformLabel = platform ? ` — ${platform.toUpperCase()}` : '';
    const title = `${pageLabel}${industryLabel}${platformLabel} (${steps.length} apps)`;

    return {
        mode: 'curate',
        type: 'flow',
        title,
        reference: null,
        platform,
        styles,
        template: 'app-grouped',
        steps,
        totalScreens: steps.reduce((sum, s) => sum + s.screens.length, 0),
    };
}

/**
 * Get the flow order index for a screen's page_types.
 * Lower = earlier in the flow.
 */
function getPageTypeOrder(pageTypes) {
    if (!pageTypes || pageTypes.length === 0) return 999;
    let minOrder = 999;
    for (const pt of pageTypes) {
        const idx = PAGE_TYPE_ORDER.indexOf(pt);
        if (idx >= 0 && idx < minOrder) minOrder = idx;
    }
    return minOrder;
}

/**
 * Build a curated collection — freeform pattern/component curation.
 */
export async function buildCuratedCollection(intent) {
    const { cleanQuery, brand, platform, styles } = intent;
    const TOTAL_SCREENS = 15;

    console.log(`Building curated collection: "${cleanQuery}" (brand=${brand}, platform=${platform})`);

    // Use semantic search as primary
    let screens = [];
    if (isSemanticSearchReady()) {
        const searchQuery = [cleanQuery, ...styles].join(' ');
        const filter = platform ? { platform } : null;
        const matches = await semanticSearch(searchQuery, TOTAL_SCREENS + 10, filter);

        if (matches.length > 0) {
            // Filter out low relevance
            const goodMatches = matches.filter(m => m.score >= 0.25);
            const ids = goodMatches.map(m => m.id);

            let qb = supabase
                .from('design_assets')
                .select(COLS)
                .in('id', ids);
            if (platform && platform !== 'web') {
                qb = qb.eq('platform', platform);
            }
            const { data: rows } = await qb;

            if (rows) {
                const rowMap = new Map(rows.map(r => [r.id, r]));
                screens = goodMatches
                    .filter(m => rowMap.has(m.id))
                    .slice(0, TOTAL_SCREENS)
                    .map(match => {
                        const row = rowMap.get(match.id);
                        return formatScreen(row, match.score);
                    });
            }
        }
    }

    // Fallback: keyword search with platform filter
    if (screens.length < 5) {
        let qb = supabase
            .from('design_assets')
            .select(COLS)
            .textSearch('title_query_tags', cleanQuery, { type: 'websearch', config: 'english' });
        if (platform && platform !== 'web') {
            qb = qb.eq('platform', platform);
        }
        const { data: fbRows } = await qb.limit(TOTAL_SCREENS);

        if (fbRows) {
            const existingIds = new Set(screens.map(s => s._internalId));
            for (const row of fbRows) {
                if (!existingIds.has(row.id) && screens.length < TOTAL_SCREENS) {
                    screens.push(formatScreen(row, 0.7));
                    existingIds.add(row.id);
                }
            }
        }
    }

    // Detect tags from query to show as filter pills
    const detectedTags = styles.slice();
    const COMPONENT_TAG_MAP = {
        'dropdown': 'Dropdown', 'filter': 'Filter & Sorting', 'modal': 'Modal',
        'card': 'Cards & Tiles', 'chart': 'Chart', 'form': 'Form',
        'dark mode': 'Dark Mode', 'dark': 'Dark Mode',
        'login': 'Login', 'payment': 'Payment', 'checkout': 'Checkout',
        'notification': 'Notifications', 'search': 'Search Bar',
    };
    for (const [keyword, tag] of Object.entries(COMPONENT_TAG_MAP)) {
        if (cleanQuery.toLowerCase().includes(keyword) && !detectedTags.includes(tag)) {
            detectedTags.push(tag);
        }
    }

    // Detect industry tags
    const INDUSTRY_TAGS = ['fintech', 'ecommerce', 'health', 'social', 'education', 'travel', 'productivity'];
    for (const ind of INDUSTRY_TAGS) {
        if (cleanQuery.toLowerCase().includes(ind) && !detectedTags.includes(ind)) {
            detectedTags.push(ind.charAt(0).toUpperCase() + ind.slice(1));
        }
    }

    return {
        mode: 'curate',
        type: 'collection',
        title: buildTitle(cleanQuery, brand, platform),
        reference: brand,
        platform,
        styles,
        tags: detectedTags,
        screens,
        totalScreens: screens.length,
    };
}

/**
 * Refine an existing curation — add a new step/screens from a follow-up query.
 */
export async function refineCuration(query, existingType, platform, originalQuery = '', styles = []) {
    const cleanQ = query
        .replace(/^(add|include|also|show|get|find)\s+(a|an|the|some|me)?\s*/i, '')
        .trim();

    // ── Context-aware query building ──
    // Detect if the follow-up is a relative reference to the original query
    const RELATIVE_MARKERS = /\b(same|smae|sme|saem|similar|simlar|similiar|smilar|that|this|thsi|thiss|tht|it|the same|like that|like this|like before|like these|like those|those|thsoe|thoes|these|thise|tehse|above|abve|previous|prevous|previuos|previos|again|agan|agian|as before|from before|from above|more of|more like|of these|of those|more|need more|add more|get more|give more|want more|show more|find more|extra|additional)\b/i;

    // Words that are effectively empty commands — not actual search terms
    const GENERIC_FILLERS = /\b(screens?|results?|pages?|designs?|inspiration|inspo|ui|ux|apps?|examples?|options?|please|pls|plz|thx|thanks|i need|i want|can you|could you|give me|show me|get me|find me|add|need|want)\b/gi;

    const isRelativeQuery = RELATIVE_MARKERS.test(cleanQ) && originalQuery;

    // Also check if the query is too generic/short to be a standalone query
    const strippedQuery = cleanQ.replace(GENERIC_FILLERS, '').replace(/\s+/g, ' ').trim();
    const isTooGeneric = strippedQuery.length < 3 && originalQuery;

    let searchQuery = cleanQ;
    if ((isRelativeQuery || isTooGeneric) && originalQuery) {
        // Strip relative reference words and extract the new modifiers
        const newModifiers = cleanQ
            .replace(RELATIVE_MARKERS, '')
            .replace(/\b(i need|i want|to create|to design|to build|to make|for a|for an|for the|but|and|also|please|screens?|results?|more)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        // Combine original query context with new modifiers
        const originalClean = originalQuery
            .replace(/^(i need|i want|show me|give me|create|generate|build|design|make)\s+(to\s+)?(create|design|build|make)?\s*(a|an|the|some|me)?\s*/i, '')
            .replace(/\b(and i need|i need|the platform|good inspirations?|for the same)\b/gi, '')
            .replace(/\s+/g, ' ')
            .trim();

        searchQuery = newModifiers
            ? `${originalClean} ${newModifiers}`.trim()
            : originalClean;
        console.log(` Context-aware follow-up → combined query: "${searchQuery}" (original="${originalClean}", modifiers="${newModifiers || 'none'}")`);

        // Inherit platform from modifiers if mentioned
        if (!platform) {
            if (/\b(mobile|ios|android|phone)\b/i.test(newModifiers)) platform = 'mobile';
            else if (/\b(web|website|desktop)\b/i.test(newModifiers)) platform = 'web';
        }
    }

    // Append style context if available
    if (styles && styles.length > 0) {
        searchQuery = `${searchQuery} ${styles.join(' ')}`;
    }

    console.log(`Curate refine: "${searchQuery}" (type=${existingType}, relative=${isRelativeQuery})`);

    // Detect page type from the refinement query
    const PAGE_ALIASES = {
        'login': 'Log In', 'sign in': 'Log In', 'signin': 'Log In',
        'signup': 'Sign Up', 'sign up': 'Sign Up', 'register': 'Sign Up',
        'home': 'Home Page', 'dashboard': 'Dashboard',
        'settings': 'Settings', 'profile': 'Profile & Account',
        'checkout': 'Checkout', 'payment': 'Checkout', 'pay': 'Checkout',
        'cart': 'Carts & Bags', 'onboarding': 'Walkthrough',
        'chat': 'Content Management Page', 'search': 'Catalog Page',
        'pricing': 'Paywall & Subscription',
    };

    let detectedPageTypes = [];
    const lq = searchQuery.toLowerCase();
    for (const [alias, pageType] of Object.entries(PAGE_ALIASES)) {
        if (lq.includes(alias)) detectedPageTypes.push(pageType);
    }
    detectedPageTypes = [...new Set(detectedPageTypes)].slice(0, 2);

    // Search via Pinecone
    let screens = [];
    if (isSemanticSearchReady()) {
        const filter = platform ? { platform } : null;
        const matches = await semanticSearch(searchQuery, 20, filter);
        if (matches.length > 0) {
            const ids = matches.map(m => m.id);
            const { data: rows } = await supabase
                .from('design_assets')
                .select(COLS)
                .in('id', ids);

            if (rows) {
                const rowMap = new Map(rows.map(r => [r.id, r]));
                screens = matches
                    .filter(m => rowMap.has(m.id))
                    .slice(0, 15)
                    .map(match => formatScreen(rowMap.get(match.id), match.score));
            }
        }
    }

    // Fallback
    if (screens.length < 5 && detectedPageTypes.length > 0) {
        const { data: fbRows } = await supabase
            .from('design_assets')
            .select(COLS)
            .contains('page_types', [detectedPageTypes[0]])
            .limit(15);

        if (fbRows) {
            const existingIds = new Set(screens.map(s => s._internalId));
            for (const row of fbRows) {
                if (!existingIds.has(row.id) && screens.length < 15) {
                    screens.push(formatScreen(row, 0.7));
                    existingIds.add(row.id);
                }
            }
        }
    }

    // Build a flow-compatible label
    const labelWords = cleanQ
        .replace(/\b(screen|screens|page|pages|ui|ux|design|add|include)\b/gi, '')
        .trim()
        .split(/\s+/)
        .slice(0, 3)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

    return {
        label: labelWords || 'New Step',
        pageTypes: detectedPageTypes,
        screens,
    };
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Find screens for a single flow step.
 * Prioritises: brand match → semantic + page_type → Supabase fallback.
 */
async function findScreensForStep(query, stepDef, brand, platform, styles, usedIds, aiIntent = null) {
    const screens = [];
    const targetCount = stepDef.count || 2;

    // ── Build a step-focused search query using AI context ──
    // Use the AI-extracted industry keyword instead of manual stop-word stripping.
    // e.g. AI says industry="fintech" → search: "Onboarding screen fintech ios"
    const industryHint = aiIntent?.industry || '';
    const searchText = [stepDef.label, 'screen', industryHint, platform || '', ...styles]
        .filter(Boolean).join(' ').trim();

    console.log(`   Step "${stepDef.label}": searching "${searchText}" (pageTypes: ${stepDef.pageTypes.join(', ')})`);

    // ── Strategy 1: Brand match (if user said "like Opal") ──
    if (brand) {
        let qb = supabase
            .from('design_assets')
            .select(COLS)
            .ilike('site_name', `%${brand}%`)
            .overlaps('page_types', stepDef.pageTypes);
        if (platform && platform !== 'web') qb = qb.eq('platform', platform);
        const { data: brandRows } = await qb.limit(targetCount);

        if (brandRows) {
            for (const row of brandRows) {
                if (!usedIds.has(row.id)) {
                    screens.push(formatScreen(row, 0.95));
                    usedIds.add(row.id);
                }
            }
        }
    }

    // ── Strategy 2: Semantic search (Pinecone) with platform filter ──
    if (screens.length < targetCount && isSemanticSearchReady()) {
        // Build complete Pinecone filter
        const pineconeFilter = {};
        if (platform) pineconeFilter.platform = platform;

        const hasFilter = Object.keys(pineconeFilter).length > 0;
        const matches = await semanticSearch(
            searchText,
            targetCount * 5,      // fetch extra so we can filter strictly
            hasFilter ? pineconeFilter : null
        );

        if (matches.length > 0) {
            // Filter out low-score results
            const goodMatches = matches.filter(m => m.score >= 0.25);
            const ids = goodMatches.map(m => m.id).filter(id => !usedIds.has(id));

            if (ids.length > 0) {
                // Fetch from Supabase WITH platform enforcement
                let qb = supabase
                    .from('design_assets')
                    .select(COLS)
                    .in('id', ids.slice(0, 20));
                if (platform && platform !== 'web') {
                    qb = qb.eq('platform', platform);
                }
                const { data: rows } = await qb;

                if (rows) {
                    // Strictly prefer rows that match the step's page_types
                    const withPageType = rows.filter(r =>
                        r.page_types?.some(pt => stepDef.pageTypes.includes(pt))
                    );
                    const withoutPageType = rows.filter(r =>
                        !r.page_types?.some(pt => stepDef.pageTypes.includes(pt))
                    );

                    // Add matching screens first
                    for (const row of withPageType) {
                        if (!usedIds.has(row.id) && screens.length < targetCount) {
                            const match = goodMatches.find(m => m.id === row.id);
                            screens.push(formatScreen(row, match?.score || 0.8));
                            usedIds.add(row.id);
                        }
                    }

                    // Only add non-matching if we still can't fill the step
                    if (screens.length < targetCount) {
                        for (const row of withoutPageType) {
                            if (!usedIds.has(row.id) && screens.length < targetCount) {
                                const match = goodMatches.find(m => m.id === row.id);
                                // Lower score for non-matching page type
                                screens.push(formatScreen(row, (match?.score || 0.5) * 0.6));
                                usedIds.add(row.id);
                            }
                        }
                    }
                }
            }
        }
    }

    // ── Strategy 3: Direct Supabase page_types query (fallback) ──
    if (screens.length < targetCount) {
        for (const pt of stepDef.pageTypes) {
            if (screens.length >= targetCount) break;
            let qb = supabase.from('design_assets').select(COLS).contains('page_types', [pt]);
            if (platform) qb = platform === 'web' ? qb.or('platform.eq.web,platform.is.null') : qb.eq('platform', platform);
            const { data: ptRows } = await qb.limit(targetCount * 2);

            if (ptRows) {
                for (const row of ptRows) {
                    if (!usedIds.has(row.id) && screens.length < targetCount) {
                        screens.push(formatScreen(row, 0.5));
                        usedIds.add(row.id);
                    }
                }
            }
        }
    }

    console.log(`  [Success] Step "${stepDef.label}": found ${screens.length}/${targetCount} screens`);
    return screens;
}

/**
 * Format a Supabase design_assets row into a standard screen object.
 */
function formatScreen(row, relevanceScore = 0.5) {
    return {
        image: row.thumbnail || row.src,
        fullImage: row.src || row.thumbnail,
        title: row.title || row.site_name || 'UI Screen',
        source: row.source || row.site_name || 'UI Reference',
        url: row.url,
        _internalId: row.id,
        width: row.width,
        height: row.height,
        platform: row.platform,
        siteName: row.site_name,
        pageTypes: row.page_types || [],
        uxPatterns: row.ux_patterns || [],
        tags: row.tags || [],
        relevanceScore,
    };
}

/**
 * Build a human-readable title for the curation.
 */
function buildTitle(query, brand, platform) {
    const parts = [];
    // Capitalize first letter of each word
    const cleanTitle = query
        .replace(/\b(screen|screens|ui|ux)\b/gi, '')
        .trim()
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

    parts.push(cleanTitle);
    if (platform) parts.push(`— ${platform.toUpperCase()}`);
    if (brand) parts.push(`(inspired by ${brand})`);

    return parts.join(' ');
}
