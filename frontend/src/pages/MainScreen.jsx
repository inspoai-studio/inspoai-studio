import React, { useEffect, useState, useCallback, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import '../styles/MainScreen.css';
import Sidebar, { NavigationEvents } from '../components/Layout/Sidebar';
import TopNotchBar from '../components/Layout/TopNotchBar';
import ResultsGrid from '../components/Search/ResultsGrid';
import MoodboardPreviewPage from '../components/Moodboard/MoodboardPreview';
import MoodboardLibrary from '../components/Moodboard/MoodboardLibrary';
import AIAudit from "../components/Audit/AIAudit";
import SearchBar from '../components/Search/SearchBar';
import { auth } from '../firebase';
import "../styles/SkeletonLoading.css"
import SearchHistory from '../components/History/SearchHistory';
import HistoryService from '../services/HistoryService';

import CreatorStudio from '../components/CreatorStudio/CreatorStudio';
import BrandScanner from '../components/Scanner/BrandScanner';
import BottomNav from '../components/Layout/BottomNav';
import MobileProfile from '../components/User/MobileProfile';
import PricingModal from '../components/PricingModal';
import TrialBanner from '../components/TrialBanner';

import DeveloperPortal from '../components/User/DeveloperPortal';
import McpPortal from '../components/User/McpPortal';
import CurationCanvas from '../components/Search/CurationCanvas';
import { toast } from 'sonner';
import AgenticUI from '../components/AgenticUI/AgenticUI';
import AgenticUITest from '../components/AgenticUI/AgenticUITest';
import '../styles/AgenticUI.css';
import '../styles/AgenticUITest.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const DESIGN_KEYWORDS = [
  'landing page',
  'web design',
  'ui design',
  'ux design',
  'responsive design',
  'conversion-focused',
  'minimal design',
  'modern web design',
  'single-page website',
  'hero section',
  'saas landing',
  'saas website',
  'ecommerce design',
  'portfolio design',
  'blog design',
  'corporate website',
  'agency website',
  'mobile design',
  'app design',
  'dashboard design',
  'dark mode',
  'light mode',
  'website layout',
  'homepage design',
  'website template',
  'product page',
  'pricing page',
  'contact page',
  'about page',
  'checkout page',
  'blog layout',
  'wireframe',
];

// Improved detection function - checks for both exact and partial matches
const containsDesignKeyword = (query) => {
  if (!query) return false;

  const lowercaseQuery = query.toLowerCase();

  // Check for exact matches first
  const exactMatch = DESIGN_KEYWORDS.some(keyword =>
    lowercaseQuery.includes(keyword.toLowerCase())
  );

  if (exactMatch) return true;

  // Check for partial matches with word boundaries
  const words = lowercaseQuery.split(' ');

  // Check if any pair of consecutive words in the query forms part of a design keyword
  for (let i = 0; i < words.length - 1; i++) {
    const wordPair = `${words[i]} ${words[i + 1]}`;

    const partialMatch = DESIGN_KEYWORDS.some(keyword =>
      keyword.toLowerCase().includes(wordPair)
    );

    if (partialMatch) return true;
  }

  // Check for industry-specific patterns
  const industryPatterns = [
    /\b(saas|ecommerce|portfolio|blog|corporate|agency)\b.*\b(page|design|website|template|layout)\b/i,
    /\b(page|design|website|template|layout)\b.*\b(saas|ecommerce|portfolio|blog|corporate|agency)\b/i
  ];

  return industryPatterns.some(pattern => pattern.test(lowercaseQuery));
};

const MainScreen = ({ user, quota, isPublic = false, legacyMode = false }) => {
  // Check if we have SEO data passed from the server injection
  const initialSEOData = window.SEO_DATA || null;
  // Initialize state from storage if available
  const getInitialState = (key, fallback) => {
    try {
      const stored = sessionStorage.getItem('inspo_search_state');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (key === 'searchResults') {
          // Ensure searchResults is always an array for the new logic
          if (Array.isArray(parsed[key])) return parsed[key];
          // Convert old object format to array format if needed migration
          if (parsed[key] && typeof parsed[key] === 'object') return [
            {
              id: Date.now(),
              images: parsed[key].images || [],
              heading: parsed.heading || '',
              params: parsed.searchParams || {},
              query: parsed.currentQuery || '',
              colorPalette: parsed.colorPalette || [],
              aiSuggestions: parsed.aiSuggestions || ''
            }
          ];
          return fallback;
        }
        return parsed[key] !== undefined ? parsed[key] : fallback;
      }
    } catch (e) {
      console.error('Error loading state', e);
    }
    return fallback;
  };

  const [searchResults, setSearchResults] = useState(() => getInitialState('searchResults', []));
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [searchParams, setSearchParams] = useState(() => getInitialState('searchParams', {
    industry: '',
    designStyle: '',
    font: '',
    color: '',
    platforms: 'true',
    ai: 'true',
    page: 1
  }));
  const [colorPalette, setColorPalette] = useState(() => getInitialState('colorPalette', []));
  const [isIconCustomizerOpen, setIsIconCustomizerOpen] = useState(false);
  const [heading, setHeading] = useState(() => getInitialState('heading', ''));
  const [aiSuggestions, setAiSuggestions] = useState(() => getInitialState('aiSuggestions', ''));
  const [showMoodboard, setShowMoodboard] = useState(false);
  const [showAIAudit, setShowAIAudit] = useState(false);
  const [currentView, setCurrentView] = useState('search');
  const [currentQuery, setCurrentQuery] = useState(() => getInitialState('currentQuery', ''));
  const [showAiSuggestions, setShowAiSuggestions] = useState(() => getInitialState('showAiSuggestions', false));
  const [searchHistory, setSearchHistory] = useState([]);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [userQuota, setUserQuota] = useState(quota);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showCreatorStudio, setShowCreatorStudio] = useState(false);
  const [showBrandScanner, setShowBrandScanner] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showPricing, setShowPricing] = useState(false);
  const [showDeveloper, setShowDeveloper] = useState(false);
  const [showMcp, setShowMcp] = useState(false);
  const [showSearchV2, setShowSearchV2] = useState(false);
  const [showSearchV2Test, setShowSearchV2Test] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [moodboardView, setMoodboardView] = useState('draft'); // 'draft' or 'collections'
  const [moodboardCount, setMoodboardCount] = useState(0);
  const [curationData, setCurationData] = useState(null); // Smart Curation mode data
  const [curateLoading, setCurateLoading] = useState(false); // Shows AgentLoader animation
  const location = useLocation();
  const navigate = useNavigate();
  // Legacy-aware navigate: keeps all navigation within /inspoai/v1/allfeature/* when in legacy mode
  const LEGACY_PREFIX = '/inspoai/v1/allfeature';
  const navTo = useCallback((path, options) => {
    navigate(legacyMode ? LEGACY_PREFIX + path : path, options);
  }, [navigate, legacyMode]);
  const skeletonRef = React.useRef(null);

  const hasResults = Array.isArray(searchResults) && searchResults.length > 0;

  // Auto-scroll to new content (Skeleton only) - only for subsequent searches
  useEffect(() => {
    // Only scroll if we already have results (subsequent searches)
    const hasResults = Array.isArray(searchResults) && searchResults.length > 0;
    if (loading && hasResults) {
      setTimeout(() => {
        skeletonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  }, [loading, searchResults]);

  // Persist state to session storage
  useEffect(() => {
    if (searchResults && searchResults.length > 0) {
      const stateToSave = {
        searchResults,
        searchParams, // Stores the params of the LATEST search
        currentQuery,
        colorPalette,
        heading,
        aiSuggestions,
        showAiSuggestions
      };
      sessionStorage.setItem('inspo_search_state', JSON.stringify(stateToSave));
    }
  }, [searchResults, searchParams, currentQuery, colorPalette, heading, aiSuggestions, showAiSuggestions]);

  // Handle Moodboard updates for Badge Count
  const handleMoodboardUpdate = useCallback((event) => {
    if (event.detail && typeof event.detail.count === 'number') {
      setMoodboardCount(event.detail.count);
    } else {
      const savedImages = localStorage.getItem('moodboardImages');
      if (savedImages) {
        try {
          const images = JSON.parse(savedImages);
          setMoodboardCount(images.length);
        } catch (e) { }
      }
    }
  }, []);

  // Initial load and event listener for moodboard updates
  useEffect(() => {
    window.addEventListener('moodboardUpdate', handleMoodboardUpdate);

    // Initial count load
    const savedImages = localStorage.getItem('moodboardImages');
    if (savedImages) {
      try {
        const images = JSON.parse(savedImages);
        setMoodboardCount(Array.isArray(images) ? images.length : 0);
      } catch (e) { }
    }

    return () => window.removeEventListener('moodboardUpdate', handleMoodboardUpdate);
  }, [handleMoodboardUpdate]);

  // Handle initial view routing based on URL path
  useEffect(() => {
    const path = location.pathname;
    // Strip legacy prefix so all startsWith() checks work identically in both modes
    const effectivePath = legacyMode
      ? (path.replace(LEGACY_PREFIX, '') || '/')
      : path;

    const resetViews = () => {
      setShowMoodboard(false);
      setShowAIAudit(false);
      setShowLibrary(false);
      setShowCreatorStudio(false);
      setShowBrandScanner(false);
      setShowProfile(false);
      setShowDeveloper(false);
      setShowMcp(false);
      setShowSearchV2(false);
      setShowSearchV2Test(false);
    };

    if (effectivePath.startsWith('/moodboard')) {
      resetViews();
      setCurrentView('moodboard');
      setShowMoodboard(true);
      setShowLibrary(false);
      setShowCreatorStudio(false);
      setShowBrandScanner(false);
      if (location.state?.showCollections) {
        setMoodboardView('collections');
      }
      setShowDeveloper(false);
    } else if (effectivePath.startsWith('/developer') || effectivePath.startsWith('/docs')) {
      resetViews();
      setCurrentView('developer');
      setShowDeveloper(true);
    } else if (effectivePath.startsWith('/mcp')) {
      resetViews();
      setCurrentView('mcp');
      setShowMcp(true);
    } else if (effectivePath.startsWith('/audit')) {
      resetViews();
      setCurrentView('ai_audit');
      setShowAIAudit(true);
    } else if (effectivePath.startsWith('/library')) {
      resetViews();
      setCurrentView('library');
      setShowLibrary(true);
    } else if (effectivePath.startsWith('/creator-studio')) {
      resetViews();
      setCurrentView('creator_studio');
      setShowCreatorStudio(true);
    } else if (effectivePath.startsWith('/profile')) {
      resetViews();
      setCurrentView('profile');
      setShowProfile(true);
    } else if (effectivePath.startsWith('/scanner')) {
      resetViews();
      setCurrentView('brand_scanner');
      setShowBrandScanner(true);
    } else if (effectivePath.startsWith('/agentic-ui-test')) {
      resetViews();
      setCurrentView('search_v2_test');
      setShowSearchV2Test(true);
    } else if (effectivePath.startsWith('/search-v2') || effectivePath.startsWith('/browse') || effectivePath.startsWith('/agentic-ui')) {
      resetViews();
      setCurrentView('search_v2');
      setShowSearchV2(true);
    } else if (legacyMode && (effectivePath === '/' || effectivePath === '')) {
      // Legacy base route /inspoai/v1/allfeature — show AgenticUI as default home
      resetViews();
      setCurrentView('search_v2');
      setShowSearchV2(true);
    } else {
      // Default view logic
      const isExtensionMode = new URLSearchParams(location.search).get('mode') === 'extension' ||
        sessionStorage.getItem('inspo_extension_mode') === 'true';

      if (isExtensionMode && (effectivePath === '/' || effectivePath === '/search') && !location.search && !hasResults) {
        // Automatically move to moodboard view in extension mode
        navTo('/moodboard', { replace: true });
        return;
      } else {
        // Original behavior: Default to search view for / and /search
        resetViews();
        setCurrentView('search');
      }

      // If user is on /search with NO query parameters, reset the state (Hero Page)
      if (effectivePath === '/search' && !location.search && !location.state?.showMoodboard) {
        setSearchResults([]);
        setSearchParams({
          industry: '',
          designStyle: '',
          font: '',
          color: '',
          platforms: 'true',
          ai: 'true',
          page: 1
        });
        setColorPalette([]);
        setHeading('');
        setAiSuggestions('');
        setCurrentQuery('');
        setCurationData(null);
        setCurateLoading(false);
        setShowAiSuggestions(false);
        // Also clear storage to prevent resurrection
        sessionStorage.removeItem('inspo_search_state');
      }
    }
  }, [location.pathname, location.search, location.state, legacyMode]);

  useEffect(() => {
    if (location.state?.showMoodboard) {
      setShowMoodboard(true);
      setCurrentView('moodboard');
    }
  }, [location.state]);

  const randomPrompts = [
    'Animation Videos Motion Graphics',
    'Kinetic typography',
    'swiss design',
    '90s graphic design',
    'Y2K aesthetic',
    'One Week Wonders',
    'Mixed media posters',
    'Motion poster design',
    'vintage ads',
    'Deep space motion art',
    'Trippy visuals',
    'DankaDreams Poster'
  ];

  // Update user quota when prop changes
  useEffect(() => {
    setUserQuota(quota);
    if (quota && quota.remaining === 0 && !quota.isUnlimited) {
      setQuotaExceeded(true);
    } else {
      setQuotaExceeded(false);
    }
  }, [quota]);

  useEffect(() => {
    // Subscribe to navigation events
    const searchUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.SEARCH,
      () => {
        setCurrentView('search');
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const moodboardUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.MOODBOARD,
      () => {
        setCurrentView('moodboard');
        setShowMoodboard(true);
        setMoodboardView('draft');
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const auditUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.AI_AUDIT,
      () => {
        setCurrentView('ai_audit');
        setShowMoodboard(false);
        setShowAIAudit(true);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const libraryUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.LIBRARY,
      () => {
        setCurrentView('library');
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(true);
        setShowCreatorStudio(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const creatorStudioUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.CREATOR_STUDIO,
      () => {
        setCurrentView('creator_studio');
        setShowCreatorStudio(true);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );



    const brandScannerUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.BRAND_SCANNER,
      () => {
        setCurrentView('brand_scanner');
        setShowBrandScanner(true);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
        // Reset search/other views
      }
    );

    const profileUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.PROFILE,
      () => {
        setCurrentView('profile');
        setShowProfile(true);
        setShowBrandScanner(false);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const developerUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.DEVELOPER,
      () => {
        setCurrentView('developer');
        setShowDeveloper(true);
        setShowProfile(false);
        setShowBrandScanner(false);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowMcp(false);
      }
    );

    const mcpUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.MCP,
      () => {
        setCurrentView('mcp');
        setShowMcp(true);
        setShowProfile(false);
        setShowBrandScanner(false);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowDeveloper(false);
      }
    );

    const searchV2Unsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.SEARCH_V2,
      () => {
        setCurrentView('search_v2');
        setShowSearchV2(true);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setShowBrandScanner(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setShowMcp(false);
      }
    );

    const newChatUnsubscribe = NavigationEvents.subscribe(
      NavigationEvents.VIEWS.NEW_CHAT,
      () => {
        // Reset all state to initial values
        setSearchResults([]);
        setSearchParams({
          industry: '',
          designStyle: '',
          font: '',
          color: '',
          platforms: 'true',
          ai: 'true',
          page: 1
        });
        setColorPalette([]);
        setHeading('');
        setAiSuggestions('');
        setCurationData(null);
        setCurateLoading(false);
        setShowMoodboard(false);
        setShowAIAudit(false);
        setShowLibrary(false);
        setShowCreatorStudio(false);
        setCurrentView('search_v2');
        setShowSearchV2(true);
        setCurrentQuery('');
        setShowBrandScanner(false);
        setShowAiSuggestions(false);
        setShowProfile(false);
        setShowDeveloper(false);
        setError(null);
        setLoading(false);
        setResetKey(prev => prev + 1);
        // Clear session storage as well to be safe (Sidebar does it too but this ensures consistency)
        sessionStorage.removeItem('inspo_search_state');
      }
    );

    // Clean up subscriptions
    return () => {
      searchUnsubscribe();
      moodboardUnsubscribe();
      auditUnsubscribe();
      libraryUnsubscribe();
      creatorStudioUnsubscribe();
      brandScannerUnsubscribe();
      newChatUnsubscribe();

      developerUnsubscribe();
      mcpUnsubscribe();
    };
  }, []);

  // Handle URL changes to trigger search
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const q = params.get('q');
    const industry = params.get('industry');
    const designStyle = params.get('designStyle');
    const font = params.get('font');
    const color = params.get('color');

    // Trigger search if ANY relevant parameter is present
    if (q || industry || designStyle || font || color) {
      // ── SMART CURATION DETECTION ──
      // Check if query matches curate intent BEFORE running normal search
      const CURATE_TRIGGERS = [
        /\b(create|generate|build|design|make|collect|curate|compile|assemble|gather)\s/i,
        /\b(cretae|creat|desgin|buid|biuld|genrate|generete|mak)\s/i,
        /\b(flow|journey|screens for|app like|full app|user flow)\b/i,
        /\b(moodboard|mood board|moodborad|moodbaord|moodbord|mooodboard|mood bored|inspo board|inspiration board)\b/i,
        /\b(i need|i want|show me|give me|get me|find me|put together)\b.*\b(screens|app|moodboard|flow|design|ui|ux|layout|board)\b/i,
        /\b(wireframe|prototype|mockup|mock up|layout for)\b/i,
      ];
      const isCurateQuery = q && CURATE_TRIGGERS.some(rx => rx.test(q));

      let searchMode = params.get('searchMode') || 'web';
      if (searchMode === 'ui') {
        searchMode = 'web';
      }

      // Normal search flow (no curate intent)
      setCurationData(null);

      // Check if we need to fetch (avoid duplicate if we just searched)
      // We look at the LAST session to see if it matches the current URL query
      const lastSession = searchResults && searchResults.length > 0
        ? searchResults[searchResults.length - 1]
        : null;

      if (!lastSession || lastSession.query !== q) {
        const newParams = {
          q: q,
          page: params.get('page') || 1,
          ...(params.get('industry') && { industry: params.get('industry') }),
          ...(params.get('designStyle') && { designStyle: params.get('designStyle') }),
          ...(params.get('font') && { font: params.get('font') }),
          ...(params.get('color') && { color: params.get('color') }),
          platforms: params.get('platforms') || 'true',
          ai: params.get('ai') || 'true',
          searchMode: searchMode,   // ← pass through to backend
        };
        fetchSearchResults(newParams, false);
      }
    }
  }, [location.search]);

  // Check if query contains any of the design keywords
  useEffect(() => {
    if (currentQuery) {
      setShowAiSuggestions(containsDesignKeyword(currentQuery));
    } else {
      setShowAiSuggestions(false);
    }
  }, [currentQuery]);

  const formatHeading = (customParams = null, customQuery = null) => {
    const p = customParams || searchParams;
    const q = customQuery || currentQuery;
    const parts = [];

    // Add selected industry
    if (p.industry) {
      parts.push(`${p.industry}`);
    }

    // Add selected design style
    if (p.designStyle) {
      parts.push(`${p.designStyle}`);
    }

    // Add selected font
    if (p.font) {
      parts.push(`${p.font}`);
    }

    // Create base heading
    let formattedHeading = parts.length > 0
      ? parts.join(' ')
      : (heading || 'Design Recommendations');

    // If there's a search query, add it
    if (q) {
      formattedHeading = `${formattedHeading} for "${q}"`;
    }

    return formattedHeading;
  };

  // Update search history - Save to database with images
  const updateSearchHistory = async (query, params, images = []) => {
    if (!query) return;

    // Create a history entry for localStorage (backward compatibility)
    const historyEntry = {
      query,
      params: { ...params },
      timestamp: new Date().toISOString()
    };

    // Update local state
    const updatedHistory = [
      historyEntry,
      ...searchHistory.filter(entry => entry.query !== query)
    ].slice(0, 10);

    setSearchHistory(updatedHistory);

    // Save to localStorage
    try {
      localStorage.setItem('searchHistory', JSON.stringify(updatedHistory));
    } catch (e) {
      console.error('Error saving search history to localStorage:', e);
    }

    // Save to database with images (Cloudinary)
    try {
      if (user && images.length > 0) {
        await HistoryService.saveSearch(query, params, images);
      }
    } catch (e) {
      console.error('Error saving search history to database:', e);
      // Don't block user flow if history save fails
    }
  };

  // Get auth token for API calls
  const getAuthToken = useCallback(async () => {
    if (isPublic) return null; // No token needed for public SEO routes
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    return currentUser.getIdToken();
  }, [isPublic]);

  // Fetch search results with pagination support
  const fetchSearchResults = async (params, isLoadMore = false) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      // Check if quota is exceeded before making the request
      if (userQuota && userQuota.remaining === 0 && !userQuota.isUnlimited && !isLoadMore) {
        throw new Error('Your search limit has been exhausted. Upgrade your plan for unlimited searches!');
      }

      // If query is empty but filters exist, construct a query from filters
      if (!params.q) {
        const filterTerms = [
          params.industry,
          params.designStyle,
          params.font !== 'serif' && params.font !== 'sans-serif' ? params.font : '' // Avoid generic font names as sole query
        ].filter(Boolean);

        if (filterTerms.length > 0) {
          params.q = filterTerms.join(' ');
        } else {
          // Fallback if somehow we got here without q and without filters (shouldn't happen due to useEffect guard)
          params.q = 'design inspiration';
        }
      }

      const queryParams = new URLSearchParams(params);
      const token = await getAuthToken();

      // Determine which endpoint to use
      const paginateEndpoint = `${import.meta.env.VITE_API_URL}/search/paginate`;
      const searchEndpoint = `${import.meta.env.VITE_API_URL}/search`;
      const endpoint = isLoadMore && parseInt(params.page) > 1
        ? paginateEndpoint
        : searchEndpoint;

      // PHASE 1 FETCH (Fast) — strip empty params for clean URLs
      const cleanParams = Object.fromEntries(Object.entries({ ...params, phase: "1" }).filter(([_, v]) => v !== '' && v != null));
      const phase1Params = new URLSearchParams(cleanParams);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      let phase1Response = await fetch(`${endpoint}?${phase1Params}${isPublic ? '&public=true' : ''}`, {
        headers
      });

      // Fallback: if paginate returns 404 (cold cache after restart), retry with /search
      if (isLoadMore && phase1Response.status === 404) {
        const fallbackParams = new URLSearchParams({ ...cleanParams, page: '1' });
        phase1Response = await fetch(`${searchEndpoint}?${fallbackParams}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      if (phase1Response.status === 429) {
        // Quota exceeded
        const errorData = await phase1Response.json();
        setQuotaExceeded(true);
        throw new Error('Your search limit has been exhausted. Upgrade your plan for unlimited searches!');
      }

      if (!phase1Response.ok) {
        throw new Error('Something went wrong. Please try again.');
      }

      const data = await phase1Response.json();

      let logoResults = null;

      const isLogoQuery = params.q && (
        params.q.toLowerCase().includes('logo') ||
        params.q.toLowerCase().includes('brand')
      );

      if (isLogoQuery && !isLoadMore) {
        try {
          let logoType = (params.q.toLowerCase().includes('trend') || params.q.toLowerCase().includes('top')) ? 'trend' : 'brand';
          const logoResponse = await fetch(`${import.meta.env.VITE_API_URL}/logo-search?q=${encodeURIComponent(params.q)}&type=${logoType}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (logoResponse.ok) {
            const logoData = await logoResponse.json();
            if (logoData.success) {
              logoResults = logoData;
            }
          }
        } catch (e) {
          console.error("Logo Search error:", e);
        }
      }

      // Update quota information if available
      if (data.quota) {
        setUserQuota(data.quota);
        if (data.quota.remaining === 0 && !data.quota.isUnlimited) {
          setQuotaExceeded(true);
        }
      }

      if (isLoadMore) {
        // Append new images to existing results (LAST SESSION)
        setSearchResults(prevSessions => {
          const newSessions = [...prevSessions];
          const lastSession = newSessions[newSessions.length - 1];
          if (lastSession) {
            newSessions[newSessions.length - 1] = {
              ...lastSession,
              images: [...lastSession.images, ...data.images]
            };
          }
          return newSessions;
        });
      } else {
        // Create new session object
        let processedHeading = data.heading || 'Design Recommendations';
        processedHeading = processedHeading.replace(/<\/?h1>/g, '');

        // UPDATE LOCAL STATE to reflect active search
        setSearchParams(params);
        setCurrentQuery(params.q || '');

        // This sets the "global" current state variables
        setColorPalette(data.colorPalette || []);
        setHeading(processedHeading);
        setAiSuggestions(data.aiSuggestions || '');

        // Generate session specific heading logic
        const sessionHeading = formatHeading(params, params.q);

        // Pin Supabase-sourced results to the top of the grid
        const SUPABASE_SOURCES = new Set(['Mobbin', 'UI Reference', 'Dribbble', 'Mobbin UI', 'Lapa Ninja', 'Land-book']);
        const rawImages = data.images || [];
        const supabaseFirst = [
          ...rawImages.filter(img => SUPABASE_SOURCES.has(img?.source)),
          ...rawImages.filter(img => !SUPABASE_SOURCES.has(img?.source)),
        ];

        const newSession = {
          id: Date.now(),
          images: supabaseFirst,
          iconResults: data.iconResults || [],

          logoResults: logoResults,
          heading: sessionHeading,
          params: params,
          query: params.q || currentQuery,
          colorPalette: data.colorPalette || [],
          aiSuggestions: data.aiSuggestions || ''
        };

        // Append new session
        setSearchResults(prev => [...(prev || []), newSession]);

        // Update search history (only for new searches, not load more)
        if (params.q && data.images) {
          updateSearchHistory(params.q, params, data.images.slice(0, 6));
        }
      }

    } catch (err) {
      setError(err.message);
      console.error('Search error:', err);
    } finally {
      // Add a slight delay before removing loading state to prevent flickering
      setTimeout(() => {
        setLoading(false);
        setLoadingMore(false);
      }, 300);
    }

    // PHASE 2 BACKGROUND FETCH (Enrichment)
    // Only run if it's the first page (not a paginated load more) and no errors occurred
    if (!isLoadMore && parseInt(params.page) === 1) {
      try {
        const token = await getAuthToken();
        const phase2Params = new URLSearchParams(Object.fromEntries(Object.entries({ ...params, phase: "2" }).filter(([_, v]) => v !== '' && v != null)));
        const endpoint = `${import.meta.env.VITE_API_URL}/search`;

        fetch(`${endpoint}?${phase2Params}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.ok ? res.json() : Promise.reject('Phase 2 failed'))
          .then(phase2Data => {
            if (phase2Data && phase2Data.phase === "2" && phase2Data.images && phase2Data.images.length > 0) {
              // Silently append new images to the CURRENT session (the last one in the array)
              setSearchResults(prevSessions => {
                if (!prevSessions || prevSessions.length === 0) return prevSessions;
                const newSessions = [...prevSessions];
                const lastIndex = newSessions.length - 1;
                const lastSession = newSessions[lastIndex];

                // Verify we are updating the correct session by checking query
                if (lastSession.query === (params.q || currentQuery)) {
                  newSessions[lastIndex] = {
                    ...lastSession,
                    images: [...lastSession.images, ...phase2Data.images]
                  };
                }
                return newSessions;
              });
            }
          })
          .catch(err => console.error('Background phase 2 error:', err));

      } catch (err) {
        console.error('Failed to trigger Phase 2:', err);
      }
    }
  };

  const handleRandomInspiration = async () => {
    if (quotaExceeded) {
      setError('Your search limit has been exhausted. Upgrade your plan for unlimited searches!');
      return;
    }

    // pick a random prompt
    const randomPrompt =
      randomPrompts[Math.floor(Math.random() * randomPrompts.length)];

    // build new params & reset to page 1
    const newParams = {
      ...searchParams,
      page: 1,
      q: randomPrompt
    };

    // Navigate to URL
    const qs = new URLSearchParams();
    Object.keys(newParams).forEach(key => {
      if (newParams[key]) qs.append(key, newParams[key]);
    });
    navTo(`/search?${qs.toString()}`);
  };

  const handleSearch = async (params) => {
    // If trial is expired, show pricing modal instead of searching
    const isTrialExpired = user?.role === 'trial' && (user?.trial?.expired || (user?.trial?.daysRemaining != null && user?.trial?.daysRemaining <= 0));
    if (isTrialExpired) {
      setShowPricing(true);
      return;
    }

    if (quotaExceeded) {
      setError('Your search limit has been exhausted. Upgrade your plan for unlimited searches!');
      return;
    }

    // Reset to page 1 for new searches
    const newParams = {
      ...params,
      page: 1
    };

    // Navigate to URL
    const qs = new URLSearchParams();
    Object.keys(newParams).forEach(key => {
      if (newParams[key]) qs.append(key, newParams[key]);
    });
    navTo(`/search?${qs.toString()}`);
  };

  const handleLoadMore = async () => {
    // Don't load more if already loading
    if (loading || loadingMore) return;

    // Increment page number
    const nextPage = parseInt(searchParams.page) + 1;
    const newParams = {
      ...searchParams,
      page: nextPage
    };

    // Update state
    setSearchParams(newParams);

    // Fetch more results
    await fetchSearchResults(newParams, true);
  };

  // Handle viewing moodboard
  const handleViewMoodboard = () => {
    setShowMoodboard(true);
    setCurrentView('moodboard');
  };

  // Handle hiding moodboard
  const handleHideMoodboard = () => {
    setShowMoodboard(false);
    setCurrentView('search');
  };

  // Handle editing a collection (navigates to draft view with collection data)
  const handleEditCollection = (images) => {
    try {
      localStorage.setItem('moodboardImages', JSON.stringify(images));
      // Dispatch update event for Sidebar to pick up
      window.dispatchEvent(new CustomEvent('moodboardUpdate', {
        detail: { count: images.length }
      }));
      setMoodboardView('draft');
    } catch (error) {
      console.error('Error handling edit collection:', error);
    }
  };


  // Render the content based on the current view
  const renderContent = () => {
    if (showAIAudit) {
      return <AIAudit user={user} quota={userQuota} />;
    } else if (showMoodboard) {
      return (
        <div className="moodboard-view-container" style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          width: '100%',
          background: '#fff'
        }}>
          <div className="moodboard-tab-content" style={{
            flex: 1,
            overflowY: 'auto'
          }}>
            {moodboardView === 'draft' ? (
              <MoodboardPreviewPage 
                onBackToResults={handleHideMoodboard} 
                moodboardView={moodboardView}
                setMoodboardView={setMoodboardView}
              />
            ) : (
              <MoodboardLibrary 
                onEditCollection={handleEditCollection} 
                moodboardView={moodboardView}
                setMoodboardView={setMoodboardView}
              />
            )}
          </div>
        </div>
      );
    } else if (showLibrary) {
      return <CreatorStudio />;
    } else if (showCreatorStudio) {
      return <CreatorStudio />;
    } else if (showBrandScanner) {
      return <BrandScanner />;
    } else if (showSearchV2Test) {
      return <AgenticUITest user={user} quota={quota} />;
    } else if (showSearchV2) {
      return <AgenticUI user={user} quota={quota} />;
    } else if (showProfile) {
      return <MobileProfile user={user} onBack={() => setShowProfile(false)} />;
    } else if (showDeveloper) {
      return <DeveloperPortal user={user} />;
    } else if (showMcp) {
      return <McpPortal user={user} />;
    } else {

      return (
        <>
          {/* SEO Content Section */}
          {(isPublic || initialSEOData) && (
            <div className="seo-content-header" style={{
              padding: '24px',
              marginBottom: '24px',
              background: '#fff',
              borderRadius: '16px',
              border: '1px solid #eee',
              maxWidth: '1200px',
              margin: '32px auto'
            }}>
              <h1 style={{ fontSize: '32px', fontWeight: '800', marginBottom: '12px', color: '#111' }}>
                {initialSEOData?.h1 || heading || `Best ${currentQuery} Design Inspiration`}
              </h1>
              <p style={{ fontSize: '16px', color: '#444', lineHeight: '1.6', maxWidth: '800px' }}>
                {initialSEOData?.description || aiSuggestions || `Browse our curated collection of ${currentQuery} designs, layouts, and patterns.`}
              </p>

              {/* JSON-LD for Search Engines */}
              <script type="application/ld+json">
                {JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "ItemList",
                  "itemListElement": searchResults[0]?.images?.slice(0, 10).map((img, i) => ({
                    "@type": "ListItem",
                    "position": i + 1,
                    "item": {
                      "@type": "ImageObject",
                      "contentUrl": img.image,
                      "name": img.title || `${currentQuery} Design Inspiration #${i + 1}`,
                      "creator": {
                        "@type": "Organization",
                        "name": "InspoAI"
                      }
                    }
                  }))
                })}
              </script>
            </div>
          )}

          {!hasResults && !loading && !curationData && (
            <>
              <SearchBar
                key={resetKey}
                onSearch={handleSearch}
                onRandomInspiration={handleRandomInspiration}
                loading={loading}
                searchResults={searchResults}
                position="center"
                showWelcomeText={true}
                searchHistory={searchHistory}
                quotaExceeded={quotaExceeded}
                userQuota={userQuota}
              />

            </>
          )}

          {/* Initial loading skeleton */}
          {loading && !hasResults && !curationData && (
            <div className="skeleton-container" ref={skeletonRef}>
              <div className="skeleton-header">
                <div className="skeleton-tags">
                  <div className="skeleton-tag"></div>
                  <div className="skeleton-tag"></div>
                  <div className="skeleton-tag"></div>
                </div>
                <div className="skeleton-title"></div>
              </div>
              <div className="skeleton-grid">
                {Array(12).fill().map((_, index) => (
                  <div key={`skeleton-${index}`} className="skeleton-item">
                    <div className="skeleton-image"></div>
                    <div className="skeleton-info">
                      <div className="skeleton-text"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="results-container">
            {/* ── Smart Curation View ── */}
            {(curationData || curateLoading) && (
              <CurationCanvas
                curation={curationData}
                isLoading={curateLoading}
                user={auth.currentUser}
                onBack={() => {
                  setCurationData(null);
                  navTo('/search');
                }}
                onSaveAsMoodboard={(moodboard) => {
                  // Save to localStorage using the same key as existing moodboard module
                  const existing = JSON.parse(localStorage.getItem('moodboardImages') || '[]');
                  const newImages = moodboard.images.map(img => ({
                    ...img,
                    _internalId: img._internalId || `curate-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    addedAt: new Date().toISOString(),
                  }));
                  // Merge without duplicates
                  const existingIds = new Set(existing.map(i => i._internalId));
                  const merged = [...existing, ...newImages.filter(i => !existingIds.has(i._internalId))];
                  localStorage.setItem('moodboardImages', JSON.stringify(merged));
                  // Dispatch moodboardUpdate event so Sidebar badge updates
                  window.dispatchEvent(new Event('moodboardUpdate'));
                  toast.success(`${newImages.length} screens saved to moodboard!`);
                  // Navigate to moodboard view
                  navTo('/moodboard');
                }}
              />
            )}

            {/* ── Normal Search Results ── */}
            {!curationData && hasResults && searchResults.map((session, index) => (
              <div key={session.id || index} className="search-session" style={{ marginBottom: '60px' }}>
                <div className="results-header">
                  <div className="tags">
                    {session.params?.industry && <span className="tag">{session.params.industry}</span>}
                    {session.params?.designStyle && <span className="tag">{session.params.designStyle}</span>}
                    {session.params?.font && <span className="tag">{session.params.font}</span>}

                    {session.params?.color && (
                      <span className="tag color-swatch" aria-label={session.params.color}>
                        <span
                          className="dot"
                          style={{ backgroundColor: session.params.color }}
                        />
                        <span className="color-code">{session.params.color}</span>
                      </span>
                    )}
                  </div>

                  {/* Clean up heading html if present */}
                  <h2 className="title">{session.heading ? session.heading.replace(/<\/?h1>/g, '') : 'Design Recommendations'}</h2>
                </div>

                <div className="results-content">
                  <ResultsGrid
                    results={session.images || []}
                    iconResults={session.iconResults || []}

                    logoResults={session.logoResults || null}
                    // Only show loading state on the last item if we are loading more
                    loading={loadingMore && index === searchResults.length - 1}
                    query={session.query}
                    params={session.params}
                    colorPalette={session.colorPalette}
                    heading={session.heading}
                    aiSuggestions={session.aiSuggestions}
                    // Only allow loading more on the last session
                    onLoadMore={index === searchResults.length - 1 ? handleLoadMore : undefined}
                    onViewMoodboard={handleViewMoodboard}
                    onCustomizerStateChange={setIsIconCustomizerOpen}
                  />
                </div>
              </div>
            ))}

            {/* Skeleton for subsequent searches (chat style loading) */}
            {loading && hasResults && (
              <div className="skeleton-container" style={{ marginTop: '40px' }} ref={skeletonRef}>
                <div className="skeleton-header">
                  <div className="skeleton-title" style={{ width: '200px' }}></div>
                </div>
                <div className="skeleton-grid">
                  {Array(4).fill().map((_, index) => (
                    <div key={`skeleton-chat-${index}`} className="skeleton-item">
                      <div className="skeleton-image"></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Search bar at bottom for continuous chat */}
            {hasResults && !isIconCustomizerOpen && (
              <SearchBar
                key={resetKey}
                onSearch={handleSearch}
                onRandomInspiration={handleRandomInspiration}
                loading={loading}
                // Pass the last session as current context if needed
                searchResults={searchResults[searchResults.length - 1]}
                position="bottom"
                showWelcomeText={false}
                currentQuery={currentQuery}
                searchParams={searchParams}
                searchHistory={searchHistory}
                quotaExceeded={quotaExceeded}
                userQuota={userQuota}
              />
            )}
          </div>

          {error && (
            <div className="error-message" role="alert">
              {error}
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}

          {quotaExceeded && (
            <div className="quota-limit-banner">
              <div className="quota-limit-content">
                <div className="quota-limit-icon"><Zap size={24} /></div>
                <h3>Search Limit Exhausted</h3>
                <p>You've used all <strong>{userQuota?.limit || 25}</strong> free searches for today.</p>
                <span className="quota-reset-note" style={{ marginTop: '12px', display: 'inline-block' }}>Your free searches & AI credits reset daily at midnight UTC</span>
              </div>
            </div>
          )}
        </>
      );
    }
  };

  return (
    <div className={`main-screen ${legacyMode ? 'main-screen--legacy' : 'main-screen--new'}`}>
      {/* ── Navigation: legacy = sidebar, new = floating top notch bar ── */}
      {legacyMode ? (
        <Sidebar
          user={user}
          userQuota={quota}
          onViewMoodboard={handleViewMoodboard}
          activeView={currentView}
          pathPrefix={LEGACY_PREFIX}
        />
      ) : (
        <TopNotchBar
          user={user}
          userQuota={quota}
          onUpgradeClick={() => setShowPricing(true)}
        />
      )}

      <div className={`content-area ${legacyMode ? '' : 'content-area--topbar'
        } ${(showProfile || showCreatorStudio || showLibrary || showBrandScanner || showSearchV2 || showMoodboard || (!hasResults && !loading && !showAIAudit)) ? 'no-padding' : ''}`}>
        <TrialBanner trial={user?.trial} currentPlan={user?.role || 'trial'} />
        {renderContent()}
        <BottomNav moodboardCount={moodboardCount} user={user} />
      </div>

      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={user?.role || 'trial'}
      />
    </div>
  );
};

export default MainScreen;