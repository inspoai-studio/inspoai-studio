import path from 'path';
import {
  processBrandGuidelines,
  analyzeDesign,
  analyzeImage,
  clearBrandGuidelines,
  getBrandGuidelinesStatus
} from '../utils/imageAnalyzer.js';
import {
  getDesignSuggestions,
  extractColorPalette,
  extractHeading,
  getGoogleAPIStats,
  validateImage,
  fetchGoogleImages,
  fetchDesignPlatformsInspiration,
  fetchFreepikImages,
  fetchFreepikAIImage,
  fetchPinterestViaGoogle,
  fetchCuratedWebsitesViaGoogle
} from '../utils/utils.js';
import { mobbinScraper, isUIScreenQuery, classifySearchIntent } from '../scrapers/mobbinScraper.js';
import { iconService } from '../services/iconService.js';
import { assetService } from '../services/assetService.js';
import { isSemanticSearchReady } from '../services/pineconeService.js';
import { isWebSemanticReady } from '../services/webPineconeService.js';
import { websiteService } from '../services/websiteService.js';
import { logSearchQuery } from '../services/searchLogService.js';
import { filterByRelevance } from '../utils/relevanceFilter.js';
import { detectCurateIntent, buildCuratedFlow, buildCuratedCollection, refineCuration } from '../services/curateService.js';

// Pinterest Scraper Stub (Scraping disabled in Vercel serverless environment)
const pinterestScraper = {
  scrapeUIScreenshots: async () => [],
  scrapePinterestImages: async () => [],
  closeBrowser: async () => {}
};

// Pinterest Routes Setup Function (Disabled for Vercel Serverless Optimization)
const setupPinterestRoutes = (app, context) => {
  app.post('/api/discover-p', context.authenticateUser, async (req, res) => {
    res.status(200).json({
      success: true,
      topic: req.body.topic?.trim() || '',
      count: 0,
      rawCount: 0,
      duration: '0ms',
      timestamp: new Date().toISOString(),
      quality: { filtered: 0, total: 0, ratio: '0%' },
      results: [],
      message: 'Pinterest scraping is disabled for Vercel Serverless optimization.'
    });
  });

  app.get('/api/pinterest-health', async (req, res) => {
    res.status(200).json({
      service: 'Pinterest Scraper',
      status: 'disabled',
      message: 'Disabled for Vercel Serverless optimization.',
      timestamp: new Date().toISOString()
    });
  });
};

const setupSameEnergyRoutes = (app, context) => {
  // Same Energy API proxy endpoint
  app.post('/api/same-energy-search', context.authenticateUser, async (req, res) => {
    try {
      const { query, limit = 10 } = req.body;

      // Validate input
      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Query is required and must be a non-empty string'
        });
      }

      const maxImages = Math.min(Math.max(parseInt(limit) || 10, 1), 20);

      console.log(`Same Energy search request: "${query}" (limit: ${maxImages})`);

      // Make request to Same Energy API from backend (no CORS issues)
      const sameEnergyUrl = `https://imageapi.same.energy/search?text=${encodeURIComponent(query.trim())}&n=${maxImages}`;

      const startTime = Date.now();
      const response = await fetch(sameEnergyUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; InspoAI/1.0)'
        },
        timeout: 15000 // 15 second timeout
      });

      if (!response.ok) {
        throw new Error(`Same Energy API returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      // Format results
      const formattedResults = formatSameEnergyResults(data, query);

      console.log(`[Success] Same Energy search completed in ${duration}ms - ${formattedResults.length} results`);

      // Return results
      res.status(200).json({
        success: true,
        query: query.trim(),
        count: formattedResults.length,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        results: formattedResults
      });

    } catch (error) {
      console.error('[Error] Same Energy API error:', error.message);

      // Handle specific error types
      if (error.message.includes('timeout')) {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Same Energy API request timed out. Please try again.',
          code: 'API_TIMEOUT'
        });
      }

      if (error.message.includes('404') || error.message.includes('Not Found')) {
        return res.status(200).json({
          success: true,
          query: req.body.query,
          count: 0,
          message: 'No visual matches found for this query.',
          results: []
        });
      }

      // Generic error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Same Energy search failed. Please try again later.',
        code: 'SEARCH_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Same Energy health check
  app.get('/api/same-energy-health', async (req, res) => {
    try {
      const testResponse = await fetch('https://imageapi.same.energy/search?text=test&n=1', {
        method: 'GET',
        timeout: 5000
      });

      const isHealthy = testResponse.ok;

      res.status(isHealthy ? 200 : 503).json({
        service: 'Same Energy API',
        status: isHealthy ? 'healthy' : 'unhealthy',
        responseTime: testResponse.ok ? 'normal' : 'timeout',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        service: 'Same Energy API',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Helper function to format Same Energy results
  function formatSameEnergyResults(data, searchQuery) {
    if (!data || !Array.isArray(data.images)) {
      return [];
    }

    return data.images.map((img, index) => ({
      image: {
        image: img.url || img.src,
        title: img.title || `${searchQuery} - Visual Match ${index + 1}`,
        source: 'Same Energy',
        url: img.source_url || img.url || '#',
        _internalId: `same-energy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
        width: img.width || 0,
        height: img.height || 0
      },
      similarity: 0.9 - (index * 0.02), // High similarity for visual matches
      reasons: ['Visual similarity', 'Same Energy AI', 'Style match']
    })).filter(item => item.image.image); // Filter out items without valid URLs
  }
};

const setupDribbbleRoutes = (app, context) => {
  app.post('/api/discover-d', context.authenticateUser, async (req, res) => {
    res.status(200).json({
      success: true,
      topic: req.body.topic?.trim() || '',
      count: 0,
      duration: '0ms',
      results: [],
      message: 'Dribbble scraping is disabled for Vercel Serverless optimization.'
    });
  });

  app.get('/api/dribbble-health', async (req, res) => {
    res.status(200).json({
      status: 'disabled',
      message: 'Disabled for Vercel Serverless optimization.',
      timestamp: new Date().toISOString()
    });
  });
};



// Mobbin Routes Setup Function
const setupMobbinRoutes = (app, context) => {
  function filterForQuality(results, topic) {
    if (!results || !Array.isArray(results)) return [];
    const topicWords = topic.toLowerCase().split(' ');

    return results.filter(result => {
      if (!result.image || !result.image.title) return false;
      const title = result.image.title.toLowerCase();

      const hasTopicRelevance = topicWords.some(word =>
        word.length > 2 && title.includes(word)
      );

      const designKeywords = ['design', 'ui', 'ux', 'mobile', 'app', 'web', 'screen', 'layout', 'interface'];
      const hasDesignRelevance = designKeywords.some(keyword => title.includes(keyword));

      return hasTopicRelevance || hasDesignRelevance;
    }).slice(0, 20);
  }

  app.post('/api/discover-m', context.authenticateUser, async (req, res) => {
    try {
      const { topic, limit = 20 } = req.body;
      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ error: 'Topic is required' });
      }

      const maxImages = Math.min(Math.max(parseInt(limit) || 20, 1), 30);
      console.log(`Mobbin scrape request: "${topic}" (limit: ${maxImages})`);

      const startTime = Date.now();
      const results = await mobbinScraper.scrapeMobbinScreens(topic.trim(), maxImages);

      // Visual search background save has been removed

      const duration = Date.now() - startTime;

      const qualityResults = filterForQuality(results, topic);
      console.log(`[Success] Mobbin scraping completed in ${duration}ms (${qualityResults.length} results)`);

      res.status(200).json({
        success: true,
        topic: topic.trim(),
        count: qualityResults.length,
        results: qualityResults,
        duration: `${duration}ms`
      });
    } catch (error) {
      console.error('[Error] Mobbin scraping error:', error.message);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });
};

// Lapa Ninja Routes Setup Function
const setupLapaRoutes = (app, context) => {
  app.post('/api/discover-l', context.authenticateUser, async (req, res) => {
    try {
      const { topic, limit = 20 } = req.body;

      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Topic is required' });
      }

      const maxImages = Math.min(Math.max(parseInt(limit) || 20, 1), 30);
      console.log(`Lapa DB search request: "${topic}" (limit: ${maxImages})`);

      const startTime = Date.now();

      // Use the database instead of live scraping (lightweight, zero-resource)
      const allResults = await websiteService.searchWebsiteAssets(topic.trim(), {}, maxImages * 2);
      const results = allResults
        .filter(r => r.image.source === 'Lapa Ninja')
        .slice(0, maxImages);

      const duration = Date.now() - startTime;
      console.log(`[Success] Lapa DB search completed in ${duration}ms (${results.length} results)`);

      res.status(200).json({
        success: true,
        topic: topic.trim(),
        count: results.length,
        duration: `${duration}ms`,
        results: results
      });

    } catch (error) {
      console.error('[Error] Lapa search error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });

  app.get('/api/lapa-health', async (req, res) => {
    res.json({
      service: 'Lapa Ninja Scraper',
      status: 'disabled',
      message: 'Scraper disabled for serverless optimization. DB searches are active.',
      timestamp: new Date().toISOString()
    });
  });
};

// Land-book Routes Setup Function
const setupLandbookRoutes = (app, context) => {
  app.post('/api/discover-b', context.authenticateUser, async (req, res) => {
    try {
      const { topic, limit = 20 } = req.body;

      if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Topic is required' });
      }

      const maxImages = Math.min(Math.max(parseInt(limit) || 20, 1), 30);
      console.log(`Land-book DB search request: "${topic}" (limit: ${maxImages})`);

      const startTime = Date.now();

      // Use the database instead of live scraping (lightweight, zero-resource)
      const allResults = await websiteService.searchWebsiteAssets(topic.trim(), {}, maxImages * 2);
      const results = allResults
        .filter(r => r.image.source === 'Land-book')
        .slice(0, maxImages);

      const duration = Date.now() - startTime;
      console.log(`[Success] Land-book DB search completed in ${duration}ms (${results.length} results)`);

      res.status(200).json({
        success: true,
        topic: topic.trim(),
        count: results.length,
        duration: `${duration}ms`,
        results: results
      });

    } catch (error) {
      console.error('[Error] Land-book search error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });

  app.get('/api/landbook-health', async (req, res) => {
    res.json({
      service: 'Land-book Scraper',
      status: 'disabled',
      message: 'Scraper disabled for serverless optimization. DB searches are active.',
      timestamp: new Date().toISOString()
    });
  });
};

// Helper: Detect if query is website/landing-page related
function isWebsiteQuery(query) {
  const keywords = [
    'landing page', 'website', 'web design', 'homepage', 'saas',
    'startup', 'portfolio site', 'modern design', 'agency site',
    'ecommerce', 'e-commerce', 'product page', 'landing', 'webpage',
    'site design', 'web page', 'website design', 'web app',
    'fintech', 'crypto', 'nft', 'web3', 'ai website', 'blog design',
    'marketing site', 'landing page for', 'company site', 'service site'
  ];
  const q = (query || '').toLowerCase();
  return keywords.some(kw => q.includes(kw));
}

/**
 * Clean natural-language conversational phrases from search queries.
 * Turns "show me the chat interface of the claude" → "chat interface claude"
 * Turns "show me claude ui" → "claude ui"
 * The original query is preserved for display; this cleaned version is used for search.
 */
function cleanNLQuery(raw) {
  if (!raw) return raw;
  let q = raw.trim();

  // Strip leading conversational intent verbs / phrases
  q = q.replace(
    /^(show me|find me|get me|give me|i want to see|can you show me|display|look up|search for|look for|i need|fetch|bring me|let me see)\s+(the\s+|a\s+|an\s+)?/i,
    ''
  );

  // Strip mid-sentence connectors like "of the", "for the", "by the"
  q = q.replace(/\s+(of|for|by|from|in)\s+the\s+/gi, ' ');

  // Strip trailing filler words
  q = q.replace(/\s+(please|now|today|asap)\s*$/i, '');

  // Collapse extra whitespace
  q = q.replace(/\s{2,}/g, ' ').trim();

  // Safety: never return empty string
  return q || raw;
}

// ── Figma Converter Routes ─────────────────────────────────────────────────
const setupFigmaConverterRoutes = (app, context) => {
  app.post('/api/figma/convert', context.authenticateUser, async (req, res) => {
    res.status(200).json({
      success: false,
      error: 'Figma conversion is disabled for Vercel Serverless optimization.'
    });
  });

  app.get('/api/figma/health', async (req, res) => {
    res.status(200).json({
      service: 'Figma Converter',
      status: 'disabled',
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/figma/nodes', async (req, res) => {
    res.status(200).json({
      success: false,
      error: 'Figma node extraction is disabled for Vercel Serverless optimization.'
    });
  });

  // ── Shared "current URL" store (in-memory, for plugin auto-fill) ──────────
  let _currentFigmaUrl = null;
  let _currentFigmaUrlExpiry = 0;

  app.post('/api/figma/current', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'url required' });
    _currentFigmaUrl = url;
    _currentFigmaUrlExpiry = Date.now() + 3600_000; // 1 hour TTL
    console.log(` Figma current URL stored: ${url}`);
    res.json({ success: true });
  });

  app.get('/api/figma/current', (req, res) => {
    if (_currentFigmaUrl && Date.now() < _currentFigmaUrlExpiry) {
      res.json({ success: true, url: _currentFigmaUrl });
    } else {
      res.json({ success: true, url: null });
    }
  });
};

const setupAssetRoutes = (app, context) => {
  // Get stats for distribution logic
  app.get('/api/asset-stats', async (req, res) => {
    try {
      const count = await assetService.getAssetCount();
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Search local Supabase library
  app.post('/api/local-assets', async (req, res) => {
    try {
      const { topic, limit = 20 } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topic is required' });

      const results = await assetService.searchAssets(topic, limit);
      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Public browse endpoint — no auth required (used by landing page SEO browse pages)
  const BLOCKED_BROWSE_SOURCES = ['lapa ninja', 'land-book', 'landbook', 'refero', 'mobbin'];
  // Keyword aliases for slugs that don't match DB terms directly
  const BROWSE_KEYWORD_ALIASES = {
    'micro interaction': ['animation', 'transition', 'gesture', 'interaction'],
    'voice ui': ['voice', 'assistant', 'siri', 'alexa'],
    'ar interface': ['augmented reality', 'camera', 'ar'],
    'gesture interaction': ['swipe', 'gesture', 'drag'],
    'gamification': ['points', 'badges', 'rewards', 'streak', 'leaderboard'],
    'accessibility': ['screen reader', 'contrast', 'a11y'],
    'empty state': ['empty', 'no results', 'placeholder'],
    'loading states': ['loading', 'skeleton', 'spinner'],
    'form design': ['form', 'input', 'field'],
    'progress indicator': ['progress', 'step', 'stepper'],
    'cards tiles': ['card', 'tile'],
    'filter sorting': ['filter', 'sort'],
    'social feed': ['feed', 'timeline', 'posts'],
    'reviews rating': ['review', 'rating', 'stars'],
    'map view': ['map', 'location'],
    'video player': ['video', 'player', 'media'],
    'saas dashboard': ['saas', 'dashboard', 'analytics'],
    'admin panel': ['admin', 'dashboard', 'panel'],
    'crm dashboard': ['crm', 'contacts', 'dashboard'],
    'analytics dashboard': ['analytics', 'charts', 'dashboard'],
    'ecommerce website': ['ecommerce', 'shop', 'store'],
    'portfolio website': ['portfolio', 'personal'],
    'agency website': ['agency', 'studio'],
    'startup website': ['startup', 'landing'],
    'blog layout': ['blog', 'article'],
    'news website': ['news', 'article', 'media'],
    'knowledge base': ['help', 'docs', 'faq'],
    'minimalist design': ['minimalist', 'minimal', 'clean'],
    'brutalist design': ['brutalist', 'bold'],
    'flat design': ['flat', 'simple'],
    'material design': ['material', 'android'],
    'gradient design': ['gradient', 'color'],
    'pastel colors': ['pastel', 'soft', 'light'],
    'bold typography': ['typography', 'font'],
    'illustration style': ['illustration', 'graphic', 'drawing'],
    '3d design': ['3d', 'three dimensional'],
    'retro vintage': ['retro', 'vintage', 'classic'],
    'split screen': ['split', 'two column'],
    'bottom sheet': ['bottom sheet', 'drawer', 'modal'],
    'floating action button': ['fab', 'button', 'action'],
    'skeleton loading': ['skeleton', 'loading', 'placeholder'],
    'shimmer effect': ['shimmer', 'skeleton', 'loading'],
    'parallax scroll': ['parallax', 'scroll'],
    'masonry grid': ['masonry', 'grid'],
    'hero section': ['hero', 'landing', 'banner'],
    'testimonial section': ['testimonial', 'review', 'social proof'],
    'pricing table': ['pricing', 'plans'],
    'splash screen': ['splash', 'launch', 'intro'],
    'error state': ['error', '404', 'not found'],
    'success state': ['success', 'confirmation', 'done'],
    'confirmation dialog': ['dialog', 'modal', 'alert'],
    'tabs interface': ['tabs', 'tab bar', 'segmented'],
    'sidebar drawer': ['sidebar', 'drawer', 'menu'],
    'modal dialog': ['modal', 'dialog', 'popup'],
    'food delivery': ['food', 'delivery', 'restaurant'],
    'real estate': ['real estate', 'property', 'home'],
    'note taking': ['notes', 'notebook', 'note'],
    'task management': ['tasks', 'todo', 'task'],
    'calendar apps': ['calendar', 'schedule', 'events'],
    'email apps': ['email', 'inbox', 'mail'],
    'weather apps': ['weather', 'forecast'],
    'maps navigation': ['map', 'navigation', 'directions'],
    'ride sharing': ['ride', 'taxi', 'uber'],
    'hotel booking': ['hotel', 'booking', 'accommodation'],
    'flight booking': ['flight', 'travel', 'airline'],
    'sleep tracker': ['sleep', 'rest', 'health'],
    'habit tracker': ['habit', 'routine', 'tracker'],
    'budget tracker': ['budget', 'finance', 'money'],
    'expense tracker': ['expense', 'spending', 'finance'],
    'language learning': ['language', 'learn', 'education'],
    'social networking': ['social', 'network', 'friends'],
    'event planning': ['event', 'party', 'planning'],
    'photo editor': ['photo', 'image', 'edit'],
    'video editor': ['video', 'edit', 'clip'],
    'password manager': ['password', 'security', 'vault'],
    'customer support': ['support', 'help', 'chat'],
  };
  // ── Dynamic Image Sitemap for Google Image Search ──────────────────────────
  // Generates sitemap with <image:image> tags for browse category pages.
  // Cached for 6h using a simple module-level variable.
  let _sitemapCache = null;
  let _sitemapCacheExpiry = 0;
  const IMAGE_SITEMAP_TTL = 6 * 60 * 60 * 1000; // 6 hours in ms

  // Top priority slugs to include inline images for (rest get page-only entries)
  const TOP_SLUGS = [
    'login','sign-up','dashboard','onboarding','pricing','profile','settings',
    'home-screen','search','checkout','cart','chat','feed','explore',
    'dark-mode','navigation','notifications','payment','calendar',
    'airbnb','uber','spotify','netflix','instagram','tiktok','twitter','linkedin',
    'whatsapp','discord','slack','notion','figma','github','stripe','shopify',
    'fintech','healthcare','edtech','ecommerce','social-media','travel',
    'food-delivery','fitness','music','gaming','real-estate','fashion',
    'ios-app','android-app','web-app','landing-page','saas-dashboard',
    'glassmorphism','minimalist-design','brutalist-design','material-design',
    'dark-mode-login','dark-mode-dashboard','web-dashboard','ios-onboarding',
    'crypto','banking','investment','dating','meditation','ai-tools',
  ];

  app.get('/api/sitemap-images.xml', async (req, res) => {
    try {
      // Check cache first
      if (_sitemapCache && Date.now() < _sitemapCacheExpiry) {
        res.set('Content-Type', 'application/xml; charset=utf-8');
        res.set('Cache-Control', 'public, max-age=21600'); // 6h
        return res.send(_sitemapCache);
      }

      console.log('Generating image sitemap...');
      const baseUrl = 'https://www.inspoai.io';
      const today = new Date().toISOString().split('T')[0];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      // Process top slugs in parallel (batches of 10)
      const batchSize = 10;
      for (let i = 0; i < TOP_SLUGS.length; i += batchSize) {
        const batch = TOP_SLUGS.slice(i, i + batchSize);
        const results = await Promise.all(
          batch.map(async (slug) => {
            const q = slug.replace(/-/g, ' ');
            try {
              const assets = await assetService.searchUIAssets(q, 30);
              return { slug, assets: assets || [] };
            } catch (err) {
              console.warn(`[Warning] Sitemap: failed to fetch ${slug}:`, err.message);
              return { slug, assets: [] };
            }
          })
        );

        for (const { slug, assets } of results) {
          const label = slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          xml += `  <url>\n`;
          xml += `    <loc>${baseUrl}/browse/${slug}</loc>\n`;
          xml += `    <lastmod>${today}</lastmod>\n`;

          // Deduplicate image URLs
          const seen = new Set();
          let imgCount = 0;
          for (const asset of assets) {
            if (imgCount >= 30) break;
            const imgUrl = asset?.image?.image || asset?.image?.fullImage || asset?.thumbnail || asset?.src || '';
            if (!imgUrl || seen.has(imgUrl)) continue;
            // Skip blocked sources
            const source = (asset?.source || asset?.image?.source || asset?.site_name || '').toLowerCase();
            if (['lapa.ninja', 'land-book.com', 'refero.design', 'mobbin.com'].some(s => source.includes(s))) continue;

            seen.add(imgUrl);
            const title = (asset?.image?.title || asset?.title || `${label} design screenshot`).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const siteName = (asset?.image?.siteName || asset?.site_name || '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

            xml += `    <image:image>\n`;
            xml += `      <image:loc>${imgUrl.replace(/&/g, '&amp;')}</image:loc>\n`;
            xml += `      <image:title>${title}</image:title>\n`;
            if (siteName) {
              xml += `      <image:caption>${label} UI design from ${siteName} — InspoAI</image:caption>\n`;
            }
            xml += `    </image:image>\n`;
            imgCount++;
          }
          xml += `  </url>\n`;
        }
      }

      xml += `</urlset>\n`;

      // Cache it
      _sitemapCache = xml;
      _sitemapCacheExpiry = Date.now() + IMAGE_SITEMAP_TTL;

      console.log(`Image sitemap generated — ${TOP_SLUGS.length} categories`);

      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=21600');
      res.send(xml);
    } catch (error) {
      console.error('[Error] Image sitemap error:', error.message, error.stack);
      res.status(500).send(`<!-- Sitemap generation error: ${error.message} -->`);
    }
  });

  app.get('/api/browse', async (req, res) => {
    try {
      const { q, limit = 24 } = req.query;
      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return res.status(400).json({ error: 'Query parameter q is required' });
      }
      const safeLimit = Math.min(Math.max(parseInt(limit) || 24, 1), 48);
      const primaryQuery = q.trim().toLowerCase();

      // ── Browse-specific query normalization ──────────────────────────
      // Slugs arrive as "about page", "changelog page", "crypto app" etc.
      // Strip noise words that match everything or nothing useful.
      const BROWSE_NOISE = new Set([
        'page', 'pages', 'app', 'apps', 'design', 'designs', 'ui', 'ux',
        'website', 'web', 'interface', 'screen', 'style', 'tool', 'tools',
      ]);
      const cleanedQuery = primaryQuery
        .split(/\s+/)
        .filter(w => !BROWSE_NOISE.has(w) && w.length > 1)
        .join(' ')
        .trim() || primaryQuery;

      // Primary search — try cleaned query first
      let results = await assetService.searchUIAssets(cleanedQuery, safeLimit * 3);

      // If cleaned query gave nothing and it differs from original, try original
      if ((results || []).length < 4 && cleanedQuery !== primaryQuery) {
        const origResults = await assetService.searchUIAssets(primaryQuery, safeLimit * 3);
        results = [...(results || []), ...(origResults || [])];
      }

      // If sparse results, try aliases + individual words as fallback
      if ((results || []).length < 8) {
        const aliases = BROWSE_KEYWORD_ALIASES[primaryQuery] || [];
        const words = primaryQuery.split(' ').filter(w => w.length > 3);
        const fallbackTerms = [...new Set([...aliases, ...words])];

        for (const term of fallbackTerms) {
          if ((results || []).length >= safeLimit * 2) break;
          const extra = await assetService.searchUIAssets(term, safeLimit * 2);
          results = [...(results || []), ...(extra || [])];
        }
      }

      // Deduplicate by image URL
      const seen = new Set();
      const deduped = (results || []).filter(r => {
        const url = r?.image?.image || r?.image?.fullImage || r?.src || r?.thumbnail || '';
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      });

      // Filter out blocked sources
      const filtered = deduped
        .filter(r => {
          const source = (r?.source || r?.image?.source || r?.site_name || '').toLowerCase();
          return !BLOCKED_BROWSE_SOURCES.some(s => source.includes(s));
        })
        .slice(0, safeLimit);

      res.json({ success: true, query: q.trim(), count: filtered.length, results: filtered });
    } catch (error) {
      console.error('[Error] Browse API error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
};

// Icon Search Routes Setup Function
const setupIconRoutes = (app, context) => {
  app.post('/api/icon-search', context.authenticateUser, async (req, res) => {
    try {
      const { query, limit = 40 } = req.body;

      if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Query is required' });
      }

      const maxIcons = Math.min(Math.max(parseInt(limit) || 40, 1), 80);
      console.log(`Icon search request: "${query}" (limit: ${maxIcons})`);

      const startTime = Date.now();
      const results = await iconService.searchIcons(query.trim(), maxIcons);
      const duration = Date.now() - startTime;

      console.log(`[Success] Icon search completed in ${duration}ms (${results.length} icons)`);

      res.status(200).json({
        success: true,
        query: query.trim(),
        count: results.length,
        duration: `${duration}ms`,
        results: results
      });

    } catch (error) {
      console.error('[Error] Icon search error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
  });

  app.get('/api/icon-health', async (req, res) => {
    try {
      const health = await iconService.healthCheck();
      res.json(health);
    } catch (error) {
      res.status(503).json({ status: 'unhealthy', error: error.message });
    }
  });
};

// Helper: Detect if query is icon/symbol related
function isIconQuery(query) {
  const keywords = ['icon', 'icons', 'symbol', 'symbols'];
  const q = (query || '').toLowerCase();
  return keywords.some(kw => {
    // Match whole words only (not "silicon" or "iconic")
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    return regex.test(q);
  });
}

// Main routes function
export default function routes(app, {
  UserService,
  authenticateUser,
  checkSearchQuota,
  upload,
  cache,
  genAI,
  googleAPIManager,
  appSecretKeyId
}) {

  const context = { authenticateUser };

  // Setup Pinterest routes
  setupPinterestRoutes(app, context);
  setupSameEnergyRoutes(app, context);
  setupDribbbleRoutes(app, context);
  setupMobbinRoutes(app, context);
  setupLapaRoutes(app, context);
  setupLandbookRoutes(app, context);
  setupIconRoutes(app, context);
  setupAssetRoutes(app, context);
  setupFigmaConverterRoutes(app, context);

  // Helper: Get source weight based on intent
  const getSourceWeight = (source, intent, query = '') => {
    let weight = 1.0;
    const isLandingPageQuery = isWebsiteQuery(query);
    // Supabase-backed sources always get the highest priority across all query types
    const isSupabaseSource = ['Mobbin', 'UI Reference', 'Dribbble', 'Mobbin UI', 'Lapa Ninja', 'Land-book'].includes(source);

    if (isLandingPageQuery) {
      // For landing page queries, Lapa Ninja and Land-book are king (already in isSupabaseSource)
      if (isSupabaseSource) weight = 2000.0;
      else if (source === 'Pinterest') weight = 100.0;
      else if (source === 'Google Images') weight = 10.0;
      else if (source === 'Freepik' || source === 'Freepik AI') weight = 0.01;
    } else {
      // Pinterest stays top for general/style searches
      if (source === 'Pinterest') weight = 100.0;
      // Supabase DB sources (real app screenshots) are king — bump to 2000x
      else if (isSupabaseSource) weight = 2000.0;
      // Google Images low priority
      else if (source === 'Google Images') weight = 10.0;
      // Freepik forced to the absolute bottom
      else if (source === 'Freepik' || source === 'Freepik AI') weight = 0.01;
    }

    // Additional intent-based boosters
    if (intent === 'UI_PATTERN') {
      if (isSupabaseSource) weight += 20.0;
      if (source === 'Pinterest') weight += 20.0;
    }

    if (intent === 'VISUAL_STYLE' || intent === 'TECH_BRAND') {
      if (source === 'Pinterest') weight += 50.0;
    }

    return weight;
  };

  // ── HYBRID INTENT EXTRACTION (Keyword + Local Fallback) ──
  const extractSearchIntent = async (rawQuery) => {
    // Tier 1: Fast keyword match (free, instant)
    const keywordIntent = classifySearchIntent(rawQuery);
    const isUI = isUIScreenQuery(rawQuery);
    const isWeb = isWebsiteQuery(rawQuery);
    const isIcon = isIconQuery(rawQuery);

    // If keyword match is confident, return immediately
    if (keywordIntent !== 'GENERAL' || isUI || isIcon || isWeb) {
      console.log(`Keyword intent: ${keywordIntent} (UI=${isUI}, Web=${isWeb}, Icon=${isIcon})`);
      return {
        intent: keywordIntent,
        searchQuery: rawQuery,
        isUIScreen: isUI,
        isWebsite: isWeb,
        isIcon: isIcon,
        refined: false
      };
    }

    // Tier 2: Fast local enrichment (no OpenAI needed)
    // Appends design context to generic queries for better results
    const q = rawQuery.toLowerCase();
    const hasDesignTerm = ['design', 'template', 'mockup', 'ui', 'ux', 'wireframe', 'inspiration'].some(t => q.includes(t));
    const refinedQuery = hasDesignTerm ? rawQuery : `${rawQuery} design inspiration`;
    console.log(`Local enrichment: "${rawQuery}" → "${refinedQuery}"`);

    return {
      intent: 'GENERAL',
      searchQuery: refinedQuery,
      isUIScreen: false,
      isWebsite: false,
      isIcon: false,
      refined: false
    };
  };

  // AUTHENTICATION ROUTES
  // Get current user info
  app.get("/auth/user", authenticateUser, (req, res) => {
    const user = req.user;

    res.json({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      role: user.role,
      team: user.team,
      referral: user.referral,
      quota: user.getQuotaInfo(),
      usageStats: user.getUsageStats(),
      createdAt: user.createdAt,
      onboardingComplete: user.onboardingComplete || user.onboarding?.onboardingComplete || false,
      // Trial info
      trial: user.role === 'trial' ? {
        isActive: user.trial?.isActive ?? true,
        daysRemaining: user.getTrialDaysRemaining(),
        expired: user.trial?.expired ?? false,
        expiresAt: user.trial?.expiresAt
      } : null
    });
  });

  // ══════════════════════════════════════════════════════════════
  // IMAGE PROXY (for Figma export — avoids CORS)
  // ══════════════════════════════════════════════════════════════

  app.get("/api/image-proxy", authenticateUser, async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url parameter required' });

    try {
      const response = await fetch(url, { 
        headers: { 'User-Agent': 'InspoAI/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) return res.status(502).json({ error: 'Failed to fetch image' });

      const buffer = Buffer.from(await response.arrayBuffer());
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
      res.json({ base64 });
    } catch (err) {
      res.status(502).json({ error: 'Image proxy failed', message: err.message });
    }
  });

  // ══════════════════════════════════════════════════════════════
  // SMART CURATION ENDPOINTS
  // ══════════════════════════════════════════════════════════════

  // GET /api/curate — Build a curated flow or collection
  app.get("/api/curate", authenticateUser, checkSearchQuota, async (req, res) => {
    try {
      const { q } = req.query;
      if (!q) return res.status(400).json({ error: "Query is required" });

      const intent = detectCurateIntent(q);
      if (!intent.isCurate) {
        return res.status(400).json({ error: "Query does not match curate intent", isCurate: false });
      }

      console.log(`Curate request: "${q}" → type=${intent.type}`);
      const startTime = Date.now();

      // Track curate search in user quota (same as /search)
      await req.user.incrementSearchCount();

      let result;
      if (intent.type === 'flow') {
        result = await buildCuratedFlow(intent);
      } else {
        result = await buildCuratedCollection(intent);
      }

      const duration = Date.now() - startTime;
      console.log(`[Success] Curate complete: ${result.totalScreens} screens in ${duration}ms`);

      // Log curate search to admin search_logs (fire-and-forget)
      if (req.user?.email) {
        logSearchQuery({
          userEmail: req.user.email,
          query: q,
          searchMode: 'curate',
          resultCount: result.totalScreens,
          page: 0,
        }).catch(err => console.error('[Warning] curate search_log error:', err.message));
      }

      res.json({
        success: true,
        ...result,
        duration,
        quota: req.user.getQuotaInfo(),
      });
    } catch (err) {
      console.error('[Error] Curate error:', err.message);
      res.status(500).json({ error: 'Curation failed', message: err.message });
    }
  });

  // POST /api/curate/refine — Add screens to an existing curation
  app.post("/api/curate/refine", authenticateUser, async (req, res) => {
    try {
      const { query, existingType, platform, originalQuery, styles } = req.body;
      if (!query) return res.status(400).json({ error: "Query is required" });

      console.log(`Curate refine: "${query}" (original: "${originalQuery || 'none'}")`);
      const startTime = Date.now();

      // Track refine as a search action
      await req.user.incrementSearchCount();

      const newStep = await refineCuration(query, existingType || 'flow', platform, originalQuery, styles);
      const duration = Date.now() - startTime;

      console.log(`[Success] Curate refine: "${newStep.label}" — ${newStep.screens.length} screens (${duration}ms)`);

      res.json({
        success: true,
        step: newStep,
        duration,
      });
    } catch (err) {
      console.error('[Error] Curate refine error:', err.message);
      res.status(500).json({ error: 'Refinement failed', message: err.message });
    }
  });

  // Main search route with authentication and quota
  app.get("/search", authenticateUser, checkSearchQuota, async (req, res) => {
    try {
      let {
        q,
        industry,
        font,
        color,
        designStyle,
        ai = false,
        platforms = "true",
        page = "1",
        phase = "1",
        searchMode = 'web',   // ─ explicit tab: 'ui' | 'web' | 'icon' | 'font' | 'visual'
      } = req.query;

      // Force override deprecated 'ui' mode to 'web'
      if (searchMode === 'ui') {
        searchMode = 'web';
      }

      if (!q) return res.status(400).json({ error: "Query is required" });

      // ── NATURAL LANGUAGE QUERY CLEANING ──
      // Strip conversational prefixes so "show me claude ui" → "claude ui"
      // "show me the chat interface of the claude" → "chat interface claude"
      const displayQ = q; // Keep original for the response display heading
      // Rebind q to the cleaned version — all downstream code uses q for search
      // eslint-disable-next-line no-shadow
      let qSearch = cleanNLQuery(q);
      if (qSearch !== q) {
        console.log(` NL query cleaned: "${q}" → "${qSearch}"`);
      }

      // Convert page to number and ensure it's valid
      const pageNum = parseInt(page) || 1;

      console.log(`Search request by ${req.user.email}: query="${q}", industry="${industry || 'none'}", designStyle="${designStyle || 'none'}", page=${pageNum}`);

      // Create a cache key based on search parameters
      // Note: Phase is NOT part of the cache key because phase 2 should append to the phase 1 cache!
      // Use qSearch (cleaned) as the key so "show me claude ui" and "claude ui" share the same cache.
      const cacheKey = `search:${qSearch}:${industry || ''}:${font || ''}:${color || ''}:${designStyle || ''}:${ai}:${platforms}`;

      // Handle Phase 2 Enrichment Background Request
      if (phase === "2" && pageNum === 1) {
        console.log(`Phase 2 started for: "${q}" — Running heavy scrapers...`);
        const cachedResults = cache.get(cacheKey);

        // If no cache, phase 1 might have failed or cache expired, return empty phase 2
        if (!cachedResults) {
          return res.json({ images: [], phase: "2", status: "cache_miss" });
        }

        // We only want to run heavy scrapers in Phase 2
        const websiteQuery = isWebsiteQuery(q);
        const uiScreenQuery = isUIScreenQuery(q);
        const iconQuery = isIconQuery(q);

        if (iconQuery) {
          return res.json({ images: [], phase: "2", status: "skip_icons" }); // Icons are fully loaded in Phase 1
        }

        const premiumTasks = [];
        const uiTasks = [];

        console.log(` Phase 2: Skipping Mobbin — UI results already served from Supabase in Phase 1`);
        // Wait for Phase 2 UI scrapers (Mobbin, if any)
        const allNewResults = []; // No longer scraping Lapa/Landbook in Phase 2
        let newImages = [];

        // Filter out images already found in Phase 1
        const existingImages = new Set(cachedResults.allImages.map(img => img.image));
        newImages = newImages.filter(img => !existingImages.has(img.image));

        // Format premium categories
        newImages = newImages.map(img => {
          let category = "Design Inspiration";
          if (img.source === "Lapa Ninja") category = "Lapa Ninja Inspiration";
          else if (img.source === "Land-book") category = "Land-book Inspiration";
          else if (img.source === "Mobbin" || img.source === "UI Reference") category = "UI Design Reference";
          return { ...img, category, relevanceScore: 0.9 }; // Boost curated sources
        });

        // Apply weights
        const intent = classifySearchIntent(qSearch);
        const weightedNew = newImages.map(img => {
          const weight = getSourceWeight(img.source, intent, qSearch);
          return { ...img, _weight: weight, _hybridScore: (img.relevanceScore || 0.1) * weight };
        });

        // Mutate Cache: Append Phase 2 results to Phase 1 results and re-sort
        const combined = [...cachedResults.allImages, ...weightedNew].sort((a, b) => {
          return (b._hybridScore || 0) - (a._hybridScore || 0);
        });

        cachedResults.allImages = combined;
        cache.set(cacheKey, cachedResults);

        console.log(`[Success] Phase 2 complete for "${q}": Appended ${weightedNew.length} high-quality images.`);

        return res.json({
          images: weightedNew, // Return ONLY the new images so the frontend can append them
          phase: "2",
          status: "success",
          addedCount: weightedNew.length,
          totalCount: combined.length
        });
      }

      // For page > 1 requests, we retrieve from cache and DON'T increment quota
      if (pageNum > 1) {
        // Check if we have cached results for this search query
        const cachedResults = cache.get(cacheKey);
        if (cachedResults) {
          console.log(" Using cached results for pagination");

          // Calculate pagination for client-side
          const resultsPerPage = 20;
          const startIndex = (pageNum - 1) * resultsPerPage;
          const endIndex = startIndex + resultsPerPage;

          // Return the sliced results for the requested page
          return res.json({
            images: cachedResults.allImages.slice(startIndex, endIndex),
            aiSuggestions: null, // Don't resend AI suggestions for subsequent pages
            colorPalette: null,
            heading: null,
            query: cachedResults.query,
            pagination: {
              currentPage: pageNum,
              hasMore: endIndex < cachedResults.allImages.length,
              totalPages: Math.ceil(cachedResults.allImages.length / resultsPerPage)
            },
            stats: cachedResults.stats,
            quota: req.user.getQuotaInfo() // Add quota info
          });
        } else {
          // If no cache exists, redirect to page 1 to rebuild cache
          console.log("[Warning] Cache miss for page > 1, will fetch new results");
          // Continue with fetching as if it's page 1
        }
      }

      // Only increment the user's search count for page 1 (initial search)
      if (pageNum === 1) {
        await req.user.incrementSearchCount();
      }

      // ── HYBRID INTENT DETECTION (Keyword + LLM) ──
      // Use qSearch (cleaned query) for all intent + search logic
      const intentResult = await extractSearchIntent(qSearch);
      const intent = intentResult.intent;
      const searchQ = intentResult.searchQuery; // May be refined by LLM
      console.log(`Final Intent: ${intent}, Query: "${searchQ}" (original="${q}", refined=${intentResult.refined})`);

      // Get AI suggestions for first page or when cache is empty
      // Trigger AI suggestions only for design-related queries
      const aiTriggerKeywords = ['landing page', 'website', 'graphic', 'design', 'banner', 'ui', 'ux', 'web', 'app', 'logo', 'flyer', 'poster', 'card', 'brochure', 'template'];
      const shouldTriggerAI = aiTriggerKeywords.some(keyword => q.toLowerCase().includes(keyword)) || intentResult.refined;

      // PERFORMANCE: Start AI suggestions in parallel (don't block image search)
      // Skip AI suggestions entirely for UI/website queries — users want images, not text advice
      let aiSuggestionsPromise = null;
      const uiScreenQueryEarly = intentResult.isUIScreen || isUIScreenQuery(q);
      const websiteQueryEarly = intentResult.isWebsite || isWebsiteQuery(q);

      if (shouldTriggerAI && !uiScreenQueryEarly && !websiteQueryEarly) {
        console.log(`AI Triggered (non-blocking) for query: "${q}"`);
        aiSuggestionsPromise = getDesignSuggestions(q, industry, font, color, designStyle).catch(err => {
          console.error('[Warning] AI suggestions failed:', err.message);
          return null;
        });
      } else if (uiScreenQueryEarly || websiteQueryEarly) {
        console.log(` Skipping AI suggestions for UI/website query: "${q}" (images only)`);
      }

      // Generate more specific search queries that include all parameters
      // Use the refined query (searchQ) for better results
      const enhancedQuery = [
        searchQ,
        industry,
        font,
        designStyle,
        'design inspiration'
      ].filter(Boolean).join(' ');

      const colorQuery = [
        searchQ,
        industry,
        color || '',
        designStyle,
        'design'
      ].filter(Boolean).join(' ');

      // Create more specific Freepik queries
      const mainFreepikQuery = [searchQ, industry, designStyle, font].filter(Boolean).join(' ');
      const colorFreepikQuery = [searchQ, industry, color || ''].filter(Boolean).join(' ');
      const initialBatchSize = 20;

      // ── DIRECT ROUTING BY searchMode (user-selected tab) ──────────────────
      // No more intent guessing — the tab tells us exactly what to fetch.
      // If searchMode is absent (e.g. old clients), fall back to detection.
      const uiScreenQuery = searchMode === 'ui';
      const websiteQuery = searchMode === 'web';
      const iconQuery = searchMode === 'icon';
      const fontModeQuery = searchMode === 'font';
      const visualQuery = searchMode === 'visual';
      // ─────────────────────────────────────────────
      console.log(`searchMode="${searchMode}" → ui=${uiScreenQuery} web=${websiteQuery} icon=${iconQuery}`);

      // Initialize sources with Freepik and Pinterest which have higher limits
      // and don't cost as much as Google Custom Search
      const sourcesToFetch = [];
      const premiumWebsiteSources = []; // Lapa + Landbook fetched separately for priority
      let iconSearchPromise = null; // Icons fetched separately for icon-grid display
      let googleApiFailed = false;

      // If icon-related query, fetch icons in parallel
      if (iconQuery) {
        console.log(`Icon query detected: "${qSearch}" — fetching icons from Iconify + SVG Repo`);
        iconSearchPromise = iconService.searchIcons(qSearch.trim(), 100).catch(err => {
          console.error('[Warning] Icon search failed:', err.message);
          return [];
        });
      }

      const uiPageNum = Math.max(0, (parseInt(page) || 1) - 1); // convert 1-indexed to 0-indexed

      // ── CURATED WEBSITE SEARCH (Phase 1 TURBO vs Supabase) ──
      let websiteSupabasePromise = null;
      if (websiteQuery && !iconQuery) {
        console.log(`Website query detected: "${qSearch}" — Fetching native website matching from Supabase...`);
        websiteSupabasePromise = websiteService.searchWebsiteAssets(searchQ, intentResult, 100, uiPageNum).catch(err => {
          console.error('[Warning] Website Supabase fetch failed:', err.message);
          return [];
        });
      }

      const SOURCE_TIMEOUT = 6000; // Max 6 seconds per source
      // ── SOURCE ROUTING BY searchMode ──────────────────────────────────────
      if (websiteQuery) {
        // Tab: "Web Inspo" → Semantic + keyword from websiteSupabasePromise (already launched).
        // Scrapers also run in parallel:
        //   page 0 (first load): 3s timeout → scrapers are a quick bonus, semantic is the star
        //   page 1+ (show more): full SOURCE_TIMEOUT → semantic runs with offset, scrapers fill the rest
        const webScraperTimeout = (isWebSemanticReady() && uiPageNum === 0) ? 3000 : SOURCE_TIMEOUT;
        console.log(`Web Inspo: page=${uiPageNum} → scrapers timeout=${webScraperTimeout}ms for "${qSearch}"`);

        sourcesToFetch.push(
          Promise.race([
            pinterestScraper.scrapePinterestImages(`${qSearch} website design`, 20).catch(err => {
              console.error('[Warning] Pinterest website fallback failed:', err.message);
              return [];
            }),
            new Promise(resolve => setTimeout(() => resolve([]), webScraperTimeout))
          ])
        );
        if (googleAPIManager.hasAvailableKeys()) {
          sourcesToFetch.push(
            Promise.race([
              fetchGoogleImages(`${qSearch} landing page website design`, 15, 0).catch(err => {
                console.error('[Warning] Google website fallback failed:', err.message);
                googleApiFailed = true;
                return [];
              }),
              new Promise(resolve => setTimeout(() => resolve([]), webScraperTimeout))
            ])
          );
        }

      } else if (iconQuery) {
        // Tab: "Icons" → already handled via iconSearchPromise above
        console.log(`◈ Icons: fetching from Iconify + SVG Repo for "${qSearch}"`);

      } else if (fontModeQuery) {
        // Tab: "Typefaces" → Google Fonts API + Pinterest font inspiration
        console.log(`Aa Typefaces: fetching fonts for "${qSearch}"`);

        // Google Fonts API (no key needed for public list)
        // We filter by category and search term
        const googleFontsUrl = `https://www.googleapis.com/webfonts/v1/webfonts?key=AIzaSyDummy&sort=popularity`;

        // Pinterest font inspiration images
        sourcesToFetch.push(
          pinterestScraper.scrapePinterestImages(`${qSearch} typography font typeface`, 30).catch(err => {
            console.error('[Warning] Pinterest font search failed:', err.message);
            return [];
          })
        );

        // Also search Freepik for font showcase images
        sourcesToFetch.push(
          fetchFreepikImages(`${qSearch} typography font design`, 15, '', 0, appSecretKeyId).catch(err => {
            console.error('[Warning] Freepik font search failed:', err.message);
            return [];
          })
        );

        // Google Images for font specimens
        if (googleAPIManager.hasAvailableKeys()) {
          sourcesToFetch.push(
            fetchGoogleImages(`${qSearch} typeface specimen font design`, 15, 0).catch(err => {
              console.error('[Warning] Google font search failed:', err.message);
              googleApiFailed = true;
              return [];
            })
          );
        }

      } else {
        // Fallback for old clients without searchMode param
        console.log(` No searchMode — fallback: Supabase design_assets for "${qSearch}"`);
        sourcesToFetch.push(
          assetService.searchUIAssets(qSearch.trim(), 100, 0).catch(err => {
            console.error('[Warning] Supabase fallback search failed:', err.message);
            return [];
          })
        );
      }
      // ────────────────────────────────────────────────────────────────────


      // Execute all fetch operations in parallel with per-source timeout
      const withTimeout = (promise, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${SOURCE_TIMEOUT / 1000}s`)), SOURCE_TIMEOUT))
      ]);
      const timedSources = sourcesToFetch.map((p, i) => withTimeout(p, `Source ${i}`));
      const allResults = await Promise.allSettled(timedSources);

      // Process results, handling any failed promises
      const resultsArray = allResults.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`[Warning] Source ${index} failed:`, result.reason);
          return []; // Return empty array for failed fetches
        }
      });

      // Flatten the array of arrays
      const flattenedResults = resultsArray.flat();

      // Normalize and remove duplicates
      const seenUrls = new Set();
      let allImages = flattenedResults
        .map(r => (r && r.image && typeof r.image === 'object') ? r.image : r) // Normalize to inner object structure
        .filter(img => {
          if (!img || !img.image || seenUrls.has(img.image)) return false;
          seenUrls.add(img.image);
          return true;
        });

      // ── RELEVANCE FILTER ──
      // Visual Inspo and Typefaces bypass text-based relevance scoring —
      // their results are curated external sources, not text-described assets.
      const preFilterCount = allImages.length;
      const skipRelevanceFilter = visualQuery || fontModeQuery;

      if (skipRelevanceFilter) {
        // Assign a strictly descending relevance score to preserve exact fetch order
        allImages = allImages.map((img, idx) => ({
          ...img,
          relevanceScore: img.relevanceScore || (0.99 - (idx * 0.0001))
        }));
        console.log(`⏭ Relevance filter SKIPPED for ${searchMode} mode (${allImages.length} images kept)`);
      } else {
        const baseThreshold = 0.05;
        allImages = filterByRelevance(allImages, q, {
          threshold: baseThreshold,
          minResults: 20,
          sort: true,
          verbose: true,
          intent: intent
        });
        console.log(`Relevance filter: ${preFilterCount} → ${allImages.length} images (threshold=${baseThreshold})`);
      }

      // Resolve premium website sources (Lapa + Landbook) if any
      let premiumResults = [];
      if (premiumWebsiteSources.length > 0) {
        const premiumSettled = await Promise.allSettled(premiumWebsiteSources);
        premiumResults = premiumSettled
          .filter(r => r.status === 'fulfilled')
          .flatMap(r => r.value || []);

        // Format: these come as { image: {...}, similarity, reasons } from scraper
        // Normalize to the flat image format used by allImages
        premiumResults = premiumResults.map(r => r.image || r).filter(img => {
          if (!img || !img.image || seenUrls.has(img.image)) return false;
          seenUrls.add(img.image);
          return true;
        });

        const prePremiumCount = premiumResults.length;
        // [Success] Skip relevance filter for Lapa Ninja & Land-book — they are curated
        // premium sources where every result IS a landing page by definition.
        // Their titles are company names (e.g. "Linear", "Stripe") not descriptions,
        // so text-based relevance will always drop them incorrectly.
        premiumResults = premiumResults.map(img => ({
          ...img,
          relevanceScore: 0.9 // Guaranteed high score so 2000x weight kicks in
        }));

        console.log(`Premium website sources (no filter): ${prePremiumCount} → ${premiumResults.length} (Lapa + Land-book)`);
      }

      // Add categories based on source
      const addCategory = (img) => {
        let category = "Design Inspiration";

        if (img.source === "Freepik") {
          if (img.format === "vector") category = "Downloadable Vector Resources";
          else if (img.format === "psd") category = "Downloadable PSD Templates";
          else category = "Downloadable Design Resources";
        } else if (img.source === "Freepik AI") {
          category = "AI Generated Designs";
        } else if (img.source === "Pinterest") {
          category = "Pinterest Inspiration";
        } else if (img.source === "Google Images") {
          category = "Design Inspiration";
        } else if (img.source === "Lapa Ninja") {
          category = "Lapa Ninja Inspiration";
        } else if (img.source === "Land-book") {
          category = "Land-book Inspiration";
        } else if (img.source === "Mobbin" || img.source === "UI Reference") {
          category = "UI Design Reference";
        }

        return { ...img, category };
      };

      // ── RESOLVE WEBSITE SUPABASE RESULTS (90/10 Dynamic Split) ──
      let websiteResults = [];
      if (websiteSupabasePromise) {
        try {
          websiteResults = await websiteSupabasePromise;
          console.log(`Website Supabase results: ${websiteResults.length} native records (Lapa + Landbook)`);
        } catch (error) {
          console.error('[Warning] Website Supabase resolution failed:', error.message);
        }
      }

      // ── APPLY 90/10 DYNAMIC SPLIT FOR WEBSITE QUERIES ──
      // If this is a website query, enforce the ratio:
      //   curated >= 40 → 90 curated, 10 external (strict 90/10)
      //   curated < 40  → all curated + fill remaining from external (dynamic fallback)
      let externalImages = [...allImages]; // Pinterest, Google (no Freepik for website queries)
      if (websiteQuery && websiteResults.length > 0) {
        const curatedCount = websiteResults.length;
        const TOTAL_TARGET = 100;
        const CURATED_THRESHOLD = 40;

        if (curatedCount >= CURATED_THRESHOLD) {
          // Strict 90/10 — plenty of curated content
          const curatedSlots = Math.min(curatedCount, 90);
          const externalSlots = TOTAL_TARGET - curatedSlots;
          websiteResults = websiteResults.slice(0, curatedSlots);
          externalImages = externalImages.slice(0, externalSlots);
          console.log(`[Success] Website 90/10: ${curatedSlots} curated + ${Math.min(externalImages.length, externalSlots)} external`);
        } else {
          // Dynamic fallback — not enough curated, fill with external
          const externalSlots = TOTAL_TARGET - curatedCount;
          externalImages = externalImages.slice(0, externalSlots);
          console.log(`[Warning] Website dynamic fallback: ${curatedCount} curated + ${Math.min(externalImages.length, externalSlots)} external (filling gap)`);
        }
      } else if (websiteQuery && websiteResults.length === 0) {
        console.log(`[Warning] No curated website results — 100% from Pinterest/Google`);
        // externalImages stays as-is (no cap)
      }

      // Consolidate non-website curated results if any
      let curatedResults = [];

      let allFoundImages = [
        ...websiteResults.map(r => r.image || r).map(addCategory),
        ...curatedResults.map(addCategory),
        ...premiumResults.map(addCategory),
        ...(websiteQuery ? externalImages : allImages).map(addCategory)
      ];

      // Remove any theoretical duplicates formed during merging
      const finalSeen = new Set();
      let categorizedImages = allFoundImages.filter(img => {
        if (!img || !img.image || finalSeen.has(img.image)) return false;
        finalSeen.add(img.image);
        return true;
      });

      // ── APPLY HYBRID RANKING (Score × Weight) ──
      const weightedResults = categorizedImages.map(img => {
        // Boost natively fetched items
        if (websiteQuery && ['Lapa Ninja', 'Land-book'].includes(img.source)) {
          img.relevanceScore = 0.95;
        }
        const weight = getSourceWeight(img.source, intent, q);
        // Hybrid score = Relevance (0.0 - 1.0) * Source Weight (0.5 - 1.3)
        const hybridScore = (img.relevanceScore || 0.1) * weight;
        return { ...img, _weight: weight, _hybridScore: hybridScore };
      });

      // Final sort: hybrid score descending
      categorizedImages = weightedResults.sort((a, b) => {
        return (b._hybridScore || 0) - (a._hybridScore || 0);
      });

      console.log(` Applied hybrid ranking (${intent}): ${categorizedImages.length} results`);

      // ── ENFORCE 90/10 RATIO FOR WEBSITE QUERIES ──
      let firstPageResults = [];
      const resultsPerPage = 20;

      if (websiteQuery && categorizedImages.length > 0) {
        const targetDbCount = Math.floor(resultsPerPage * 0.90); // e.g. 18
        const targetOtherCount = resultsPerPage - targetDbCount; // e.g. 2

        const dbMatches = categorizedImages.filter(img => ['Lapa Ninja', 'Land-book'].includes(img.source));
        const otherMatches = categorizedImages.filter(img => !['Lapa Ninja', 'Land-book'].includes(img.source));

        console.log(` Ratio enforce: Found ${dbMatches.length} DB, ${otherMatches.length} Other`);

        const dbFinalCount = Math.min(dbMatches.length, targetDbCount);
        const otherFinalCount = Math.min(otherMatches.length, targetOtherCount + (targetDbCount - dbFinalCount)); // Backfill

        firstPageResults = [
          ...dbMatches.slice(0, dbFinalCount),
          ...otherMatches.slice(0, otherFinalCount)
        ];

        // Ensure we fetch from cache up to `resultsPerPage` if we fell short
        if (firstPageResults.length < resultsPerPage) {
          const remainder = categorizedImages.filter(img => !firstPageResults.includes(img)).slice(0, resultsPerPage - firstPageResults.length);
          firstPageResults.push(...remainder);
        }

        // Re-sort the final selection for the first page by hybrid score
        firstPageResults = firstPageResults.sort((a, b) => (b._hybridScore || 0) - (a._hybridScore || 0));

        // Let the cache know so it doesn't duplicate them
        const remainingForCache = categorizedImages.filter(img => !firstPageResults.includes(img));
        categorizedImages = [...firstPageResults, ...remainingForCache];
      } else {
        firstPageResults = categorizedImages.slice(0, resultsPerPage);
      }


      // Cache the full results for future pagination requests
      const cacheData = {
        allImages: categorizedImages,
        query: {
          original: q,
          enhanced: enhancedQuery,
          params: { industry, font, color, designStyle }
        },
        stats: {
          totalImages: categorizedImages.length,
          sources: [...new Set(categorizedImages.map(img => img.source))],
          googleAPIStatus: getGoogleAPIStats() // Add Google API stats to cache
        }
      };

      cache.set(cacheKey, cacheData);
      console.log(` Cached ${categorizedImages.length} results for query "${q}"`);

      // Background save of visual inspo has been removed

      // Log search statistics
      console.log(` Search results: Total (${categorizedImages.length}), Displayed (${firstPageResults.length})`);

      // Resolve icon results if any
      let iconResults = [];
      if (iconSearchPromise) {
        try {
          iconResults = await iconSearchPromise;
          console.log(`Icon results: ${iconResults.length} icons`);
        } catch (err) {
          console.error('[Warning] Icon search resolution failed:', err.message);
        }
      }

      // Resolve AI suggestions with TIMEOUT — never wait more than 3s
      let aiSuggestions = null;
      let colorPalette = [];
      let heading = null;
      if (aiSuggestionsPromise) {
        const AI_TIMEOUT = 3000; // Max 3 seconds wait for AI suggestions
        const timeoutPromise = new Promise(resolve => setTimeout(() => resolve('__TIMEOUT__'), AI_TIMEOUT));
        const aiResult = await Promise.race([aiSuggestionsPromise, timeoutPromise]);
        if (aiResult && aiResult !== '__TIMEOUT__') {
          aiSuggestions = aiResult;
          colorPalette = extractColorPalette(aiResult, color);
          heading = extractHeading(aiResult);
        } else if (aiResult === '__TIMEOUT__') {
          console.log(' AI suggestions timed out after 3s — sending response without them');
        }
      }
      if (!aiSuggestions && !shouldTriggerAI) {
        aiSuggestions = "AI suggestions are tailored for design-related queries like landing pages, websites, and branding.";
      }

      // ── BACKGROUND LOG: Save search query to Supabase search_logs ──
      // Fire-and-forget — never blocks the response.
      if (req.user?.email && q) {
        logSearchQuery({
          userEmail:   req.user.email,
          query:       q,
          searchMode,
          industry:    industry || null,
          designStyle: designStyle || null,
          color:       color || null,
          resultCount: categorizedImages.length,
          page:        pageNum,
        }).catch(err => console.error('[Warning] search_log background error:', err.message));
      }

      // Return first page results
      res.json({
        images: firstPageResults,
        iconResults: iconResults, // Separate array for icon-grid display
        aiSuggestions,
        colorPalette,
        heading,
        query: {
          original: q,
          enhanced: enhancedQuery,
          params: { industry, font, color, designStyle }
        },
        pagination: {
          currentPage: pageNum,
          hasMore: categorizedImages.length > resultsPerPage,
          totalPages: Math.ceil(categorizedImages.length / resultsPerPage),
          totalResults: categorizedImages.length
        },
        phase: "1",
        stats: {
          totalImages: categorizedImages.length,
          sources: [...new Set(categorizedImages.map(img => img.source))],
          googleApiFailed,
          googleAPIStatus: getGoogleAPIStats(), // Add Google API stats to response
          hasIcons: iconResults.length > 0
        },
        quota: req.user.getQuotaInfo() // Add quota info to response
      });
    } catch (error) {
      console.error("[Error] API Error:", error.message);
      res.status(500).json({ error: "Failed to fetch design resources", details: error.message });
    }
  });

  // Dedicated pagination route that doesn't check quota
  app.get("/search/paginate", authenticateUser, async (req, res) => {
    try {
      const {
        q,
        industry,
        font,
        color,
        designStyle,
        ai = false,
        platforms = "true",
        page = "2" // Default to page 2 for this route
      } = req.query;

      if (!q) return res.status(400).json({ error: "Query is required" });

      // Convert page to number and ensure it's valid
      const pageNum = parseInt(page) || 2;

      if (pageNum < 2) {
        return res.status(400).json({
          error: "This route is for pagination only (page > 1). Use /search for initial queries."
        });
      }

      console.log(`Pagination request by ${req.user.email}: query="${q}", page=${pageNum}`);

      // Create a cache key based on search parameters
      const cacheKey = `search:${q}:${industry || ''}:${font || ''}:${color || ''}:${designStyle || ''}:${ai}:${platforms}`;

      // Check if we have cached results for this search query
      const cachedResults = cache.get(cacheKey);

      if (!cachedResults) {
        return res.status(404).json({
          error: "No cached results found. Please perform an initial search first."
        });
      }

      console.log(" Using cached results for pagination");

      // Calculate pagination for client-side
      const resultsPerPage = 20;
      const startIndex = (pageNum - 1) * resultsPerPage;
      const endIndex = startIndex + resultsPerPage;

      // Return the sliced results for the requested page
      return res.json({
        images: cachedResults.allImages.slice(startIndex, endIndex),
        aiSuggestions: null, // Don't resend AI suggestions for subsequent pages
        colorPalette: null,
        heading: null,
        query: cachedResults.query,
        pagination: {
          currentPage: pageNum,
          hasMore: endIndex < cachedResults.allImages.length,
          totalPages: Math.ceil(cachedResults.allImages.length / resultsPerPage)
        },
        stats: cachedResults.stats,
        quota: req.user.getQuotaInfo() // Add quota info
      });
    } catch (error) {
      console.error("[Error] Pagination Error:", error.message);
      res.status(500).json({ error: "Failed to fetch pagination", details: error.message });
    }
  });

  // Add a new endpoint for Freepik API status
  app.get("/api/freepik/status", authenticateUser, async (req, res) => {
    try {
      // Test the Freepik API with a simple query
      const testQuery = "test design";
      const results = await fetchFreepikImages(testQuery, 1, '', 0, appSecretKeyId);

      const isWorking = Array.isArray(results) && results.length > 0;

      res.json({
        status: isWorking ? "operational" : "error",
        key: appSecretKeyId ? appSecretKeyId.substring(0, 8) + "..." : "Not configured",
        message: isWorking ? "Freepik API is working correctly" : "Freepik API returned no results",
        testResults: isWorking ? results.length : 0
      });
    } catch (error) {
      console.error("[Error] Freepik API Status Error:", error.message);
      res.status(500).json({
        status: "error",
        key: appSecretKeyId ? appSecretKeyId.substring(0, 8) + "..." : "Not configured",
        message: error.message
      });
    }
  });

  // Freepik Search for Recommendations
  app.post("/api/freepik-search-recommendations", authenticateUser, async (req, res) => {
    try {
      const { topic, limit = 20 } = req.body;
      if (!topic) return res.status(400).json({ error: "Topic is required" });

      const requestLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 40);
      console.log(`Freepik recommendation search: "${topic}" (limit: ${requestLimit})`);

      const startTime = Date.now();
      // Use existing utility - assume appSecretKeyId is available in scope or ignored
      const freepikImages = await fetchFreepikImages(topic, requestLimit, '', 0, appSecretKeyId);
      const duration = Date.now() - startTime;

      // Format to match recommendation engine structure
      const formattedResults = freepikImages.map((img, index) => ({
        image: {
          image: img.image,
          title: img.title,
          source: 'Freepik',
          url: img.url,
          _internalId: `freepik-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${index}`,
          width: 800, // Placeholder
          height: 600
        },
        similarity: 0.85 - (index * 0.01),
        reasons: ['Freepik Resource', 'Professional Asset', 'vector/psd']
      }));

      console.log(`[Success] Freepik recommendations found: ${formattedResults.length} in ${duration}ms`);

      res.json({
        success: true,
        count: formattedResults.length,
        results: formattedResults
      });

    } catch (error) {
      console.error("[Error] Freepik recommendation search error:", error.message);
      res.status(500).json({ error: "Failed to fetch Freepik recommendations", details: error.message });
    }
  });

  // Add a new endpoint to directly generate AI images with Freepik
  app.post("/api/freepik/generate-ai", authenticateUser, checkSearchQuota, async (req, res) => {
    try {
      const { prompt, aspectRatio = 'square_1_1' } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      // Increment the search quota
      await req.user.incrementSearchCount();

      // Generate AI image using the secret key
      const results = await fetchFreepikAIImage(prompt, aspectRatio, appSecretKeyId);

      if (!results || results.length === 0) {
        return res.status(404).json({
          error: "No images generated",
          message: "The AI image generation did not return any results"
        });
      }

      res.json({
        images: results,
        quota: req.user.getQuotaInfo()
      });
    } catch (error) {
      console.error("[Error] Freepik AI Generation Error:", error.message);
      res.status(500).json({
        error: "Failed to generate AI images",
        message: error.message
      });
    }
  });

  // Validate uploaded image route (with authentication)
  app.post('/validate-image', authenticateUser, async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: 'URL is required' });
      }

      const isValid = await validateImage(url);
      res.json({ valid: isValid });
    } catch (error) {
      console.error('Error validating image:', error);
      res.status(500).json({
        error: 'Failed to validate image',
        details: error.message
      });
    }
  });

  // Endpoint to upload and store brand guidelines (with authentication)
  app.post('/upload-brand-guidelines', authenticateUser, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const filePath = req.file.path;
      const result = await processBrandGuidelines(filePath, genAI);

      res.json({
        success: true,
        message: 'Brand guidelines analyzed and stored',
        imageUrl: `/uploads/${path.basename(filePath)}`,
        analysis: result.analysis
      });
    } catch (error) {
      console.error('Error processing brand guidelines:', error);
      res.status(500).json({
        error: 'Failed to process brand guidelines',
        details: error.message
      });
    }
  });

  // Check if brand guidelines exist (with authentication)
  app.get('/brand-guidelines-status', authenticateUser, (req, res) => {
    const status = getBrandGuidelinesStatus();
    res.json({
      isSet: status.isSet,
      imageUrl: status.imageUrl ? `/uploads/${path.basename(status.imageUrl)}` : null
    });
  });

  // Analyze endpoint to compare with brand guidelines (with authentication)
  app.post('/analyze', authenticateUser, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const user = req.user;
      if (!user.hasFeatureAccess('designAudits')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'You have reached your limit for Design Audits on your current plan.',
          quota: user.getUsageStats()
        });
      }

      const filePath = req.file.path;
      const auditMode = req.body.auditMode;
      const designContext = req.body.designContext || '';
      const result = await analyzeDesign(filePath, genAI, { auditMode, designContext });

      // Deduct quota
      await UserService.incrementUsage(user.id, 'designAudits', user);

      // Return ALL fields from the analysis result
      res.json({
        ...result, // Spread all fields (overallScore, hierarchyScore, uxScore, mistakes, etc.)
        imageUrl: `/uploads/${path.basename(filePath)}`,
        comparedToBrandGuidelines: result.comparedToBrandGuidelines
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      res.status(500).json({
        error: 'Failed to analyze image',
        details: error.message
      });
    }
  });

  // Basic image analysis without brand comparison (with authentication)
  app.post('/analyze-basic', authenticateUser, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
      }

      const user = req.user;
      if (!user.hasFeatureAccess('designAudits')) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: 'You have reached your limit for Design Audits on your current plan.',
          quota: user.getUsageStats()
        });
      }

      const filePath = req.file.path;
      const result = await analyzeImage(filePath, genAI);

      // Deduct quota
      await UserService.incrementUsage(user.id, 'designAudits', user);

      res.json({
        analysis: result.analysis,
        imageUrl: `/uploads/${path.basename(filePath)}`
      });
    } catch (error) {
      console.error('Error analyzing image:', error);
      res.status(500).json({
        error: 'Failed to analyze image',
        details: error.message
      });
    }
  });

  // Clear brand guidelines from memory (with authentication)
  app.post('/clear-brand-guidelines', authenticateUser, (req, res) => {
    const result = clearBrandGuidelines();
    res.json(result);
  });



  // Firebase token validation endpoint (for testing)
  app.post('/validate-token', async (req, res) => {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({ error: 'Token is required' });
      }

      // Verify the token
      const decodedToken = await admin.auth().verifyIdToken(token);

      res.json({
        valid: true,
        uid: decodedToken.uid,
        email: decodedToken.email || decodedToken.firebase.identities?.email?.[0]
      });
    } catch (error) {
      console.error('[Error] Token validation error:', error);
      res.status(401).json({
        valid: false,
        error: error.message
      });
    }
  });

  // ── Extension Tracking ──
  // Accepts BOTH authenticated (user token) and anonymous (extensionId) requests
  app.post("/api/extension/track", async (req, res) => {
    try {
      const { eventType, metadata, extensionId } = req.body;
      const validEvents = ['install', 'screenshot', 'capture_figma', 'sign_in', 'uninstall'];

      if (!eventType || !validEvents.includes(eventType)) {
        return res.status(400).json({ error: `Invalid eventType. Must be one of: ${validEvents.join(', ')}` });
      }

      const ExtensionEventMod = await import('../services/userService.js');

      // Try to authenticate the user if a token is provided
      let user = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
          const token = authHeader.split('Bearer ')[1];
          const { getAuth } = await import('firebase-admin/auth');
          const decodedToken = await getAuth().verifyIdToken(token);
          user = await UserService.findByUid(decodedToken.uid);
        } catch (authErr) {
          console.log('[Extension Track] Auth failed, continuing as anonymous:', authErr.message);
        }
      }

      // Generate identifiers
      const userId = user?.uid || user?.id || extensionId || 'anonymous';
      const email = user?.email || (metadata?.email) || `ext-${extensionId || 'unknown'}`;

      // 1. Log the event
      await UserService.createExtensionEvent({
        userId, email, eventType,
        metadata: { ...(metadata || {}), extensionId, hasAuth: !!user }
      });

      // 2. Update user's extension fields (only if authenticated)
      if (user) {
        const ext = { ...(user.extension || {}), lastActiveAt: new Date().toISOString() };

        if (eventType === 'install') {
          ext.installed = true;
          if (metadata?.version) ext.version = metadata.version;
          ext.installedAt = new Date().toISOString();
        } else if (eventType === 'uninstall') {
          ext.installed = false;
        } else if (eventType === 'screenshot' || eventType === 'capture_figma') {
          ext.screenshotCount = (ext.screenshotCount || 0) + 1;
          await UserService.updateUser(user.id, { extension: ext });
          console.log(` [Extension] ${eventType} by ${user.email}`);
          return res.json({ ok: true, event: eventType, linked: true });
        }

        await UserService.updateUser(user.id, { extension: ext });
        console.log(` [Extension] ${eventType} by ${user.email}`);
        res.json({ ok: true, event: eventType, linked: true });
      } else {
        console.log(` [Extension] ${eventType} (anonymous: ${extensionId || 'no-id'})`);
        res.json({ ok: true, event: eventType, linked: false });
      }
    } catch (err) {
      console.error('[Error] Extension track error:', err.message);
      res.status(500).json({ error: 'Failed to track extension event' });
    }
  });

  // Enhanced health check that includes the Freepik API key status
  app.get("/health", async (req, res) => {
    res.status(200).json({
      status: "ok",
      message: "Design API is running",
      brandGuidelinesSet: getBrandGuidelinesStatus().isSet,
      googleApiStatus: getGoogleAPIStats(),
      freepikApiStatus: {
        isConfigured: !!appSecretKeyId,
        keyPreview: appSecretKeyId ? `${appSecretKeyId.substring(0, 8)}...` : "Not set"
      },
      // mongoDBStatus: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    });
  });
}
