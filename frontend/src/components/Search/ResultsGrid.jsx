import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { localRecommendationEngine } from '../../services/localRecommendationEngine';
import MoodboardService from '../../services/MoodboardService';
import { auth } from '../../firebase';
import AISuggestions from './AISuggestions';
import IconCustomizer from './IconCustomizer';

import BrandProfileCard from './BrandProfileCard';
import TrendList from './TrendList';
import UIScreenPanel from './UIScreenPanel';
import WebsiteDetailPopup from './WebsiteDetailPopup';
import SaveToBoardPicker from './SaveToBoardPicker';
import '../../styles/MainScreen.css';
import '../../styles/ImageView.css';
import '../../styles/UIScreenPanel.css';
import '../../styles/BrandScanner.css'; // For the scanning loader visuals
import { useAuth } from '../../context/AuthContext';
import PricingModal from '../PricingModal';

const ResultsGrid = ({
  results,
  iconResults = [],

  logoResults = null,
  loading,
  colorPalette,
  heading,
  params,
  query,
  aiSuggestions,
  onLoadMore,
  onViewMoodboard,
  onCustomizerStateChange // ADDED props
}) => {
  const navigate = useNavigate();
  const [loadingMore, setLoadingMore] = useState(false);
  const [moodboardImages, setMoodboardImages] = useState([]);
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [selectedIndexMap, setSelectedIndexMap] = useState({});
  const [allResults, setAllResults] = useState([]);
  const [panelImage, setPanelImage] = useState(null); // active UI screen in side panel
  const [websiteDetailImage, setWebsiteDetailImage] = useState(null); // active website detail popup



  // Add notification timeout state
  const [showAddedNotification, setShowAddedNotification] = useState(false);
  const [addedImageTitle, setAddedImageTitle] = useState('');
  const [notificationTimeout, setNotificationTimeout] = useState(null);
  const [activeIconCustomizer, setActiveIconCustomizer] = useState(null);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pickerOpenFor, setPickerOpenFor] = useState(null); // { image, index, anchorEl } when picker is open
  const pickerAnchorRef = useRef(null);
  const { userData, userQuota } = useAuth();

  // ── Cached boards: fetch once, reuse across all picker opens ──
  const [cachedBoards, setCachedBoards] = useState(null); // null = not fetched yet
  useEffect(() => {
    if (!auth.currentUser) return;
    MoodboardService.getUserSharedMoodboards()
      .then(res => {
        const sorted = (res.moodboards || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setCachedBoards(sorted);
      })
      .catch(err => console.error('Pre-fetch boards failed:', err));
  }, []);

  // Load saved moodboard from localStorage
  useEffect(() => {
    const savedMoodboard = localStorage.getItem('moodboardImages');
    if (savedMoodboard) {
      try {
        const parsed = JSON.parse(savedMoodboard);
        setMoodboardImages(parsed);

        // Update the selection state if we have results
        if (allResults.length > 0) {
          updateSelectionState(allResults, parsed);
        }
      } catch (e) {
        console.error('Error loading saved moodboard:', e);
      }
    }
  }, []);

  // Update selection state when moodboard changes
  useEffect(() => {
    if (allResults.length > 0) {
      updateSelectionState(allResults, moodboardImages);
    }
  }, [moodboardImages, allResults]);

  // Cleanup timeout on component unmount
  useEffect(() => {
    return () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }
    };
  }, [notificationTimeout]);

  // Sync customizer status with parent (MainScreen) to hide search bar
  useEffect(() => {
    if (onCustomizerStateChange) {
      onCustomizerStateChange(!!activeIconCustomizer);
    }
  }, [activeIconCustomizer, onCustomizerStateChange]);

  // Analyze dataset when results change (for debugging) - Updated for Improved Design Engine
  useEffect(() => {
    if (allResults.length > 0) {
    }
  }, [allResults]);

  const updateSelectedMapFromMoodboard = useCallback((moodboardItems, currentResults) => {
    if (!Array.isArray(moodboardItems) || !Array.isArray(currentResults)) return;

    const newSelectedMap = {};

    // For each result in the current results
    currentResults.forEach((result, index) => {
      // Check if this result's image URL exists in the moodboard
      const moodboardMatch = moodboardItems.find(moodboardItem => {
        // First try to match by ID if available
        if (result.id && moodboardItem.id) {
          return result.id === moodboardItem.id;
        }

        // If no ID or ID doesn't match, try to match by image URL and a second attribute
        return moodboardItem.image === result.image &&
          // Add some other unique attribute if available
          ((result.title && moodboardItem.title && result.title === moodboardItem.title) ||
            (result.source && moodboardItem.source && result.source === moodboardItem.source));
      });

      if (moodboardMatch) {
        newSelectedMap[index] = true;
      }
    });

    setSelectedIndexMap(newSelectedMap);
  }, []);

  // Helper function to update the selection state based on moodboard contents
  const updateSelectionState = useCallback((currentResults, moodboardItems) => {
    const newSelectedMap = {};

    // Check which of the current results are in the moodboard
    currentResults.forEach((result, index) => {
      // Try to find this result in the moodboard
      const isInMoodboard = moodboardItems.some(moodboardItem =>
        moodboardItem._internalId === result._internalId
      );

      if (isInMoodboard) {
        newSelectedMap[index] = true;
      }
    });

    setSelectedIndexMap(newSelectedMap);
  }, []);

  // Listen for moodboard updates from other components
  useEffect(() => {
    const handleMoodboardUpdate = () => {
      const savedMoodboard = localStorage.getItem('moodboardImages');
      if (savedMoodboard) {
        try {
          const parsed = JSON.parse(savedMoodboard);
          setMoodboardImages(parsed);

          // Update selection state based on current results and updated moodboard
          if (allResults.length > 0) {
            updateSelectionState(allResults, parsed);
          }
        } catch (e) {
          console.error('Error loading updated moodboard:', e);
        }
      }
    };

    window.addEventListener('moodboardUpdate', handleMoodboardUpdate);

    return () => {
      window.removeEventListener('moodboardUpdate', handleMoodboardUpdate);
    };
  }, [allResults]);


  useEffect(() => {
    if (results && Array.isArray(results)) {
      const resultsWithIds = results.map((item, idx) => {
        if (!item._internalId) {
          return {
            ...item,
            _internalId: `result-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 9)}`
          };
        }
        return item;
      });

      // Rearrange results based on filters
      const sortedResults = [...resultsWithIds].sort((a, b) => {
        // Priority scoring system
        let scoreA = 0;
        let scoreB = 0;

        // Check industry match
        if (params?.industry) {
          if (a.industry && a.industry.toLowerCase() === params.industry.toLowerCase()) scoreA += 3;
          if (b.industry && b.industry.toLowerCase() === params.industry.toLowerCase()) scoreB += 3;
        }

        // Check style match
        if (params?.designStyle) {
          if (a.style && a.style.toLowerCase() === params.designStyle.toLowerCase()) scoreA += 2;
          if (b.style && b.style.toLowerCase() === params.designStyle.toLowerCase()) scoreB += 2;
        }

        // Check color match
        if (params?.color) {
          if (a.color && a.color.toLowerCase() === params.color.toLowerCase()) scoreA += 1;
          if (b.color && b.color.toLowerCase() === params.color.toLowerCase()) scoreB += 1;
        }
        return scoreB - scoreA;
      });

      setAllResults(sortedResults);

      updateSelectionState(sortedResults, moodboardImages);
    }
  }, [results, params]);

  const showNotificationWithTimeout = (title, duration = 5000) => {
    // Clear any existing timeout first
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
    }

    // Show the notification
    setAddedImageTitle(title);
    setShowAddedNotification(true);

    // Set new timeout
    const newTimeout = setTimeout(() => {
      setShowAddedNotification(false);
      setNotificationTimeout(null);
    }, duration);

    setNotificationTimeout(newTimeout);
  };

  // Function to hide notification immediately
  const hideNotification = () => {
    if (notificationTimeout) {
      clearTimeout(notificationTimeout);
      setNotificationTimeout(null);
    }
    setShowAddedNotification(false);
  };

  const toggleMoodboardSelection = (image, index, e) => {
    if (e) e.stopPropagation();
    const isSelected = selectedIndexMap[index] === true;

    if (isSelected) {
      const updatedMoodboard = moodboardImages.filter(item =>
        item._internalId !== image._internalId
      );
      setMoodboardImages(updatedMoodboard);

      localStorage.setItem('moodboardImages', JSON.stringify(updatedMoodboard));

      const newSelectedMap = { ...selectedIndexMap };
      delete newSelectedMap[index];
      setSelectedIndexMap(newSelectedMap);

      const event = new CustomEvent('moodboardUpdate', {
        detail: { count: updatedMoodboard.length }
      });
      window.dispatchEvent(event);

      // Show removed notification
      showNotificationWithTimeout(`Removed "${image.title || 'Design inspiration'}"`);

    } else {
      // Check moodboard image limit
      const currentLimit = userQuota?.maxImagesPerMoodboard || Infinity;
      if (moodboardImages.length >= currentLimit) {
        setShowPricingModal(true);
        return;
      }

      // Add to moodboard immediately with timestamp
      const imageWithTime = { ...image, addedAt: new Date().toISOString() };
      const updatedMoodboard = [...moodboardImages, imageWithTime];
      setMoodboardImages(updatedMoodboard);

      // Save to localStorage immediately
      localStorage.setItem('moodboardImages', JSON.stringify(updatedMoodboard));

      // Update selected map
      setSelectedIndexMap({
        ...selectedIndexMap,
        [index]: true
      });

      // Show "Added to Moodboard" notification with proper timeout management
      showNotificationWithTimeout(`Added "${image.title || 'Design inspiration'}"`);

      // Create a custom event to notify other components
      const event = new CustomEvent('moodboardUpdate', {
        detail: { count: updatedMoodboard.length }
      });
      window.dispatchEvent(event);
    }
  };

  // Navigate to moodboard view
  const handleViewMoodboard = () => {
    if (onViewMoodboard && typeof onViewMoodboard === 'function') {
      onViewMoodboard();
    }
    hideNotification(); // Hide notification when navigating
  };

  // Handle "Load More" button click
  const handleLoadMore = async () => {
    if (onLoadMore && !loadingMore) {
      setLoadingMore(true);
      try {
        await onLoadMore();
      } catch (error) {
        console.error('Error loading more results:', error);
      } finally {
        setLoadingMore(false);
      }
    }
  };

  // Handle visit source click
  const handleVisitSource = (url, e) => {
    e.stopPropagation();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // For UI screen results → open side panel. Otherwise navigate to /details.
  const handleImageClick = (image, e) => {
    if (e.target.closest('.moodboard-selection-button') ||
      e.target.closest('.visit-source-button')) return;

    // Route to the correct detail view based on result type
    if (image.isWebsiteResult) {
      // Lapa Ninja / Land-book website results → popup with zoom & metadata
      setWebsiteDetailImage(image);
    } else if (image.siteName) {
      // UI screen results → side panel
      setPanelImage(image);
    } else {
      // General results → full details page
      navigate('/details', { state: { image, allResults } });
    }
  };

  const handlePanelSave = (image, clickEvent) => {
    const syntheticIdx = allResults.findIndex(r => r._internalId === image._internalId);
    // Check if already selected — if so, remove it
    if (selectedIndexMap[syntheticIdx]) {
      const fakeEvent = { stopPropagation: () => { } };
      toggleMoodboardSelection(image, syntheticIdx, fakeEvent);
    } else {
      // Capture the button element for positioning the popover
      if (clickEvent?.currentTarget) {
        pickerAnchorRef.current = clickEvent.currentTarget;
      }
      // Open the board picker
      setPickerOpenFor({ image, index: syntheticIdx !== -1 ? syntheticIdx : `panel-${Date.now()}` });
    }
  };

  const handlePanelVisit = (url) => url && window.open(url, '_blank', 'noopener,noreferrer');


  // Handle loading state
  if (loading && (!results || !results.length)) {
    return (
      <div className="loader-overlay-container" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div className="scanning-visuals" style={{ transform: 'scale(0.8)', marginBottom: '24px' }}>
          <div className="scanning-ring" style={{ borderColor: 'rgba(139, 92, 246, 0.2)' }}></div>
          <div className="scanning-ring-inner" style={{ borderColor: 'rgba(139, 92, 246, 0.4)' }}></div>
          <div className="scanning-core" style={{ background: '#8b5cf6' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="scanning-beam" style={{ background: 'conic-gradient(from 0deg, transparent 0%, rgba(139, 92, 246, 0.2) 20%, transparent 60%)' }}></div>
        </div>

        <div className="scanning-status" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '8px', color: '#1f2937' }}>Thinking & Collecting</h3>
          <div className="scanning-progress-text" style={{ color: '#6b7280', fontSize: '0.95rem' }}>Curating the best design inspiration for your query...</div>
        </div>

        {/* We keep a subtle skeleton below as background context */}
        <div className="skeleton-container" style={{ opacity: 0.3, pointerEvents: 'none', marginTop: '40px', width: '100%', maxWidth: '1200px' }}>
          <div className="skeleton-grid">
            {Array(8).fill().map((_, index) => (
              <div key={`skeleton-${index}`} className="skeleton-item" style={{ height: '200px' }}>
                <div className="skeleton-image"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Handle no results state — only show if BOTH images, icons are empty
  const hasImages = results && Array.isArray(results) && results.length > 0;
  const hasIcons = iconResults && Array.isArray(iconResults) && iconResults.length > 0;
  const hasLogos = logoResults !== null && logoResults !== undefined;

  if (!hasImages && !hasIcons && !hasLogos) {
    return (
      <div className="no-results">
        <h3>No design inspiration found</h3>
        <p>Try adjusting your search terms or parameters.</p>
      </div>
    );
  }

  return (
    <div className="full-container">
      {/* Brand & Logo Trends Section */}
      {hasLogos && logoResults.type === 'brand' && (
        <BrandProfileCard data={logoResults.data} />
      )}

      {hasLogos && logoResults.type === 'trend' && (
        <TrendList data={logoResults.data} />
      )}



      {/* Icon Grid — Smaller tiles for icon results */}
      {iconResults && iconResults.length > 0 && (
        <div className="icon-results-section">
          <div className="icon-results-header">
            <span className="icon-results-label">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              {iconResults.length} Icons Found
            </span>
          </div>
          <div className="icon-grid">
            {iconResults.map((icon, idx) => {
              const isSelected = moodboardImages.some(m => m.image === icon.image);
              return (
                <div
                  key={`icon-${idx}`}
                  className={`icon-tile ${isSelected ? 'icon-tile-selected' : ''}`}
                  onMouseEnter={() => setHoveredIndex(`icon-${idx}`)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  onClick={() => {
                    if (icon.editable) {
                      setActiveIconCustomizer(icon);
                    }
                  }}
                  style={{ cursor: icon.editable ? 'pointer' : 'default' }}
                >
                  <div className="icon-tile-preview">
                    <img
                      src={icon.image}
                      alt={icon.title || 'Icon'}
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/image-placeholder.svg';
                      }}
                    />
                    {/* Hover overlay */}
                    {hoveredIndex === `icon-${idx}` && (
                      <div className="icon-tile-overlay">
                        <button
                          className={`icon-add-btn ${isSelected ? 'selected' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              toggleMoodboardSelection(icon, `icon-${idx}`, e);
                            } else {
                              pickerAnchorRef.current = e.currentTarget;
                              setPickerOpenFor({ image: icon, index: `icon-${idx}` });
                            }
                          }}
                          title={isSelected ? 'Remove from moodboard' : 'Save to board'}
                        >
                          {isSelected ? '✓' : '+'}
                        </button>
                        {icon.url && (
                          <button
                            className="icon-source-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVisitSource(icon.url, e);
                            }}
                            title="Visit Source"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15,3 21,3 21,9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="icon-tile-info">
                    <span className="icon-tile-name">{icon.title || 'Icon'}</span>
                    <div className="icon-tile-meta-row">
                      <span className="icon-tile-source">{icon.iconMeta?.collection || icon.source}</span>
                      {icon.editable && (
                        <span className="icon-editable-tag">Editable</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Icon Customizer Panel */}
      {activeIconCustomizer && (
        <IconCustomizer
          icon={activeIconCustomizer}
          onClose={() => {
            setActiveIconCustomizer(null);
          }}
          onAddToMoodboard={(customizedIcon) => {
            toggleMoodboardSelection(customizedIcon, `icon-custom-${Date.now()}`);
            setActiveIconCustomizer(null);
          }}
        />
      )}

      {/* Results in masonry grid — only render if there are image results */}
      {hasImages && (
        <div>
          <div className="categorized-results-container">
            <div className="masonry-grid">
              {allResults.filter(item => item.image && item.image.trim() !== '').map((item, index) => {
                const isSelected = selectedIndexMap[index] === true;
                const isHovered = hoveredIndex === index;

                return (
                  <div
                    key={`image-${index}`}
                    className="masonry-item"
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    data-index={index}
                  >
                    <div
                      className={`masonry-image-container ${isSelected ? 'selected-for-moodboard' : ''}`}
                      onClick={(e) => handleImageClick(item, e)}
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src={item.image}
                        alt={item.title || 'Design inspiration'}
                        className="masonry-image"
                        itemProp="image"
                        onError={(e) => {
                          const src = e.target.src;
                          // Pinterest high-res fallback chain
                          if (src.includes('/originals/')) {
                            e.target.src = src.replace('/originals/', '/736x/');
                          } else if (src.includes('/736x/')) {
                            e.target.src = src.replace('/736x/', '/564x/');
                          } else {
                            // Final fallback: hide the whole card silently
                            e.target.onerror = null;
                            const card = e.target.closest('.masonry-item');
                            if (card) card.style.display = 'none';
                          }
                        }}
                      />

                      {/* Hover overlay with buttons */}
                      {isHovered && (
                        <div className="image-hover-overlay">
                          {/* Moodboard Selection Button - Top */}
                          <button
                            className={`moodboard-selection-button ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isSelected) {
                                toggleMoodboardSelection(item, index, e);
                              } else {
                                pickerAnchorRef.current = e.currentTarget;
                                setPickerOpenFor({ image: item, index });
                              }
                            }}
                            title={isSelected ? "Remove from moodboard" : "Save to board"}
                            aria-label={isSelected ? "Remove from moodboard" : "Save to board"}
                          >
                            {isSelected ? '✓' : '+ Save'}
                          </button>

                          {/* Visit Source Button - Bottom */}
                          {item.url && (
                            <button
                              className="visit-source-button"
                              onClick={(e) => handleVisitSource(item.url, e)}
                              title="Visit Source"
                              aria-label="Visit Source"
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                <polyline points="15,3 21,3 21,9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                              Visit Source
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                    {/* Card footer — favicon + app name for UI results, plain title otherwise */}
                    {item.siteName ? (
                      <div className="masonry-info masonry-info-ui">
                        <div className="masonry-ui-footer">
                          <img
                            className="masonry-ui-favicon"
                            src={`https://www.google.com/s2/favicons?domain=${item.siteDomain || item.siteName.toLowerCase().replace(/\s/g, '') + '.com'}&sz=32`}
                            alt={item.siteName}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <span className="masonry-ui-appname">{item.siteName}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="masonry-info">
                        <h4>{item.title || 'Design Inspiration'}</h4>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Load More Button */}
          <div className="load-more-container">
            <button
              className="load-more-button"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <>
                  <div className="skeleton-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  Loading More...
                </>
              ) : (
                'Show More'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Simple notification - 5 seconds auto-disappear */}
      {showAddedNotification && (
        <div className="added-notification">
          <div className="added-notification-content">
            <div className="added-notification-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div className="added-notification-text">
              <span className="added-notification-title">
                {addedImageTitle.includes('Added') ? 'Added to Moodboard' : 'Removed from Moodboard'}
              </span>
              <span className="added-notification-subtitle">
                {addedImageTitle.replace(/^(Added|Removed) "/, '').replace(/"$/, '')}
              </span>
            </div>
            <button className="view-moodboard-notification-button" onClick={handleViewMoodboard}>
              View
            </button>
          </div>
        </div>
      )}

      {aiSuggestions && (
        <AISuggestions
          aiSuggestions={aiSuggestions}
          colorPalette={colorPalette}
        />
      )}

      {/* UI Screen Side Panel */}
      {panelImage && (
        <UIScreenPanel
          image={panelImage}
          allResults={allResults}
          isSelected={!!moodboardImages.find(m => m._internalId === panelImage._internalId)}
          onClose={() => setPanelImage(null)}
          onSave={handlePanelSave}
          onVisit={handlePanelVisit}
          onSelectRelated={(relatedImage) => setPanelImage(relatedImage)}
        />
      )}

      {/* Website Detail Popup (Lapa/Landbook) */}
      {websiteDetailImage && (
        <WebsiteDetailPopup
          image={websiteDetailImage}
          isSelected={!!moodboardImages.find(m => m._internalId === websiteDetailImage._internalId)}
          onClose={() => setWebsiteDetailImage(null)}
          onSave={(img, clickEvent) => {
            const syntheticIdx = allResults.findIndex(r => r._internalId === img._internalId);
            if (selectedIndexMap[syntheticIdx]) {
              const fakeEvent = { stopPropagation: () => { } };
              toggleMoodboardSelection(img, syntheticIdx, fakeEvent);
            } else {
              if (clickEvent?.currentTarget) {
                pickerAnchorRef.current = clickEvent.currentTarget;
              }
              setPickerOpenFor({ image: img, index: syntheticIdx !== -1 ? syntheticIdx : `website-${Date.now()}` });
            }
          }}
        />
      )}

      {/* Single board picker rendered via portal */}
      {pickerOpenFor && (
        <SaveToBoardPicker
          image={pickerOpenFor.image}
          moodboardImages={moodboardImages}
          setMoodboardImages={setMoodboardImages}
          anchorRef={pickerAnchorRef}
          cachedBoards={cachedBoards}
          onBoardsCacheUpdate={setCachedBoards}
          onSaved={(boardName) => {
            const idx = pickerOpenFor.index;
            setPickerOpenFor(null);
            setSelectedIndexMap(prev => ({ ...prev, [idx]: true }));
            showNotificationWithTimeout(`Saved to "${boardName}"`);
          }}
          onClose={() => setPickerOpenFor(null)}
        />
      )}

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={userData?.role || 'free'}
      />
    </div>
  );
};

export default ResultsGrid;
