import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/MoodboardPreview.css';
import { Share2, Save, ExternalLink, Calendar, User, Maximize, Users, RotateCw } from 'lucide-react';
import MoodboardService from '../../services/MoodboardService';
import { auth } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import PricingModal from '../PricingModal';
import UpgradePromptModal from '../UpgradePromptModal';
import { Crown } from 'lucide-react';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from '../Scanner/ScannerNodes';
import '../../styles/BrandScanner.css'; // Requires the scanner CSS for custom node styling
const MoodboardPreviewPage = ({ onBackToResults, moodboardView, setMoodboardView }) => {
  const [selectedImages, setSelectedImages] = useState([]);
  const [isSharing, setIsSharing] = useState(false);
  const [shareableLink, setShareableLink] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [isViewingShared, setIsViewingShared] = useState(false);
  const [sharedTitle, setSharedTitle] = useState('');
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  // New state for image overlay
  const [overlayImage, setOverlayImage] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [isSavingCollection, setIsSavingCollection] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState({ title: '', message: '' });
  const { userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();


  const MOODBOARD_STORAGE_KEY = 'moodboardImages';

  // Feature Access & Limits Logic
  const userRole = userData?.role || 'free';
  const usageStats = userData?.usageStats || {};

  const canShare = ['lite', 'lite_annual', 'freelancer', 'freelancer_annual', 'solo', 'solo_annual', 'team', 'team_annual', 'lifetime', 'admin'].includes(userRole);
  const canLiveCollab = ['lite', 'lite_annual', 'freelancer', 'freelancer_annual', 'solo', 'solo_annual', 'team', 'team_annual', 'lifetime', 'admin'].includes(userRole);

  // Limit checks for Lite tier
  const shareLinksUsed = usageStats.shareLinks?.used || 0;
  const hasReachedShareLimit = ['lite', 'lite_annual'].includes(userRole) && shareLinksUsed >= 3;


  useEffect(() => {
    // Check URL for share code
    const urlParams = new URLSearchParams(location.search);
    const shareCodeParam = urlParams.get('share');

    if (shareCodeParam) {
      setIsViewingShared(true);
      fetchSharedMoodboard(shareCodeParam);
    } else {
      // Load the main moodboard data
      loadMoodboardData();
    }
  }, [location]);

  // Simplified auth change handler - no more clearing on auth changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      // Only reload if not viewing shared and data hasn't been loaded yet
      if (!isViewingShared && selectedImages.length === 0) {
        loadMoodboardData();
      }
    });

    return () => unsubscribe();
  }, [isViewingShared, selectedImages.length]);

  // Handle explicit logout - only clear UI state, keep localStorage
  useEffect(() => {
    const handleLogout = () => {
      if (!isViewingShared) {
        // Only clear the UI state, don't touch localStorage
      }
    };

    window.addEventListener('userLoggedOut', handleLogout);
    return () => window.removeEventListener('userLoggedOut', handleLogout);
  }, [isViewingShared]);

  // Simplified data loading - single source of truth
  const loadMoodboardData = () => {
    try {
      const savedData = localStorage.getItem(MOODBOARD_STORAGE_KEY);

      if (savedData) {
        const parsedData = JSON.parse(savedData);
        setSelectedImages(parsedData);
      } else {

        setSelectedImages([]);
      }
    } catch (e) {
      console.error('Error loading moodboard data:', e);
      setSelectedImages([]);
    }
  };

  // Simplified save - single storage location
  const saveMoodboardData = (images) => {
    if (isViewingShared) return; // Don't save if viewing shared

    try {
      localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(images));

      // Trigger update event with proper counter
      window.dispatchEvent(new CustomEvent('moodboardUpdate', {
        detail: { count: images.length }
      }));

    } catch (e) {
      console.error('Error saving moodboard data:', e);
    }
  };

  // Fetch a shared moodboard by code
  const fetchSharedMoodboard = async (code) => {
    try {
      const data = await MoodboardService.getSharedMoodboard(code);
      setSelectedImages(data.images);
      setSharedTitle(data.title);
    } catch (error) {
      console.error('Error fetching shared moodboard:', error);
      setShareStatus('error');
    }
  };

  // Remove image from the moodboard
  const removeImage = (removeIndex) => {
    if (isViewingShared) return; // Can't modify shared moodboards

    const updated = selectedImages.filter((_, idx) => idx !== removeIndex);
    setSelectedImages(updated);
    saveMoodboardData(updated);
  };

  // Listen for moodboard updates from other components
  useEffect(() => {
    const handleUpdateEvent = (event) => {
      if (!isViewingShared) {
        // Reload data to stay in sync
        loadMoodboardData();
      }
    };

    window.addEventListener('moodboardUpdate', handleUpdateEvent);
    return () => window.removeEventListener('moodboardUpdate', handleUpdateEvent);
  }, [isViewingShared]);

  // Navigation handler
  const goBack = () => {
    if (isViewingShared) {
      window.location.href = '/';
    } else {
      onBackToResults ? onBackToResults() : window.history.back();
    }
  };

  // Handle Go Live Button Click
  const handleGoLive = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to start a live session');
      return;
    }

    setIsGoingLive(true);
    try {
      // Check if user already has an active session
      const activeSession = await MoodboardService.getActiveCollaborationSession();

      if (activeSession && activeSession.inviteCode) {
        // Ask user if they want to rejoin existing session or create new one
        if (window.confirm(`You have an active live session (${activeSession.inviteCode}). Do you want to rejoin it?\n\nClick OK to rejoin.\nClick Cancel to create a NEW session.`)) {
          navigate(`/live/${activeSession.inviteCode}`);
          setIsGoingLive(false);
          return;
        }
      }
    } catch (error) {
      console.error("Error checking for active session:", error);
    }

    // Create new session
    navigate('/live/new?create=true', {
      state: {
        create: true,
        moodboardData: {
          title: "My Moodboard",
          images: selectedImages
        }
      }
    });
    setIsGoingLive(false);
  };

  // Share the moodboard - Updated to show popup
  const shareMoodboard = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to share moodboards');
      return;
    }

    setIsSharing(true);
    setShareStatus('');
    setCopySuccess(false);

    try {
      const response = await MoodboardService.createShareableMoodboard(selectedImages);
      const shareUrl = `${window.location.origin}/view?code=${response.shareCode}`;
      setShareableLink(shareUrl);
      setShareStatus('success');
      setShowSharePopup(true); // Show the popup
    } catch (error) {
      console.error('Error sharing moodboard:', error);
      if (error.limitReached) {
        setUpgradeMessage({
          title: 'Share Limit Reached',
          message: error.message || 'You have reached your share link limit. Please upgrade your plan to share more.'
        });
        setShowUpgradePrompt(true);
      } else {
        setShareStatus('error');
      }
    } finally {
      setIsSharing(false);
    }
  };

  // Handle Save to Collection
  const handleSaveToCollection = async () => {
    if (!auth.currentUser) {
      alert('Please sign in to save collections');
      return;
    }

    const title = window.prompt('Enter a title for your collection:', 'My Collection');
    if (title === null) return; // Cancelled

    setIsSavingCollection(true);

    try {
      await MoodboardService.saveCollection(selectedImages, title || 'My Collection');
      alert('Collection saved successfully!');
    } catch (error) {
      console.error('Error saving collection:', error);
      if (error.limitReached) {
        setUpgradeMessage({
          title: 'Collection Limit Reached',
          message: error.message || 'You have reached your collection limit. Please upgrade your plan to create more collections.'
        });
        setShowUpgradePrompt(true);
      } else {
        alert('Failed to save collection: ' + error.message);
      }
    } finally {
      setIsSavingCollection(false);
    }
  };

  // Copy link to clipboard - Updated with better feedback
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareableLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // Open link in new tab
  const openInNewTab = () => {
    window.open(shareableLink, '_blank');
  };

  // Close popup
  const closeSharePopup = () => {
    setShowSharePopup(false);
    setCopySuccess(false);
  };

  // Handle image click to open overlay
  const handleImageClick = (image, e) => {
    // Only open overlay if not clicking on remove button
    if (!e.target.closest('.remove-image-button')) {
      const imageData = {
        image: typeof image === 'string' ? image : (image.fullImage || image.image || image.url),
        title: image.title || 'Moodboard Image',
        source: image.source || null,
        url: image.url || null,
        addedAt: image.addedAt || null,
        author: image.author || null,
        width: image.width || null,
        height: image.height || null,
        category: image.category || null,
        snippet: image.snippet || null
      };
      setOverlayImage(imageData);
    }
  };

  // Handle overlay close
  const closeOverlay = () => {
    setOverlayImage(null);
  };

  // Handle overlay background click
  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('image-overlay')) {
      closeOverlay();
    }
  };

  // Handle escape key to close overlay
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && overlayImage) {
        closeOverlay();
      }
    };

    if (overlayImage) {
      document.addEventListener('keydown', handleEscapeKey);
      // Prevent body scroll when overlay is open
      document.body.style.overflow = 'hidden';
      document.body.classList.add('modal-open');
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
      document.body.classList.remove('modal-open');
    };
  }, [overlayImage]);

  // Save shared moodboard to user account
  const saveToMyMoodboards = () => {
    if (!auth.currentUser) {
      alert('Please sign in to save this moodboard');
      return;
    }

    // Get current moodboard and merge with shared images (avoid duplicates)
    const currentMoodboard = JSON.parse(localStorage.getItem(MOODBOARD_STORAGE_KEY) || '[]');

    // Merge images, avoiding duplicates based on image URL or internal ID
    const mergedImages = [...currentMoodboard];

    selectedImages.forEach(sharedImage => {
      const imageUrl = typeof sharedImage === 'string' ? sharedImage : (sharedImage.image || sharedImage.url);
      const exists = mergedImages.some(existing => {
        const existingUrl = typeof existing === 'string' ? existing : (existing.image || existing.url);
        return existingUrl === imageUrl ||
          (sharedImage._internalId && existing._internalId === sharedImage._internalId);
      });

      if (!exists) {
        mergedImages.push(sharedImage);
      }
    });

    saveMoodboardData(mergedImages);
    setSelectedImages(mergedImages); // Update UI to show merged result
    alert('Moodboard saved to your collection!');
  };

  // Empty state - centered empty card
  if (!selectedImages.length) {
    return (
      <div className="moodboard-preview-page">
        <div className="moodboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ margin: 0 }}>Moodboard Preview</h1>
            {!isViewingShared && setMoodboardView && (
              <div className="moodboard-mode-selector" style={{ display: 'flex', gap: '8px', background: '#F3F4F6', padding: '4px', borderRadius: '100px' }}>
                <button
                  onClick={() => setMoodboardView('draft')}
                  style={{
                    background: moodboardView === 'draft' ? '#ffffff' : 'transparent',
                    color: moodboardView === 'draft' ? '#111111' : '#6B7280',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: moodboardView === 'draft' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Preview
                </button>
                <button
                  onClick={() => setMoodboardView('collections')}
                  style={{
                    background: moodboardView === 'collections' ? '#ffffff' : 'transparent',
                    color: moodboardView === 'collections' ? '#111111' : '#6B7280',
                    border: 'none',
                    borderRadius: '100px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    boxShadow: moodboardView === 'collections' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Saved Moodboards
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="moodboard-empty-card-container">
          <div className="moodboard-empty-card">
            <h3>No Inspiration Yet</h3>
            <p>{isViewingShared ? 'This shared moodboard has no images.' : 'Your moodboard waiting to come alive. Start adding visuals that spark your vision.'}</p>
            <button className="back-button-large" onClick={() => navigate('/search')}>
              {isViewingShared ? 'Go to Home' : 'Ask Inspo & Add Inspirations'}
            </button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="moodboard-preview-page">
      <div className="moodboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0 }}>{isViewingShared ? sharedTitle || 'Shared Moodboard' : 'Moodboard Preview'}</h1>
          {!isViewingShared && setMoodboardView && (
            <div className="moodboard-mode-selector" style={{ display: 'flex', gap: '8px', background: '#F3F4F6', padding: '4px', borderRadius: '100px' }}>
              <button
                onClick={() => setMoodboardView('draft')}
                style={{
                  background: moodboardView === 'draft' ? '#ffffff' : 'transparent',
                  color: moodboardView === 'draft' ? '#111111' : '#6B7280',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: moodboardView === 'draft' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Preview
              </button>
              <button
                onClick={() => setMoodboardView('collections')}
                style={{
                  background: moodboardView === 'collections' ? '#ffffff' : 'transparent',
                  color: moodboardView === 'collections' ? '#111111' : '#6B7280',
                  border: 'none',
                  borderRadius: '100px',
                  padding: '6px 14px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: moodboardView === 'collections' ? '0 1px 3px rgba(0,0,0,0.05)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Saved Moodboards
              </button>
            </div>
          )}
        </div>
        <div className="moodboard-actions">
          {!isViewingShared && (
            <button
              className="action-icon-btn share-btn"
              onClick={shareMoodboard}
              disabled={isSharing}
              title={isSharing ? 'Creating link...' : 'Share'}
            >
              <Share2 size={20} />
              <span className="btn-label">{isSharing ? 'Sharing...' : 'Share'}</span>
            </button>
          )}

          {!isViewingShared && (
            <button
              className="action-icon-btn save-btn"
              onClick={handleSaveToCollection}
              disabled={isSavingCollection}
              title="Save to My Collections"
            >
              <Save size={20} />
              <span className="btn-label">{isSavingCollection ? 'Saving...' : 'Save'}</span>
            </button>
          )}


          {/* Live Collaboration Actions */}
          {!isViewingShared && (
            <div className="live-collaboration-section">
              <span className="live-collaboration-label">Live Collaboration</span>
              <div className="live-collaboration-buttons">
                <button
                  className="action-icon-btn live-btn start-live"
                  onClick={handleGoLive}
                  title="Start live session"
                  disabled={isGoingLive}
                >
                  <div className="live-icon-wrapper">
                    {isGoingLive ? (
                      <RotateCw size={20} className="spinning" style={{ display: 'block' }} />
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
                        <circle cx="12" cy="12" r="8" />
                        <path d="M12 2V5M12 19V22M2 12H5M19 12H22" strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <span className="btn-label">{isGoingLive ? 'Starting...' : 'Go Live'}</span>
                </button>

                <button
                  className="action-icon-btn live-btn join-live"
                  onClick={() => setShowJoinModal(true)}
                  title="Join live session"
                >
                  <Users size={20} />
                  <span className="btn-label">Join Session</span>
                </button>
              </div>
            </div>
          )}

          {isViewingShared && auth.currentUser && (
            <button className="share-button" onClick={saveToMyMoodboards}>
              <Save size={18} />
              Save to My Moodboards
            </button>
          )}
        </div>
      </div>

      {/* Join Session Modal */}
      {showJoinModal && (
        <div className="share-popup-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="share-popup-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="share-popup-header">
              <h3>Join Live Session</h3>
              <button className="close-popup-btn" onClick={() => setShowJoinModal(false)}>×</button>
            </div>
            <div className="share-popup-content" style={{ textAlign: 'center' }}>
              <p>Enter the 6-character session code to join.</p>

              <div style={{ margin: '20px 0' }}>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="CODE"
                  maxLength={6}
                  style={{
                    fontSize: '24px',
                    letterSpacing: '4px',
                    textAlign: 'center',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #ddd',
                    width: '200px',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase'
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && joinCode.length >= 6) {
                      navigate(`/live/${joinCode}`);
                    }
                  }}
                />
              </div>

              <div className="share-popup-actions" style={{ justifyContent: 'center' }}>
                <button
                  className="copy-btn"
                  style={{ width: '100%' }}
                  disabled={joinCode.length < 3}
                  onClick={() => {
                    navigate(`/live/${joinCode}`);
                  }}
                >
                  Join Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Popup Modal */}
      {showSharePopup && (
        <div className="share-popup-overlay" onClick={closeSharePopup}>
          <div className="share-popup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="share-popup-header">
              <h3>Share Your Moodboard</h3>
              <button className="close-popup-btn" onClick={closeSharePopup}>×</button>
            </div>

            <div className="share-popup-content">
              <p>Your masterpiece is locked, loaded, and ready to inspire. Hit share and let the vibes speak.</p>

              <div className="share-link-container">
                <input
                  type="text"
                  value={shareableLink}
                  readOnly
                  className="share-link-input"
                />
              </div>

              <div className="share-popup-actions">
                <button
                  onClick={copyLink}
                  className={`copy-btn ${copySuccess ? 'copied' : ''}`}
                  disabled={copySuccess}
                >
                  {copySuccess ? (
                    <>
                      <svg className="checkmark-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12" />
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg className="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      Copy Link
                    </>
                  )}
                </button>

                <button onClick={openInNewTab} className="open-tab-btn">
                  <svg className="external-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                    <polyline points="15,3 21,3 21,9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  Open in New Tab
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Overlay — Full View */}
      {overlayImage && (
        <div className="image-overlay" onClick={closeOverlay}>
          <button className="overlay-close-btn" onClick={closeOverlay}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>

          <div className="overlay-image-stage" onClick={(e) => e.stopPropagation()}>
            <img
              src={overlayImage.image}
              alt={overlayImage.title || 'Moodboard image'}
              className="overlay-hero-img"
              onError={(e) => { e.target.onerror = null; e.target.src = '/image-placeholder.svg'; }}
            />
            <div className="overlay-gradient-bar">
              <h3 className="overlay-bar-title">{overlayImage.title}</h3>
              {overlayImage.source && (
                <span className="overlay-bar-source">
                  <ExternalLink size={12} />
                  {overlayImage.url ? (
                    <a href={overlayImage.url} target="_blank" rel="noopener noreferrer" className="overlay-bar-link">{overlayImage.source}</a>
                  ) : overlayImage.source}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Error handling for share */}
      {shareStatus === 'error' && (
        <div className="share-error">
          <p>Error creating shareable link. Please try again.</p>
        </div>
      )}

      {isViewingShared && (
        <div className="shared-moodboard-info">
          <p>You are viewing a shared moodboard. {auth.currentUser ? 'Click "Save to My Moodboards" to keep it.' : 'Sign in to save it to your collection.'}</p>
        </div>
      )}

      {selectedImages.length === 1 && selectedImages[0]?.type === 'react_flow_graph' ? (
        <div className="moodboard-content" style={{ padding: 0, height: '80vh', position: 'relative', width: '100%', background: '#fafafa' }}>
          <ReactFlow
            nodes={selectedImages[0].nodes || []}
            edges={selectedImages[0].edges || []}
            nodeTypes={nodeTypes}
            fitView
            attributionPosition="bottom-right"
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
          >
            <Background color="#ccc" gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(n) => {
                if (n.type === 'website') return '#3b82f6';
                if (n.type === 'growthHeader') return '#10b981';
                return '#e2e8f0';
              }}
              style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="moodboard-content">
          <div className="moodboard-section">
            <div className="moodboard-images-grid">
              {selectedImages.map((image, idx) => (
                <div key={idx} className="moodboard-image-item">
                  <div
                    className="moodboard-image-container"
                    onClick={(e) => handleImageClick(image, e)}
                    style={{ cursor: 'pointer' }}
                  >
                    <img
                      src={typeof image === 'string' ? image : image.image || image.url}
                      alt={image.title || 'Inspiration'}
                      className="moodboard-image"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = '/image-placeholder.svg';
                      }}
                    />
                    {!isViewingShared && (
                      <button
                        className="remove-image-button"
                        onClick={() => removeImage(idx)}
                        title="Remove"
                        aria-label="Remove"
                      >×</button>
                    )}
                  </div>
                  {image.title && <p className="moodboard-image-title">{image.title}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={userData?.role || 'free'}
      />

      <UpgradePromptModal
        isOpen={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        title={upgradeMessage.title}
        message={upgradeMessage.message}
        onUpgrade={() => {
          setShowUpgradePrompt(false);
          setShowPricingModal(true);
        }}
      />
    </div>
  );
};

export default MoodboardPreviewPage;
