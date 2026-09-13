import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SketchPicker } from 'react-color';
import { Sparkle, ChevronDown } from 'lucide-react';
import "../../styles/SearchBar.css"
import ModeToggle from '../ModeToggle';

const SearchBar = ({
  onSearch,
  onRandomInspiration,
  loading,
  searchResults,
  position = 'center',
  showWelcomeText = true
}) => {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [color, setColor] = useState('#000000');
  const [searchBarExpanded, setSearchBarExpanded] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Detect mobile: ≤768px → dropdown, >768px → pill tabs
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Read active searchMode from URL so the bottom "Continue" bar inherits it
  const [urlParams] = useSearchParams();
  const urlSearchMode = urlParams.get('searchMode');
  const [searchMode, setSearchMode] = useState(() =>
    urlSearchMode || 'web'
  );  // 'ui' | 'web' | 'icon'

  // Keep searchMode in sync when URL changes (e.g. user navigates back/forward)
  useEffect(() => {
    if (urlSearchMode && urlSearchMode !== searchMode) {
      setSearchMode(urlSearchMode);
    }
  }, [urlSearchMode]);
  const [searchParams, setSearchParams] = useState({
    industry: '',
    designStyle: '',
    font: '',
    color: '',
    platforms: 'true',
    ai: 'true',
    page: 1
  });
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

  // --- Animation State for Placeholder ---
  const MODE_PROMPTS = {
    web: [
      "Fintech landing page",
      "SaaS website inspiration",
      "Creative studio website",
      "Minimalist web design",
      "Modern portfolio layout",
      "Trendy website components"
    ],
    icon: [
      "Show me the trending icons",
      "Downloadable 3D icons",
      "Linear icon sets",
      "Minimalist icon packs",
      "About us section with icons"
    ]
  };
  const [placeholderText, setPlaceholderText] = useState('');
  const [promptIndex, setPromptIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [typingSpeed, setTypingSpeed] = useState(60);
  const [showCursor, setShowCursor] = useState(true);

  // Typewriter Effect Logic
  useEffect(() => {
    // Determine the text to display for the current prompt
    const currentPrompts = MODE_PROMPTS[searchMode] || MODE_PROMPTS.web;
    const currentPrompt = currentPrompts[promptIndex];

    const handleTyping = () => {
      setPlaceholderText((prev) =>
        isDeleting
          ? currentPrompt.substring(0, prev.length - 1)
          : currentPrompt.substring(0, prev.length + 1)
      );

      // Typing speed variation (40% faster)
      setTypingSpeed(isDeleting ? 24 : 60);

      // If finished typing
      if (!isDeleting && placeholderText === currentPrompt) {
        setTypingSpeed(2500); // Pause before deleting
        setIsDeleting(true);
      }
      // If finished deleting
      else if (isDeleting && placeholderText === '') {
        setIsDeleting(false);
        setPromptIndex((prevIndex) => (prevIndex + 1) % currentPrompts.length);
        setTypingSpeed(400); // Pause before typing next word
      }
    };

    const timer = setTimeout(handleTyping, typingSpeed);
    return () => clearTimeout(timer);
  }, [placeholderText, isDeleting, promptIndex, typingSpeed, searchMode, MODE_PROMPTS]);

  // Reset typewriter when search mode changes
  useEffect(() => {
    setPlaceholderText('');
    setPromptIndex(0);
    setIsDeleting(false);
    setTypingSpeed(60);
  }, [searchMode]);

  // Cursor blink effect when paused
  useEffect(() => {
    if (typingSpeed > 100) { // Only blink when paused (typingSpeed > normal typing speed)
      const cursorTimer = setInterval(() => {
        setShowCursor((prev) => !prev);
      }, 500);
      return () => clearInterval(cursorTimer);
    } else {
      setShowCursor(true); // Always show cursor while actively typing/deleting
    }
  }, [typingSpeed]);

  const iconRefs = {
    dice: useRef(null)
  };
  const dropdownRef = useRef(null);
  const colorPickerRef = useRef(null);
  const searchBarRef = useRef(null);

  const industryOptions = [
    'Fashion', 'Health', 'SaaS', 'Technology', 'Food',
    'Real Estate', 'Education', 'Finance', 'E-commerce', 'Travel'
  ];

  const styleOptions = [
    'Minimalist', 'Modern', 'Futuristic', 'Playful', 'Elegant',
    'Vintage', 'Corporate', 'Bold', 'Luxury', 'Organic'
  ];

  const typographyOptions = [
    'Serif', 'Sans-serif', 'Hand-written', 'Display', 'Monospace',
    'Slab Serif', 'Script', 'Decorative', 'Geometric', 'Humanist'
  ];



  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        !Object.values(iconRefs).some(ref =>
          ref.current && ref.current.contains(event.target)
        ) &&
        !(activeDropdown === 'color' && colorPickerRef.current && colorPickerRef.current.contains(event.target))
      ) {
        setActiveDropdown(null);
      }
    }

    if (activeDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [activeDropdown]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape' && activeDropdown) {
        setActiveDropdown(null);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeDropdown]);

  const toggleDropdown = (type) => {
    if (activeDropdown === type) {
      setActiveDropdown(null);
      return;
    }

    const searchBar = searchBarRef.current;
    if (!searchBar) return;

    const rect = searchBar.getBoundingClientRect();

    if (position === 'bottom') {
      setDropdownPosition({
        bottom: window.innerHeight - rect.top + 5,
        left: rect.left,
        width: rect.width,
        position: 'fixed'
      });
    } else {
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 5,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }

    setActiveDropdown(type);
  };

  const selectOption = (type, value) => {
    switch (type) {
      case 'industry':
        setSearchParams(prev => ({ ...prev, industry: value }));
        break;
      case 'style':
        setSearchParams(prev => ({ ...prev, designStyle: value }));
        break;
      case 'typography':
        setSearchParams(prev => ({ ...prev, font: value }));
        break;
      default:
        break;
    }
    setActiveDropdown(null);
  };

  const handleColorChange = (updatedColor) => {
    setColor(updatedColor.hex);
    setSearchParams(prev => ({ ...prev, color: updatedColor.hex }));
  };

  const toggleAI = () => {
    setSearchParams(prev => ({
      ...prev,
      ai: prev.ai === 'true' ? 'false' : 'true'
    }));
  };

  const SEARCH_MODES = [
    { id: 'web', label: 'Websites', tooltip: 'Search for landing pages, websites, and new trending website components', image: '/mode-websites.jpeg' },
    { id: 'icon', label: 'Icons', tooltip: 'Search for icons with editable and downloadable formats', image: '/mode-icons.jpeg' }
  ];

  const handleSubmit = (e) => {
    e.preventDefault();

    const hasFilters = searchParams.industry || searchParams.designStyle || searchParams.font || searchParams.color;
    if (!searchQuery.trim() && !hasFilters) return;

    onSearch?.({
      ...searchParams,
      q: searchQuery,
      searchMode,
    });
    setSearchQuery('');
  };

  const handleRandomClick = (e) => {
    e.preventDefault();
    onRandomInspiration?.({ ...searchParams, searchMode });
  };

  const customPickerStyle = {
    default: {
      box: {
        boxShadow: 'none',
        border: 'none'
      },
      picker: {
        boxShadow: 'none',
        borderRadius: '8px',
        background: 'white'
      }
    }
  };

  const containerClass = position === 'bottom' ? 'search-container-bottom' : position === 'header' ? 'search-container-header' : 'search-container';
  const contentClass = position === 'bottom' ? 'search-content-bottom' : position === 'header' ? 'search-content-header' : 'first-design-content';

  const filtersActive = searchParams.industry || searchParams.designStyle || searchParams.font || searchParams.color;
  const hasSearchQuery = searchQuery.trim() !== '';
  const shouldShowSurpriseButton = !(filtersActive || hasSearchQuery);

  return (
    <div className={contentClass} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
      {showWelcomeText && position === 'center' && (
        <div className="agentic-premium-hero" style={{ margin: 0, paddingTop: '16px', minHeight: 'unset', justifyContent: 'flex-start', gap: '12px', zIndex: 'unset', position: 'static' }}>
          <h1 className="agentic-premium-title">One place for all your <br />design <span className="magic-text">inspiration.</span></h1>
          <p className="agentic-premium-subtitle">Search inspiration, icons, UI screens, and web designs.<br />Save to moodboards and Collaborate in real time.</p>
        </div>
      )}

      <div className={containerClass} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
        <form onSubmit={handleSubmit} className="search-form">
          <div className={`search-bar ${searchBarExpanded ? 'expanded' : ''} ${searchQuery.trim().length > 0 ? 'is-typing' : ''}`} ref={searchBarRef}>
            {/* Liquid glass animated blobs — only for center position */}
            {position !== 'bottom' && (
              <>
                <style>{`
                  @keyframes liquidFloat1 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(15px, -10px) scale(1.05); }
                    66% { transform: translate(-10px, 8px) scale(0.95); }
                  }
                  @keyframes liquidFloat2 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    33% { transform: translate(-12px, 10px) scale(1.08); }
                    66% { transform: translate(8px, -6px) scale(0.92); }
                  }
                  @keyframes liquidFloat3 {
                    0%, 100% { transform: translate(0, 0) scale(1); }
                    50% { transform: translate(10px, 12px) scale(1.1); }
                  }
                `}</style>
                <div className="liquid-blobs-container">
                  <div className="liquid-blob blob-1" />
                  <div className="liquid-blob blob-2" />
                  <div className="liquid-blob blob-3" />
                </div>
              </>
            )}
            {position !== 'bottom' && (
              isMobile ? (
                // ── MOBILE: Compact dropdown (≤768px) ──
                <div className="search-mode-mobile-dropdown">
                  <select
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value)}
                    aria-label="Search mode"
                  >
                    {SEARCH_MODES.map(mode => (
                      <option key={mode.id} value={mode.id}>{mode.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="mobile-dropdown-chevron" aria-hidden="true" />
                </div>
              ) : (
                // ── DESKTOP: Existing pill tabs (>768px) ──
                <div className="search-mode-toggle">
                  {SEARCH_MODES.map(mode => (
                    <div key={mode.id} className="mode-btn-wrapper">
                      <button
                        type="button"
                        className={`mode-btn ${searchMode === mode.id ? 'active' : ''}`}
                        aria-pressed={searchMode === mode.id}
                        onClick={() => setSearchMode(mode.id)}
                      >
                        {mode.label}
                      </button>
                      <div className="tooltip tooltip-with-image">
                        <img src={mode.image} alt={mode.label} className="tooltip-preview-img" loading="lazy" />
                        <span className="tooltip-text">{mode.tooltip}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            <div style={{ display: 'flex' }}>
              <input
                type="text"
                placeholder={position === 'bottom' ? "Continue your search..." : `${placeholderText}${showCursor ? '|' : ''}`}
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search query"
              />



              <button
                type="submit"
                className="search-button"
                disabled={loading || !searchQuery.trim()}
                aria-label="Search"
              >
                {loading ? (
                  <div className="skeleton-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <img src="/Arrow.svg" alt="Search" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {activeDropdown && (
        <div
          className="dropdown"
          style={{
            ...(position === 'bottom' ? {
              bottom: activeDropdown === 'industry' ? 'calc(145px)' :
                activeDropdown === 'style' ? 'calc(145px)' :
                  activeDropdown === 'typography' ? 'calc(145px)' :
                    activeDropdown === 'color' ? 'calc(143px)' : 'calc(143px)',

              left: activeDropdown === 'color' ? 'calc(600px)' : dropdownPosition.left,
              position: 'fixed',
              width: dropdownPosition.width,
              marginTop: '-2px'
            } : {
              top: `calc(${dropdownPosition.top}px - 2px)`,
              left: dropdownPosition.left,
              position: 'fixed',
              width: dropdownPosition.width,
              marginBottom: '-2px'
            })
          }}
          ref={dropdownRef}
          role="menu"
        >
          {activeDropdown === 'industry' && (
            <>
              {industryOptions.map((option) => (
                <div
                  key={option}
                  className={`dropdown-item ${searchParams.industry === option ? 'selected' : ''}`}
                  onClick={() => selectOption('industry', option)}
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      selectOption('industry', option);
                    }
                  }}
                >
                  {option}
                </div>
              ))}
            </>
          )}

          {activeDropdown === 'style' && (
            <>
              {styleOptions.map((option) => (
                <div
                  key={option}
                  className={`dropdown-item ${searchParams.designStyle === option ? 'selected' : ''}`}
                  onClick={() => selectOption('style', option)}
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      selectOption('style', option);
                    }
                  }}
                >
                  {option}
                </div>
              ))}
            </>
          )}

          {activeDropdown === 'typography' && (
            <>
              {typographyOptions.map((option) => (
                <div
                  key={option}
                  className={`dropdown-item ${searchParams.font === option ? 'selected' : ''}`}
                  onClick={() => selectOption('typography', option)}
                  role="menuitem"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      selectOption('typography', option);
                    }
                  }}
                >
                  {option}
                </div>
              ))}
            </>
          )}

          {activeDropdown === 'color' && (
            <div className="color-picker-container" ref={colorPickerRef}>
              <SketchPicker
                color={color}
                onChange={handleColorChange}
                styles={customPickerStyle}
              />
              <button
                className="clear-color-btn"
                onClick={() => {
                  setColor('#000000');
                  setSearchParams(prev => ({ ...prev, color: '' }));
                  setActiveDropdown(null);
                }}
              >
                Clear Color
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
