import React, { useState, useEffect, useCallback } from 'react';
import '../../styles/Sidebar.css';
import UserManagement from '../User/UserManagement';
import PricingModal from '../PricingModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { Sparkles } from 'lucide-react';

const navigationEvents = {
  listeners: {},
  subscribe: (event, callback) => {
    if (!navigationEvents.listeners[event]) {
      navigationEvents.listeners[event] = [];
    }
    navigationEvents.listeners[event].push(callback);
    return () => {
      navigationEvents.listeners[event] =
        navigationEvents.listeners[event].filter(cb => cb !== callback);
    };
  },
  publish: (event, data = {}) => {
    if (navigationEvents.listeners[event]) {
      navigationEvents.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in navigation event callback:', error);
        }
      });
    }
  }
};

// Export these so we can use them from other 
export const NavigationEvents = {
  subscribe: navigationEvents.subscribe,
  publish: navigationEvents.publish,
  VIEWS: {
    SEARCH: 'search',
    MOODBOARD: 'moodboard',
    AI_AUDIT: 'ai_audit',
    CREATOR_STUDIO: 'creator_studio',
    BRAND_SCANNER: 'brand_scanner',
    LIBRARY: 'library',
    NEW_CHAT: 'new_chat',
    PROFILE: 'profile',

    DEVELOPER: 'developer',
    MCP: 'mcp',
    SEARCH_V2: 'search_v2'
  }
};

const Sidebar = ({ onViewMoodboard, user, userQuota, activeView: propActiveView, pathPrefix = '' }) => {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const [activeView, setActiveView] = useState(propActiveView || 'search');
  const [moodboardImages, setMoodboardImages] = useState([]);
  const [colorPalette, setColorPalette] = useState([]);
  const [fontPairs, setFontPairs] = useState([]);
  const [tooltipItem, setTooltipItem] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [expandTimeout, setExpandTimeout] = useState(null);
  const [showPricing, setShowPricing] = useState(false);


  const userRole = user?.role || 'free';

  // Plan hierarchy for feature gating
  const PLAN_LEVELS = { trial: 0, free: 0, lite: 1, lite_annual: 1, freelancer: 1, freelancer_annual: 1, solo: 1, solo_annual: 1, team: 2, team_annual: 2, lifetime: 3, admin: 4 };
  const hasAccess = (requiredPlan) => {
    if (!requiredPlan || requiredPlan === 'free' || requiredPlan === 'trial') return true;
    return (PLAN_LEVELS[userRole] || 0) >= (PLAN_LEVELS[requiredPlan] || 0);
  };

  // Sync active state with URL path
  const location = useLocation();

  useEffect(() => {
    if (propActiveView) {
      setActiveView(propActiveView);
    }
  }, [propActiveView]);

  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/creator-studio')) {
      setActiveView('creator_studio');
    } else if (path.includes('/moodboard')) {
      setActiveView('moodboard');
    } else if (path.includes('/audit')) {
      setActiveView('ai_audit');
    } else if (path.includes('/library')) {
      setActiveView('library');
    } else if (path.includes('/search')) {
      setActiveView('search');
    } else if (path.includes('/scanner')) {
      setActiveView('brand_scanner');
    }
  }, [location.pathname]);


  // Improved new chat handler with better error handling
  const handleNewChat = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      setIsNavigating(true);
      setActiveView('search_v2'); // Reset to UI Generation view

      // Clear any existing state
      setTooltipItem(null);

      // Clear persistent state
      sessionStorage.removeItem('inspo_search_state');

      // Publish new chat event first
      navigationEvents.publish(NavigationEvents.VIEWS.NEW_CHAT);

      // If we are not on the agentic-ui page or if we have query parameters, navigate there to clear the URL
      if (window.location.pathname !== (pathPrefix + '/agentic-ui') || window.location.search) {
        navigate(pathPrefix + '/agentic-ui');
      }

      setTimeout(() => {
        setIsNavigating(false);
      }, 300);

    } catch (error) {
      console.error('Error in handleNewChat:', error);
      setIsNavigating(false);
    }
  }, [navigate, pathPrefix]);

  // Load moodboard data from localStorage with better error handling
  const loadMoodboardData = useCallback(() => {
    try {
      const savedImages = localStorage.getItem('moodboardImages');
      const savedColors = localStorage.getItem('moodboardColorPalette');
      const savedFonts = localStorage.getItem('moodboardFontPairs');

      if (savedImages) {
        const images = JSON.parse(savedImages);
        setMoodboardImages(Array.isArray(images) ? images : []);
      } else {
        setMoodboardImages([]);
      }

      if (savedColors) {
        const colors = JSON.parse(savedColors);
        setColorPalette(Array.isArray(colors) ? colors : []);
      } else {
        setColorPalette([]);
      }

      if (savedFonts) {
        const fonts = JSON.parse(savedFonts);
        setFontPairs(Array.isArray(fonts) ? fonts : []);
      } else {
        setFontPairs([]);
      }
    } catch (error) {
      console.error('Error loading moodboard data:', error);
      // Set defaults on error
      setMoodboardImages([]);
      setColorPalette([]);
      setFontPairs([]);
    }
  }, []);

  useEffect(() => {
    loadMoodboardData();

    // Listen for moodboard updates with better error handling
    const handleMoodboardUpdate = (event) => {
      try {
        loadMoodboardData();
      } catch (error) {
        console.error('Error handling moodboard update:', error);
      }
    };

    window.addEventListener('moodboardUpdate', handleMoodboardUpdate);

    return () => {
      window.removeEventListener('moodboardUpdate', handleMoodboardUpdate);
      if (expandTimeout) {
        clearTimeout(expandTimeout);
      }
    };
  }, [loadMoodboardData, expandTimeout]);

  // Improved navigation handlers with better state management
  const handleMoodboardClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('moodboard');
      setTooltipItem(null);

      navigate(pathPrefix + '/moodboard');

      navigationEvents.publish(NavigationEvents.VIEWS.MOODBOARD, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleMoodboardClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleAIAuditClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('ai_audit');
      setTooltipItem(null);

      navigate(pathPrefix + '/audit');

      navigationEvents.publish(NavigationEvents.VIEWS.AI_AUDIT, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleAIAuditClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, userRole, pathPrefix]);

  const handleSearchClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('search');
      setTooltipItem(null);

      // Check if we have a previous search session
      const storedState = sessionStorage.getItem('inspo_search_state');
      let targetUrl = '/search';

      if (storedState) {
        try {
          const parsed = JSON.parse(storedState);
          // Only restore if we have a query
          if (parsed.currentQuery || parsed.searchParams?.q) {
            const params = parsed.searchParams || {};
            const q = parsed.currentQuery || params.q;

            // Reconstruct query parameters
            const qs = new URLSearchParams();
            qs.append('q', q);
            if (params.industry) qs.append('industry', params.industry);
            if (params.designStyle) qs.append('designStyle', params.designStyle);
            if (params.font) qs.append('font', params.font);
            if (params.color) qs.append('color', params.color);
            if (params.page) qs.append('page', params.page);
            if (params.platforms) qs.append('platforms', params.platforms);
            if (params.ai) qs.append('ai', params.ai);

            targetUrl = `/search?${qs.toString()}`;
          }
        } catch (e) {
          console.error('Error parsing stored state for navigation', e);
        }
      }

      navigate(pathPrefix + targetUrl);

      navigationEvents.publish(NavigationEvents.VIEWS.SEARCH, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleSearchClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleCreatorStudioClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('creator_studio');
      setTooltipItem(null);

      navigate(pathPrefix + '/creator-studio');

      navigationEvents.publish(NavigationEvents.VIEWS.CREATOR_STUDIO, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleCreatorStudioClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleLibraryClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('library');
      setTooltipItem(null);

      navigate(pathPrefix + '/library');

      navigationEvents.publish(NavigationEvents.VIEWS.LIBRARY, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleLibraryClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleBrandScannerClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('brand_scanner');
      setTooltipItem(null);

      navigate(pathPrefix + '/scanner');

      navigationEvents.publish(NavigationEvents.VIEWS.BRAND_SCANNER, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleBrandScannerClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);



  const handleProfileClick = useCallback(() => {
    if (isNavigating) return;

    try {
      setIsNavigating(true);
      setActiveView('profile');
      setTooltipItem(null);

      navigate(pathPrefix + '/profile');

      navigationEvents.publish(NavigationEvents.VIEWS.PROFILE, {
        source: 'sidebar',
        timestamp: Date.now()
      });

      setTimeout(() => setIsNavigating(false), 500);

    } catch (error) {
      console.error('Error in handleProfileClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleDeveloperClick = useCallback(() => {
    if (isNavigating) return;
    try {
      setIsNavigating(true);
      setActiveView('developer');
      setTooltipItem(null);
      navigate(pathPrefix + '/developer');
      navigationEvents.publish(NavigationEvents.VIEWS.DEVELOPER, {
        source: 'sidebar',
        timestamp: Date.now()
      });
      setTimeout(() => setIsNavigating(false), 500);
    } catch (error) {
      console.error('Error in handleDeveloperClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleMcpClick = useCallback(() => {
    if (isNavigating) return;
    try {
      setIsNavigating(true);
      setActiveView('mcp');
      setTooltipItem(null);
      navigate(pathPrefix + '/mcp');
      navigationEvents.publish(NavigationEvents.VIEWS.MCP, {
        source: 'sidebar',
        timestamp: Date.now()
      });
      setTimeout(() => setIsNavigating(false), 500);
    } catch (error) {
      console.error('Error in handleMcpClick:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  const handleSearchV2Click = useCallback(() => {
    if (isNavigating) return;
    try {
      setIsNavigating(true);
      setActiveView('search_v2');
      setTooltipItem(null);
      navigate(pathPrefix + '/agentic-ui');
      navigationEvents.publish(NavigationEvents.VIEWS.SEARCH_V2, {
        source: 'sidebar',
        timestamp: Date.now()
      });
      setTimeout(() => setIsNavigating(false), 500);
    } catch (error) {
      console.error('Error in handleSearchV2Click:', error);
      setIsNavigating(false);
    }
  }, [navigate, isNavigating, pathPrefix]);

  // Improved sidebar mouse interactions with debouncing
  const handleMouseEnter = useCallback(() => {
    if (expandTimeout) {
      clearTimeout(expandTimeout);
    }
    setExpanded(true);
  }, [expandTimeout]);

  const handleMouseLeave = useCallback(() => {
    const timeout = setTimeout(() => {
      setExpanded(false);
      setTooltipItem(null);
    }, 100); // Small delay to prevent flickering
    setExpandTimeout(timeout);
  }, []);

  // Show/hide tooltip handlers with improved timing
  const showTooltip = useCallback((itemIndex) => {
    if (!expanded) {
      setTimeout(() => setTooltipItem(itemIndex), 150);
    }
  }, [expanded]);

  const hideTooltip = useCallback(() => {
    setTooltipItem(null);
  }, []);

  // Toggle sidebar expanded state
  const toggleSidebar = useCallback(() => {
    setExpanded(prev => !prev);
    setTooltipItem(null);
  }, []);

  const isExtensionMode = new URLSearchParams(location.search).get('mode') === 'extension' ||
    sessionStorage.getItem('inspo_extension_mode') === 'true';

  // Navigation items configuration
  const allNavigationItems = [
    {
      src: "/UIGeneration.svg",
      label: "UI Generation",
      active: activeView === 'search_v2',
      onClick: handleSearchV2Click,
      requiredPlan: 'free'
    },
    {
      src: "/Search.svg",
      label: "Search",
      active: activeView === 'search',
      onClick: handleSearchClick,
      requiredPlan: 'free'
    },
    {
      src: "/ji.svg",
      label: "Moodboard",
      active: activeView === 'moodboard',
      onClick: handleMoodboardClick,
      badge: moodboardImages.length > 0 ? moodboardImages.length : null,
      requiredPlan: 'free'
    },
    {
      src: "/Scanner.svg",
      label: "Brand Scanner",
      active: activeView === 'brand_scanner',
      onClick: handleBrandScannerClick,
      requiredPlan: 'free'
    },
    {
      src: "/cube.svg",
      label: "Design Audit",
      active: activeView === 'ai_audit',
      onClick: handleAIAuditClick,
      requiredPlan: 'free'
    },
    {
      src: "/Text.svg",
      label: "Creator Studio",
      active: activeView === 'creator_studio',
      onClick: handleCreatorStudioClick,
      requiredPlan: 'free'
    },
    {
      src: "/Moodboard.svg",
      label: "History",
      active: activeView === 'library',
      onClick: handleLibraryClick,
      requiredPlan: 'free'
    }
  ];

  const navigationItems = isExtensionMode
    ? allNavigationItems.filter(item => !['Search', 'Creator Studio', 'History'].includes(item.label))
    : allNavigationItems;

  return (
    <div
      className={`sidebar ${expanded ? 'expanded' : ''} ${isNavigating ? 'navigating' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="logoSidebar" onClick={toggleSidebar}>
        {expanded ? (
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
            <img src="/LogoInspo.svg" alt="InspoAI Logo" />
          </div>
        ) : (
          <img src="/Vector.svg" alt="InspoAI Icon" />
        )}
      </div>


      <div className="sidebar-content">
        {!isExtensionMode && (
          <button
            className={`new-chat-btn ${isNavigating ? 'loading' : ''}`}
            onClick={handleNewChat}
            disabled={isNavigating}
            title={!expanded ? "New chat" : ""}
          >
            <span>+</span>
            <span>{isNavigating ? 'Loading...' : 'New chat'}</span>
          </button>
        )}

        <div className="sidebar-items">
          {navigationItems.map(({ src, isInspire, isSparkles, label, active, onClick, badge, requiredPlan }, index) => {
            const isLocked = !hasAccess(requiredPlan);
            const canClick = !isLocked && onClick && !isNavigating;

            return (
              <div
                className={`sidebar-item ${active ? 'active' : ''} ${isLocked ? 'disabled' : ''} ${isNavigating ? 'loading' : ''} ${label === 'UI Generation' ? 'ui-generation-glow' : ''}`}
                key={`nav-item-${index}`}
                onClick={canClick ? onClick : isLocked ? () => setShowPricing(true) : undefined}
                onMouseEnter={() => isLocked ? showTooltip(index) : null}
                onMouseLeave={hideTooltip}
                style={{
                  cursor: canClick ? 'pointer' : isLocked ? 'pointer' : 'default',
                  opacity: isNavigating && !active ? 0.6 : 1
                }}
                title={!expanded && !isLocked ? label : !expanded && isLocked ? `${label} — Upgrade to unlock` : ""}
              >
                <div className="icon-circle">
                  {isSparkles ? (
                    <Sparkles size={18} />
                  ) : isInspire ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                  ) : (
                    <div
                      className="sidebar-icon-mask"
                      style={{
                        WebkitMaskImage: `url(${src})`,
                        maskImage: `url(${src})`,
                        WebkitMaskRepeat: 'no-repeat',
                        maskRepeat: 'no-repeat',
                        WebkitMaskPosition: 'center',
                        maskPosition: 'center',
                        WebkitMaskSize: 'contain',
                        maskSize: 'contain',
                        width: '24px',
                        height: '24px',
                      }}
                    />
                  )}
                  {badge && <span className="icon-badge">{badge}</span>}
                </div>
                <div className="sidebar-item-text">
                  <span>{label}</span>
                  {isLocked && (
                    <span className="upgrade-hint">Upgrade to Pro ✦</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {user && <UserManagement
        user={user}
        userQuota={userQuota}
        onUpgradeClick={() => setShowPricing(true)}
        onProfileClick={handleProfileClick}
        onDeveloperClick={handleDeveloperClick}
        onMcpClick={handleMcpClick}
        expanded={expanded}
      />}

      {/* Pricing Modal */}
      <PricingModal
        isOpen={showPricing}
        onClose={() => setShowPricing(false)}
        currentPlan={userRole}
      />
    </div>
  );
};

export default Sidebar;