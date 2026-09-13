/**
 * ═══════════════════════════════════════════════════════════════════
 * BROWSE CATEGORIES BACKFILL SCRIPT
 * 
 * Ensures every /browse/<slug> page has ≥30 design images in the DB.
 * 
 * Strategy:
 *  1. Loop through ALL browse slugs from the landing page manifest
 *  2. For each slug, query the browse API to check current count
 *  3. If count < 30, scrape Pinterest for design inspiration images
 *  4. Save scraped images to Supabase design_assets via assetService
 * 
 * Run: node backfillBrowse.mjs
 * ═══════════════════════════════════════════════════════════════════
 */

import { assetService } from '../src/services/assetService.js';
const pinterestScraper = { scrapePinterestImages: async () => [] };
import { supabase } from '../src/config/supabaseClient.js';
import dotenv from 'dotenv';
dotenv.config();

// ── All browse slugs from siteManifest.js ──────────────────────────
const BROWSE_SLUGS = [
  // Page Types
  "login","sign-up","dashboard","onboarding","pricing","profile","settings",
  "home-screen","search","checkout","cart","chat","feed","explore",
  "forgot-password","verification","product-details","404-page","about-page","contact-page",
  // UX Patterns
  "dark-mode","navigation","notifications","payment","calendar","social-feed",
  "empty-state","reviews-rating","filter-sorting","booking","map-view","video-player",
  "upload","loading-states","form-design","modal-dialog","tabs-interface","sidebar-drawer",
  "progress-indicator","tooltip","pagination","cards-tiles","gallery","animation",
  "gesture-interaction","micro-interaction","voice-ui","ar-interface","gamification","accessibility",
  // Popular Brands
  "airbnb","uber","spotify","netflix","instagram","tiktok","twitter","linkedin",
  "whatsapp","telegram","discord","slack","notion","figma","github","stripe",
  "shopify","duolingo","headspace","calm","revolut","wise","coinbase","robinhood",
  "medium","pinterest","youtube","twitch","reddit","snapchat","zoom","teams",
  "google-maps","apple-music","uber-eats","doordash","amazon","ebay","etsy",
  "nike","adidas","zara","asos","sephora","peloton","strava","myfitnesspal",
  "fitbit","flo","hinge","bumble","tinder","venmo","cashapp","paypal",
  "square","klarna","afterpay","binance","metamask","opensea","canva","miro",
  "adobe","sketch","invision","framer","webflow","wix","squarespace","mailchimp",
  "hubspot","salesforce","zendesk","intercom","asana","monday","trello","jira",
  "clickup","todoist","evernote","obsidian","bear","coda","airtable","vercel",
  "supabase","linear","arc-browser","loom","producthunt","substack","wordpress",
  "coursera","udemy","skillshare","masterclass","khan-academy","zerodha","practo",
  "byju","meesho","blinkit","dream11","dribbble","behance","raycast","superhuman",
  // Style
  "minimalist-design","brutalist-design","glassmorphism","neumorphism","flat-design",
  "material-design","gradient-design","monochrome","pastel-colors","bold-typography",
  "illustration-style","3d-design","isometric","retro-vintage","futuristic",
  "organic-shapes","geometric-patterns","duotone","split-screen","full-screen-hero",
  "card-based-layout","grid-layout","asymmetric-layout","bottom-sheet",
  "floating-action-button","sticky-header","tab-bar","skeleton-loading",
  "shimmer-effect","parallax-scroll","masonry-grid","hero-section",
  "testimonial-section","pricing-table","footer-design","header-design",
  "button-styles","input-field-design","toggle-switch","dropdown-menu",
  "search-bar-design","progress-bar","timeline-design","splash-screen",
  "walkthrough","error-state","success-state","confirmation-dialog",
  // Platform
  "ios-app","android-app","web-app","ipad-app","macos-app","windows-app",
  "watchos-app","tv-app","chrome-extension","mobile-responsive","tablet-design",
  "desktop-design","pwa","responsive-web","saas-dashboard","admin-panel",
  "analytics-dashboard","ecommerce-website","landing-page","portfolio-website",
  "agency-website","startup-website","blog-layout","news-website",
  "documentation-site","knowledge-base","changelog-page","status-page",
  // Industry
  "fintech","healthcare","edtech","ecommerce","social-media","travel",
  "food-delivery","fitness","music","video-streaming","gaming","news-media",
  "real-estate","automotive","fashion","beauty","grocery","pharmacy",
  "insurance","banking","investment","crypto","nft","web3","saas","devtools",
  "productivity","communication","collaboration","project-management","crm",
  "marketing-tools","analytics","ai-tools","design-tools","writing-tools",
  "note-taking","task-management","calendar-apps","email-apps","weather-apps",
  "maps-navigation","ride-sharing","hotel-booking","flight-booking","restaurant",
  "recipe","meditation","yoga","running","cycling","workout","sleep-tracker",
  "habit-tracker","budget-tracker","expense-tracker","invoice","hr-management",
  "learning-management","language-learning","dating","social-networking",
  "event-planning","podcast","photo-editor","video-editor","password-manager",
  "chatbot","customer-support","feedback","survey","review-platform",
  // Combinations
  "dark-mode-login","ios-onboarding","web-dashboard","dark-mode-dashboard",
  "ios-chat","android-login","web-pricing","mobile-checkout","dark-mode-profile",
  "ios-settings","fintech-dashboard","healthcare-app","edtech-onboarding",
  "ecommerce-checkout","social-media-feed","travel-booking","food-delivery-app",
  "fitness-tracker","music-player-ui","video-streaming-app","gaming-ui",
  "news-app-design","real-estate-app","fashion-ecommerce","beauty-app",
  "grocery-app","banking-app","investment-app","crypto-app","saas-pricing",
  "productivity-app","collaboration-tool","project-management-ui",
  "marketing-dashboard","analytics-interface","ai-chat-interface",
  "note-taking-app","calendar-app-ui","email-app-design","weather-app-ui",
  "ride-sharing-app","hotel-booking-ui","restaurant-app","meditation-app",
  "workout-app","budget-app-design","hr-dashboard","learning-app",
  "dating-app-ui","event-app","podcast-app","photo-editor-ui",
  "ios-navigation","android-onboarding","web-login","minimal-dashboard",
  "gradient-login","glassmorphism-card","flat-design-app","material-design-app",
  "futuristic-ui","monochrome-app","pastel-app-design","bold-typography-web",
  "illustration-landing","3d-landing-page","split-screen-login",
  "full-screen-hero-web","card-based-dashboard","minimal-portfolio",
  "agency-landing","startup-landing","blog-design",
];

// ── Convert slug to search query ──────────────────────────────────
function slugToQuery(slug) {
  return slug.replace(/-/g, ' ');
}

// Build optimized Pinterest query per slug type
function buildPinterestQuery(slug) {
  const q = slugToQuery(slug);
  
  // Brand slugs → search for app screenshots
  const BRAND_SLUGS = new Set([
    'airbnb','uber','spotify','netflix','instagram','tiktok','twitter','linkedin',
    'whatsapp','telegram','discord','slack','notion','figma','github','stripe',
    'shopify','duolingo','headspace','calm','revolut','wise','coinbase','robinhood',
    'medium','pinterest','youtube','twitch','reddit','snapchat','zoom','teams',
    'doordash','amazon','ebay','etsy','nike','adidas','zara','asos','sephora',
    'peloton','strava','myfitnesspal','fitbit','flo','hinge','bumble','tinder',
    'venmo','cashapp','paypal','square','klarna','afterpay','binance','metamask',
    'opensea','canva','miro','adobe','sketch','invision','framer','webflow','wix',
    'squarespace','mailchimp','hubspot','salesforce','zendesk','intercom','asana',
    'monday','trello','jira','clickup','todoist','evernote','obsidian','bear','coda',
    'airtable','vercel','supabase','linear','loom','producthunt','substack','wordpress',
    'coursera','udemy','skillshare','masterclass','zerodha','practo','byju','meesho',
    'blinkit','dream11','dribbble','behance','raycast','superhuman',
  ]);

  const coreBrand = slug.replace(/-/g, '');
  if (BRAND_SLUGS.has(slug) || BRAND_SLUGS.has(coreBrand)) {
    return `${q} app UI design screenshot`;
  }

  // UI pattern / page type → search for design inspiration
  if (slug.includes('login') || slug.includes('sign-up') || slug.includes('onboarding') ||
      slug.includes('checkout') || slug.includes('dashboard') || slug.includes('profile') ||
      slug.includes('settings') || slug.includes('pricing') || slug.includes('chat') ||
      slug.includes('feed') || slug.includes('search') || slug.includes('cart') ||
      slug.includes('verification') || slug.includes('404') || slug.includes('about') ||
      slug.includes('contact')) {
    return `${q} UI design inspiration mobile web`;
  }

  // Style slugs → design inspiration
  if (slug.includes('design') || slug.includes('glassmorphism') || slug.includes('neumorphism') ||
      slug.includes('gradient') || slug.includes('monochrome') || slug.includes('pastel') ||
      slug.includes('brutalist') || slug.includes('futuristic') || slug.includes('isometric') ||
      slug.includes('retro') || slug.includes('3d') || slug.includes('illustration')) {
    return `${q} app design inspiration`;
  }

  // Default: generic design search
  return `${q} app UI design`;
}

// ── Count existing results for a query ────────────────────────────
async function countExistingResults(query) {
  if (!supabase) return 0;
  try {
    // Use a lightweight count — FTS + brand check
    const { count, error } = await supabase
      .from('design_assets')
      .select('id', { count: 'exact', head: true })
      .textSearch('title_query_tags', query);
    
    if (error || count === null) {
      // Try ilike fallback
      const { count: c2 } = await supabase
        .from('design_assets')
        .select('id', { count: 'exact', head: true })
        .or(`title.ilike.%${query}%,query.ilike.%${query}%,site_name.ilike.%${query}%`);
      return c2 || 0;
    }
    return count;
  } catch (e) {
    return 0;
  }
}

// ── Main backfill function ────────────────────────────────────────
async function backfill() {
  const TARGET = 30;
  const BATCH_DELAY_MS = 3000; // 3s between scrapes to avoid rate limits
  
  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  BROWSE BACKFILL: Ensuring ≥${TARGET} images per category`);
  console.log(`  Total categories: ${BROWSE_SLUGS.length}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  const stats = { checked: 0, alreadyOk: 0, backfilled: 0, failed: 0, totalAdded: 0 };

  for (const slug of BROWSE_SLUGS) {
    stats.checked++;
    const query = slugToQuery(slug);
    
    // Check existing count
    const existing = await countExistingResults(query);
    
    if (existing >= TARGET) {
      console.log(`[Success] [${stats.checked}/${BROWSE_SLUGS.length}] "${slug}" → ${existing} results (OK)`);
      stats.alreadyOk++;
      continue;
    }

    const needed = TARGET - existing;
    console.log(`\n[${stats.checked}/${BROWSE_SLUGS.length}] "${slug}" → ${existing} results, need ${needed} more`);

    try {
      const pinterestQuery = buildPinterestQuery(slug);
      console.log(`   Pinterest query: "${pinterestQuery}"`);
      
      // Scrape from Pinterest
      const scraped = await pinterestScraper.scrapePinterestImages(pinterestQuery, Math.min(needed + 10, 40));
      
      if (!scraped || scraped.length === 0) {
        console.log(`   [Warning] No images scraped for "${slug}"`);
        stats.failed++;
        continue;
      }

      console.log(`    Scraped ${scraped.length} images`);

      // Transform scraped results for saving
      const assetsToSave = scraped.map(r => ({
        image: {
          image: r.image?.image || r.src,
          title: r.image?.title || `${query} design`,
          source: r.image?.source || 'Pinterest',
          url: r.image?.url || '',
          width: r.image?.width || 736,
          height: r.image?.height || 736,
        }
      }));

      // Save to DB
      const result = await assetService.saveAssets(assetsToSave, query);
      
      if (result.success) {
        console.log(`    Saved ${result.saved || assetsToSave.length} images for "${slug}"`);
        stats.backfilled++;
        stats.totalAdded += (result.saved || assetsToSave.length);
      } else {
        console.log(`   [Error] Save failed: ${result.error || 'unknown error'}`);
        stats.failed++;
      }

    } catch (err) {
      console.error(`   [Error] Failed for "${slug}": ${err.message}`);
      stats.failed++;
    }

    // Rate limit delay
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(`\n═══════════════════════════════════════════════════════`);
  console.log(`  BACKFILL COMPLETE`);
  console.log(`  Checked: ${stats.checked}`);
  console.log(`  Already OK (≥${TARGET}): ${stats.alreadyOk}`);
  console.log(`  Backfilled: ${stats.backfilled}`);
  console.log(`  Failed: ${stats.failed}`);
  console.log(`  Total images added: ${stats.totalAdded}`);
  console.log(`═══════════════════════════════════════════════════════\n`);

  // Close browser
  await pinterestScraper.closeBrowser();
  process.exit(0);
}

backfill().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
