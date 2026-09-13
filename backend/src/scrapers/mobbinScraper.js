import googleAPIManager from '../utils/googleApiManager.js';
import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import { filterByRelevance } from '../utils/relevanceFilter.js';
import { assetService } from '../services/assetService.js';

// ═══════════════════════════════════════════════════════════════════════════
// SMART QUERY MAP — Translates 200+ UI/UX terms → optimal search queries
// ═══════════════════════════════════════════════════════════════════════════

const UI_QUERY_MAP = {
    // Navigation
    'hamburger menu': 'hamburger menu mobile app UI screenshot',
    'navbar': 'navigation bar top header UI design screenshot',
    'sidebar': 'sidebar navigation panel UI design',
    'drawer': 'drawer navigation slide panel mobile',
    'mega menu': 'mega menu navigation dropdown website UI',
    'breadcrumbs': 'breadcrumb navigation trail web UI',
    'tabs': 'tabs navigation switching mobile app UI',
    'bottom navigation': 'bottom navigation bar tab mobile app UI',
    'app bar': 'app bar header toolbar mobile UI',

    // Buttons & Actions
    'cta': 'call to action button primary UI design',
    'call to action': 'call to action button primary UI design',
    'primary button': 'primary button action UI design',
    'toggle': 'toggle switch on off UI component',
    'checkbox': 'checkbox selection form UI component',
    'radio button': 'radio button selection UI component',
    'dropdown': 'dropdown select menu UI component design',
    'floating action button': 'floating action button FAB mobile UI',
    'fab': 'floating action button FAB mobile material UI',

    // Content & Layout
    'card': 'card layout content UI design app',
    'modal': 'modal dialog popup overlay UI screenshot',
    'popover': 'popover dropdown floating UI component',
    'tooltip': 'tooltip hover information UI component',
    'accordion': 'accordion expandable collapse UI component',
    'carousel': 'carousel slider image gallery UI mobile',
    'hero section': 'hero section landing page web design screenshot',
    'banner': 'banner notification header UI design',

    // Feedback & Status
    'toast': 'toast notification message UI component mobile',
    'snackbar': 'snackbar notification bottom material UI',
    'empty state': 'empty state no data illustration UI design',
    'loading state': 'loading state spinner skeleton UI design',
    'skeleton screen': 'skeleton screen loading placeholder UI',
    'error state': 'error state page message UI design',
    'success state': 'success confirmation state UI design',
    'alert': 'alert message warning info UI component',

    // Forms & Input
    'text field': 'text field input form UI design',
    'search bar': 'search bar input field UI design app',
    'filter': 'filter sort options panel UI design',

    // Data Display
    'badge': 'badge counter notification UI component',
    'chip': 'chip tag pill label UI material design',
    'avatar': 'avatar user profile image UI component',
    'user profile': 'user profile settings account screen UI',
    'list view': 'list view items rows mobile app UI',
    'table view': 'table view data grid columns dashboard UI',
    'timeline': 'timeline activity feed events UI design',

    // Dialogs & Overlays
    'confirmation dialog': 'confirmation dialog action approve UI',
    'context menu': 'context menu right click options UI',

    // Progress & Steps
    'stepper': 'stepper wizard step progress UI component',
    'progress bar': 'progress bar loading indicator UI',

    // Onboarding & Help
    'onboarding': 'onboarding welcome tutorial screen UI app',
    'walkthrough': 'walkthrough tutorial guide UI app screen',

    // Design Modes
    'dark mode': 'dark mode theme interface UI design',
    'light mode': 'light mode theme interface UI design',

    // Advanced Components
    'command palette': 'command palette search actions UI',
    'chat widget': 'chat widget live support UI design',
    'emoji picker': 'emoji picker selector UI component',
    'rich text editor': 'rich text editor wysiwyg UI',

    // Data & Analytics
    'dashboard': 'dashboard analytics overview UI design screenshot',
    'chart': 'chart graph data visualization UI dashboard',

    // Common Screen Types
    'login': 'login sign in screen UI design app screenshot',
    'login screen': 'login sign in screen UI design app screenshot',
    'sign up': 'sign up registration create account screen UI',
    'signup': 'sign up registration screen UI design',
    'pricing': 'pricing plans subscription page UI design',
    'pricing page': 'pricing table plans comparison page UI design',
    'checkout': 'checkout payment form screen UI design',
    'payment': 'payment checkout billing screen UI design',
    'homepage': 'homepage landing page main UI design screenshot',
    'profile': 'user profile settings account screen UI design',
    'settings page': 'settings preferences account page UI design',
};

// ═══════════════════════════════════════════════════════════════════════════
// UI SCREEN QUERY CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════

// ── TECH BRANDS: Top tech/design entities ──
const TECH_BRANDS = [
    'apple', 'google', 'microsoft', 'meta', 'tesla', 'stripe', 'airbnb',
    'spotify', 'uber', 'instagram', 'twitter', 'slack', 'notion', 'figma',
    'adobe', 'arc', 'linear', 'vercel', 'supabase', 'ios', 'android', 'macos'
];

// ── VISUAL STYLES: Aesthetic keywords ──
const VISUAL_STYLES = [
    'liquid glass', 'glassmorphism', 'frutiger aero', 'minimalist',
    'claymorphism', 'neumorphism', 'skeuomorphism', 'flat design',
    'brutalist', 'y2k', 'cyberpunk', 'duotone', 'gradient', 'bento'
];

const UI_KEYWORDS = [
    'hamburger menu', 'navbar', 'sidebar', 'drawer', 'mega menu', 'breadcrumbs',
    'tabs', 'bottom navigation', 'app bar', 'navigation menu',
    'cta', 'call to action', 'primary button', 'icon button',
    'toggle', 'checkbox', 'radio button', 'dropdown', 'fab', 'floating action button',
    'card', 'modal', 'popover', 'tooltip', 'accordion', 'carousel', 'hero section',
    'banner', 'grid system',
    'toast', 'snackbar', 'empty state', 'loading state', 'skeleton screen',
    'error state', 'success state', 'alert', 'notification center',
    'text field', 'search bar', 'filter', 'sort', 'pagination', 'infinite scroll',
    'badge', 'chip', 'tag', 'pill', 'avatar', 'user profile', 'list view',
    'table view', 'data grid', 'timeline', 'feed',
    'confirmation dialog', 'context menu', 'kebab menu', 'overflow menu',
    'stepper', 'progress bar', 'progress indicator',
    'hover state', 'focus state', 'active state', 'disabled state',
    'onboarding', 'walkthrough', 'tour', 'coach marks',
    'dark mode', 'light mode',
    'command palette', 'global search', 'chat widget',
    'live chat', 'typing indicator', 'emoji picker', 'rich text editor',
    'dashboard', 'analytics', 'chart', 'graph', 'heatmap',
    'version history', 'activity log', 'settings',
    'autocomplete', 'typeahead', 'faceted search',
    'sticky header', 'sticky footer', 'drag and drop',
    'login', 'sign up', 'signup', 'pricing', 'checkout', 'payment',
    'homepage', 'profile', 'settings page', 'onboarding screen',
    'ui', 'ux', 'screen', 'interface', 'design pattern', 'component',
    'wireframe', 'mockup', 'prototype', 'ui kit', 'design system',
    'apple design', 'ios design', 'material design', 'fluent design',
    'wwdc', 'io', 'unpacked',
    // ── Industry / App category keywords ──────────────────────────────
    // These allow queries like "restaurant UI", "fintech app screens" etc.
    'restaurant', 'food', 'cafe', 'delivery', 'ordering',
    'travel', 'booking', 'hotel', 'flight', 'airbnb',
    'fitness', 'workout', 'health', 'medical', 'healthcare',
    'finance', 'fintech', 'banking', 'payment', 'wallet', 'crypto',
    'ecommerce', 'shopping', 'marketplace', 'product page',
    'social', 'messaging', 'chat', 'community', 'dating',
    'news', 'media', 'streaming', 'music', 'podcast',
    'education', 'learning', 'course', 'edtech',
    'real estate', 'property', 'rental', 'listing',
    'gaming', 'game', 'entertainment',
    'productivity', 'task', 'project management', 'crm', 'saas',
];

/**
 * Check if a query is about UI screens / design patterns
 */
export function isUIScreenQuery(query) {
    const q = (query || '').toLowerCase().trim();
    return UI_KEYWORDS.some(kw => {
        if (kw.length <= 3) {
            const regex = new RegExp(`\\b${kw}\\b`, 'i');
            return regex.test(q);
        }
        return q.includes(kw);
    });
}

/**
 * Check if a query is about a Tech Brand
 */
export function isTechBrandQuery(query) {
    const q = (query || '').toLowerCase().trim();
    // Special check: apple (fruit) vs apple (brand)
    // If it's just 'apple', it's ambiguous, but in InspoAI context we assume brand
    // However, 'apple juice' is clearly fruit.
    const fruitTerms = ['juice', 'pie', 'fruit', 'eat', 'organic', 'recipe', 'tasty'];
    if (fruitTerms.some(f => q.includes(f))) return false;

    return TECH_BRANDS.some(brand => {
        const regex = new RegExp(`\\b${brand}\\b`, 'i');
        return regex.test(q);
    });
}

/**
 * Check if a query is about a Visual Style
 */
export function isVisualStyleQuery(query) {
    const q = (query || '').toLowerCase().trim();
    return VISUAL_STYLES.some(style => q.includes(style));
}

/**
 * Classify the overall search intent
 */
export function classifySearchIntent(query) {
    if (!query) return 'GENERAL';

    if (isTechBrandQuery(query)) return 'TECH_BRAND';
    if (isUIScreenQuery(query)) return 'UI_PATTERN';
    if (isVisualStyleQuery(query)) return 'VISUAL_STYLE';

    return 'GENERAL';
}

// ═══════════════════════════════════════════════════════════════════════════
//  LOGO / BRANDING BLOCKLIST — URLs & titles that indicate logos, not screens
// ═══════════════════════════════════════════════════════════════════════════

const LOGO_URL_PATTERNS = [
    'app_logos', '/logo', 'favicon', 'avatar', 'brand-icon',
    'icon-', 'emoji', '/icons/', 'apple-touch-icon',
    'og-image', 'opengraph', 'social-share', 'twitter-card',
    'profile_images', 'profile-pic', 'thumb_',
];

const LOGO_TITLE_PATTERNS = [
    'logo', 'favicon', 'icon set', 'brand mark', 'app icon',
];

function isLogoImage(url, title, width, height) {
    const u = (url || '').toLowerCase();
    const t = (title || '').toLowerCase();

    // URL pattern check
    if (LOGO_URL_PATTERNS.some(p => u.includes(p))) return true;

    // Title check (only if it's JUST a logo reference)
    if (LOGO_TITLE_PATTERNS.some(p => t.endsWith(p) || t === p)) return true;

    // Dimension check: square images under 600px are almost always logos/icons
    if (width && height && width > 0 && height > 0) {
        const ratio = width / height;
        const isSquarish = ratio > 0.85 && ratio < 1.15;
        const isSmall = Math.max(width, height) < 600;
        if (isSquarish && isSmall) return true;
    }

    return false;
}

function isScreenshot(url, title, width, height) {
    // Real UI screenshots tend to be:
    // Mobile: tall & narrow (aspect ~0.4-0.65, e.g. 375x812)
    // Web: wide (aspect ~1.3-2.0, e.g. 1440x900)
    // Or just big images (>800px on one side)
    if (width && height && width > 0 && height > 0) {
        const ratio = width / height;
        const isMobileScreen = ratio > 0.35 && ratio < 0.7 && height > 500;
        const isWebScreen = ratio > 1.2 && ratio < 2.5 && width > 700;
        const isLargeImage = Math.max(width, height) > 800;
        if (isMobileScreen || isWebScreen || isLargeImage) return true;
    }

    // URL-based hints
    const u = (url || '').toLowerCase();
    const screenHints = ['screenshot', 'screen-', 'screens/', 'ui-design', 'mockup',
        'dribbble', 'behance', 'uplabs', 'pttrns', 'screenlane', 'uigarage'];
    if (screenHints.some(h => u.includes(h))) return true;

    return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBBIN SCRAPER CLASS — Google Images for UI Screenshots
// ═══════════════════════════════════════════════════════════════════════════

class MobbinScraper {
    constructor() {
        this.CACHE_TTL_HOURS = 168; // 7 days
    }

    /**
     * Main entry — searches for real UI screenshots via Google Images
     */
    async scrapeMobbinScreens(topic, maxImages = 20) {
        const cleanTopic = (topic || '').trim();
        if (!cleanTopic) return [];

        console.log(`UI Screen search (Supabase): "${cleanTopic}" (limit: ${maxImages})`);

        // ── Serve 100% from Supabase design_assets library (91k+ records) ──
        return assetService.searchUIAssets(cleanTopic, maxImages);
    }

    /**
     * @deprecated — All UI screenshots now served from Supabase design_assets.
     * Kept as a no-op fallback for any direct callers.
     */
    async searchUIScreenshots(topic, limit = 40) {
        console.log(`ℹ searchUIScreenshots delegated to Supabase for "${topic}"`);
        return assetService.searchUIAssets(topic, limit);
    }

    formatResults(items, topic) {
        return (items || []).map((item, index) => ({
            image: {
                image: item.link,
                title: item.title || `${topic} UI Screen ${index + 1}`,
                source: 'UI Reference',
                url: item.image?.contextLink || `https://www.google.com/search?q=${encodeURIComponent(topic + ' UI design')}&tbm=isch`,
                _internalId: `ui-screen-${Date.now()}-${index}`,
                width: item.image?.width || 800,
                height: item.image?.height || 600
            },
            similarity: 0.92 - (index * 0.01),
            reasons: ['Real App UI', 'Design Reference', 'UI Screenshot']
        }));
    }

    /**
     * Maps user query to the best Google Images search term
     */
    mapToSearchQuery(topic) {
        const q = (topic || '').toLowerCase().trim();

        if (UI_QUERY_MAP[q]) return UI_QUERY_MAP[q];

        for (const [key, value] of Object.entries(UI_QUERY_MAP)) {
            if (q.includes(key) || key.includes(q)) return value;
        }

        // Default: append UI context to the raw query
        return `${topic} UI design screenshot`;
    }

    // ═════════════════════════════════════════════════════════════════════
    // CACHE — Supabase mobbin_cache table
    // ═════════════════════════════════════════════════════════════════════

    async getCachedResults(cacheKey) {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('mobbin_cache')
                .select('results, created_at')
                .eq('query', cacheKey)
                .single();

            if (error || !data) return null;

            const hoursOld = (Date.now() - new Date(data.created_at).getTime()) / (1000 * 60 * 60);
            if (hoursOld > this.CACHE_TTL_HOURS) {
                console.log(` Cache expired for "${cacheKey}" (${Math.round(hoursOld)}h old)`);
                return null;
            }
            return data.results || null;
        } catch (err) {
            console.error('[Warning] Cache read error:', err.message);
            return null;
        }
    }

    async cacheResults(cacheKey, results) {
        if (!supabaseAdmin || !results?.length) return;
        try {
            const { error } = await supabaseAdmin
                .from('mobbin_cache')
                .upsert({
                    query: cacheKey,
                    results: results,
                    result_count: results.length,
                    created_at: new Date().toISOString()
                }, { onConflict: 'query' });

            if (error) console.error('[Warning] Cache write error:', error.message);
            else console.log(` Cached ${results.length} UI results for "${cacheKey}"`);
        } catch (err) {
            console.error('[Warning] Cache write error:', err.message);
        }
    }

    // ═════════════════════════════════════════════════════════════════════

    async healthCheck() {
        return {
            status: 'healthy',
            googleKeysAvailable: googleAPIManager.hasAvailableKeys(),
            cacheEnabled: !!supabase,
            queryMapSize: Object.keys(UI_QUERY_MAP).length,
            uiKeywordsCount: UI_KEYWORDS.length,
            timestamp: new Date().toISOString()
        };
    }
}

export const mobbinScraper = new MobbinScraper();
