import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSpring, animated } from '@react-spring/web';
import { NavigationEvents } from './Sidebar';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import defaultAvatar from '../../assets/User.svg';
import '../../styles/TopNotchBar.css';

// Module-level cache — SVGs are fetched once and reused across re-renders
const svgCache = new Map();

const SVGIcon = ({ src }) => {
  const [svgContent, setSvgContent] = useState(() => svgCache.get(src) || '');

  useEffect(() => {
    if (svgCache.has(src)) {
      setSvgContent(svgCache.get(src));
      return;
    }
    fetch(src)
      .then(res => res.text())
      .then(data => {
        const processed = data
          .replace(/fill="#[aA]6[aA]6[aA]6"/g, 'fill="currentColor"')
          .replace(/stroke="#[aA]6[aA]6[aA]6"/g, 'stroke="currentColor"')
          .replace(/fill="#[fF]2[fF]2[fF]2"/g, 'fill="var(--svg-detail-color, #F2F2F2)"')
          .replace(/stroke="#[fF]2[fF]2[fF]2"/g, 'stroke="var(--svg-detail-color, #F2F2F2)"');
        svgCache.set(src, processed);
        setSvgContent(processed);
      });
  }, [src]);

  return <span className="top-notch-icon-svg-wrapper" dangerouslySetInnerHTML={{ __html: svgContent }} />;
};

// Inline SVG icons for the two mode items
function PencilSparklesIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3H8" />
      <path d="m15.007 5.008 3.987 3.986" />
      <path d="M20 15v4" />
      <path d="M21.174 6.813a2.82 2.82 0 0 0-3.986-3.987L3.842 16.175a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
      <path d="M22 17h-4" />
      <path d="M4 5v4" />
      <path d="M6 7H2" />
      <path d="M9 2v2" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

const NAV_ITEMS = [
  {
    key: 'design_mode',
    label: 'Design Mode',
    path: '/agentic-ui',
    icon: <PencilSparklesIcon />,
  },
  {
    key: 'inspo_mode',
    label: 'Inspo Mode',
    path: '/search',
    icon: <SearchIcon />,
  },
  {
    key: 'moodboard',
    label: 'Moodboard',
    path: '/moodboard',
    icon: <SVGIcon src="/NewLogo/Moodboard.svg" />,
  },
  {
    key: 'ai_audit',
    label: 'Design Audit',
    path: '/audit',
    icon: <SVGIcon src="/NewLogo/Aiaudit.svg" />,
  },
  {
    key: 'creator_studio',
    label: 'Creator Studio',
    path: '/creator-studio',
    icon: <SVGIcon src="/NewLogo/library.svg" />,
  },
];

const TopNotchBar = ({ user, userQuota, onUpgradeClick }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeView, setActiveView] = useState('design_mode');
  const [tooltip, setTooltip] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const userMenuRef = useRef(null);

  const { userData, currentUser, userQuota: contextUserQuota } = useAuth ? useAuth() : {};
  const effectiveUser = user || userData || auth.currentUser || currentUser;
  const effectiveQuota = userQuota || contextUserQuota;

  const photoURL =
    effectiveUser?.photoURL ||
    auth.currentUser?.photoURL ||
    effectiveUser?.providerData?.[0]?.photoURL ||
    auth.currentUser?.providerData?.[0]?.photoURL ||
    null;

  useEffect(() => {
    setAvatarError(false);
  }, [photoURL]);

  const tabRefs = useRef({});
  const [isMounted, setIsMounted] = useState(false);

  const [pillStyles, api] = useSpring(() => ({
    left: 0,
    width: 0,
    opacity: 0,
    config: { mass: 1, tension: 280, friction: 30 }
  }), [activeView]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Track scroll to show background on top bar when scrolled
  // The actual scroll container is .content-area, not window
  useEffect(() => {
    const container = document.querySelector('.content-area');
    if (!container) return;
    const onScroll = () => setIsScrolled(container.scrollTop > 10);
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const activeTab = tabRefs.current[activeView];
    if (activeTab) {
      api.start({
        left: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
        opacity: 1,
        immediate: !isMounted
      });
    } else {
      api.start({ opacity: 0 });
    }
  }, [activeView, isMounted, api]);

  // Sync active view with URL
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('/audit'))             setActiveView('ai_audit');
    else if (path.includes('/moodboard'))    setActiveView('moodboard');
    else if (path.includes('/creator-studio')) setActiveView('creator_studio');
    else if (path.includes('/search'))       setActiveView('inspo_mode');
    else if (path.includes('/profile'))      setActiveView('profile');
    else if (path.includes('/developer'))    setActiveView('developer');
    else if (path.includes('/mcp'))          setActiveView('mcp');
    else                                     setActiveView('design_mode');
  }, [location.pathname]);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const navigate_to = useCallback((item) => {
    setActiveView(item.key);
    setTooltip(null);
    navigate(item.path);
    NavigationEvents.publish(item.key, { source: 'topbar' });
  }, [navigate]);

  const handleNewChat = useCallback(() => {
    if (activeView === 'inspo_mode' || location.pathname.includes('/search')) {
      sessionStorage.removeItem('inspo_search_state');
      navigate('/search');
    } else {
      setActiveView('design_mode');
      sessionStorage.removeItem('inspo_search_state');
      NavigationEvents.publish(NavigationEvents.VIEWS.NEW_CHAT);
      if (location.pathname !== '/agentic-ui' || location.search) {
        navigate('/agentic-ui');
      }
    }
  }, [navigate, location, activeView]);

  const handleSignOut = async () => {
    try {
      const { auth } = await import('../../firebase');
      await auth.signOut();
      setUserMenuOpen(false);
    } catch (e) {
      console.error('Sign out error:', e);
    }
  };

  const effectiveUserName = effectiveUser?.displayName || auth.currentUser?.displayName || effectiveUser?.email?.split('@')[0] || 'User';
  const effectiveUserRole = effectiveUser?.role || 'free';

  const isSecondaryView = !['design_mode', 'inspo_mode'].includes(activeView);
  // Show floating logo/profile for secondary pages (moodboard, audit, creator studio)
  // Design Mode shows them only via CSS when the sidebar is active (handled in TopNotchBar.css)
  const showFloating = isSecondaryView;

  return (
    <>
      {/* Mobile-only: standalone logo pinned to top-left (outside the bottom bar wrapper so backdrop-filter doesn't trap it) */}
      <div className="mobile-top-logo" onClick={() => navigate('/agentic-ui')} title="InspoAI Home">
        <img src="/LogoInspo.svg" alt="InspoAI" className="top-notch-logo-img" />
      </div>

      <div className={`top-notch-wrapper ${isScrolled ? 'scrolled' : ''}`} data-active-view={activeView}>
      {/* Floating Logo (Top Left) — visibility controlled by CSS based on data-active-view */}
      <div className="top-notch-left-floating" onClick={() => navigate('/agentic-ui')} title="InspoAI Home">
        <img src="/LogoInspo.svg" alt="InspoAI" className="top-notch-logo-img" />
      </div>

      {/* Notch Bar */}
      <nav className="top-notch-bar" role="navigation" aria-label="Main navigation">
        <div className="top-notch-nav">
          <animated.div
            className="top-notch-active-pill"
            style={pillStyles}
          />
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.key;
            return (
              <div
                key={item.key}
                ref={el => tabRefs.current[item.key] = el}
                id={`top-notch-${item.key}`}
                className={`top-notch-item ${isActive ? 'active' : ''} ${isNavigating ? 'navigating' : ''}`}
                onClick={() => navigate_to(item)}
                role="button"
                tabIndex={0}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onKeyDown={(e) => e.key === 'Enter' && navigate_to(item)}
              >
                <span className="top-notch-icon">{item.icon}</span>
                {isActive && (
                  <span className="top-notch-label">{item.label}</span>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Floating User Menu / Avatar (Top Right) — visibility controlled by CSS */}
      <div className={`top-notch-right-floating ${['design_mode', 'inspo_mode'].includes(activeView) ? 'has-plus' : ''}`} ref={userMenuRef}>
          {['design_mode', 'inspo_mode'].includes(activeView) && (
            <button
              className="top-notch-new-chat"
              onClick={handleNewChat}
              title="Start New Session"
              aria-label="Start new session"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          )}

          <div
            className="top-notch-trial-badge"
            style={{
              cursor: 'default',
              background: '#FFFFFF',
              border: '1px solid rgba(0, 0, 0, 0.08)',
              color: '#111111',
              padding: '4px 11px',
              borderRadius: '100px',
              display: 'flex',
              alignItems: 'center',
              fontSize: '11.5px',
              fontWeight: '600',
              letterSpacing: '-0.01em',
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
            }}
            title="5 Free AI Credits daily. Resets every day at midnight UTC."
          >
            <span>5 Daily Credits</span>
          </div>

          <div
            id="top-notch-user-avatar"
            className={`top-notch-avatar ${userMenuOpen ? 'open' : ''}`}
            onClick={() => setUserMenuOpen(p => !p)}
            title={effectiveUserName}
            role="button"
            tabIndex={0}
            aria-label="User menu"
            onKeyDown={(e) => e.key === 'Enter' && setUserMenuOpen(p => !p)}
          >
            <img
              src={!avatarError && photoURL ? photoURL : defaultAvatar}
              alt={effectiveUserName}
              onError={() => setAvatarError(true)}
            />
          </div>

          {/* Dropdown */}
          {userMenuOpen && (
            <div className="top-notch-user-menu">
              <div className="top-notch-user-header">
                <div className="top-notch-user-name">{effectiveUserName}</div>
                <div className="top-notch-user-plan">Free Plan · 5 Daily Credits</div>
              </div>

              {effectiveQuota && !effectiveQuota.isUnlimited && (
                <div className="top-notch-quota">
                  <div className="top-notch-quota-bar">
                    <div
                      className="top-notch-quota-fill"
                      style={{ width: `${Math.min(100, (((effectiveQuota.limit || 25) - (effectiveQuota.remaining ?? 25)) / (effectiveQuota.limit || 25)) * 100)}%` }}
                    />
                  </div>
                  <div className="top-notch-quota-text">
                    {Math.max(0, (effectiveQuota.limit || 25) - (effectiveQuota.remaining ?? 25))} / {effectiveQuota.limit || 25} queries used today
                  </div>
                </div>
              )}

              <div className="top-notch-menu-divider" />

              <button
                className="top-notch-menu-item"
                onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                My Profile
              </button>

              <button
                className="top-notch-menu-item"
                onClick={handleNewChat}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Session
              </button>

              <div className="top-notch-menu-divider" />

              <button
                className="top-notch-menu-item danger"
                onClick={handleSignOut}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
    </div>
    </>
  );
};

export default TopNotchBar;
