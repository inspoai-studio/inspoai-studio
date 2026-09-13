import React, { useState, useEffect } from 'react';
import MoodboardService from '../../services/MoodboardService';
import '../../styles/MoodboardLibrary.css';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from '../Scanner/ScannerNodes';
import '../../styles/BrandScanner.css';
// Import icons from Lucide React
import {
  Eye,
  Calendar,
  Link,
  Lock,
  Unlock,
  Edit,
  Trash2,
  X,
  Image,
  AlertCircle,
  LayoutTemplate,
  ExternalLink,
  Copy,
  Check
} from 'lucide-react';

const MoodboardLibrary = ({ onEditCollection, moodboardView, setMoodboardView }) => {
  const [sharedMoodboards, setSharedMoodboards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMoodboard, setSelectedMoodboard] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalAction, setModalAction] = useState('');
  const [sharePopoverId, setSharePopoverId] = useState(null);
  const [popoverCopied, setPopoverCopied] = useState(false);

  useEffect(() => {
    fetchSharedMoodboards();
  }, []);

  const fetchSharedMoodboards = async () => {
    try {
      setLoading(true);
      const response = await MoodboardService.getUserSharedMoodboards();
      const sorted = (response.moodboards || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setSharedMoodboards(sorted);
      setError(null);
    } catch (err) {
      console.error('Error fetching shared moodboards:', err);
      setError('Failed to load your shared moodboards');
    } finally {
      setLoading(false);
    }
  };

  const getShareUrl = (shareCode) => `${window.location.origin}/view?code=${shareCode}`;

  const toggleSharePopover = (moodboardId) => {
    setSharePopoverId(prev => prev === moodboardId ? null : moodboardId);
    setPopoverCopied(false);
  };

  const handleCopyLink = async (shareCode) => {
    const shareUrl = getShareUrl(shareCode);
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setPopoverCopied(true);
    setTimeout(() => setPopoverCopied(false), 2000);
  };

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sharePopoverId && !e.target.closest('.share-popover-container')) {
        setSharePopoverId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sharePopoverId]);

  const togglePrivacy = async (moodboardId, currentStatus) => {
    try {
      await MoodboardService.updateMoodboardPrivacy(moodboardId, !currentStatus);
      // Update the local state to reflect the change
      setSharedMoodboards(moodboards =>
        moodboards.map(m =>
          m.id === moodboardId ? { ...m, isPublic: !currentStatus } : m
        )
      );
    } catch (err) {
      console.error('Error updating moodboard privacy:', err);
      alert('Failed to update privacy settings. Please try again.');
    }
  };

  const handleDelete = async (moodboardId) => {
    if (window.confirm('Are you sure you want to delete this moodboard? This action cannot be undone.')) {
      try {
        await MoodboardService.deleteMoodboard(moodboardId);
        setSharedMoodboards(moodboards =>
          moodboards.filter(m => m.id !== moodboardId)
        );
        setShowModal(false);
      } catch (err) {
        console.error('Error deleting moodboard:', err);
        alert('Failed to delete moodboard. Please try again.');
      }
    }
  };

  const openMoodboard = (moodboard) => {
    setSelectedMoodboard(moodboard);
    setModalAction('view');
    setShowModal(true);
  };

  const editMoodboard = (moodboard) => {
    setSelectedMoodboard(moodboard);
    setModalAction('edit');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMoodboard(null);
    setModalAction('');
  };

  const updateMoodboardTitle = async (moodboardId, newTitle) => {
    try {
      await MoodboardService.updateMoodboard(moodboardId, { title: newTitle });
      setSharedMoodboards(moodboards =>
        moodboards.map(m =>
          m.id === moodboardId ? { ...m, title: newTitle } : m
        )
      );
      // Update the selected moodboard as well if it's currently selected
      setSelectedMoodboard(prev =>
        prev && prev.id === moodboardId ? { ...prev, title: newTitle } : prev
      );
      closeModal();
    } catch (err) {
      console.error('Error updating moodboard title:', err);
      alert('Failed to update title. Please try again.');
    }
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = '/image-placeholder.svg';
  };

  if (loading) {
    return (
      <div className="moodboard-library">
        <div className="moodboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ margin: 0 }}>Moodboard Preview</h1>
            {setMoodboardView && (
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
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading your moodboards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="moodboard-library">
        <div className="moodboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ margin: 0 }}>Moodboard Preview</h1>
            {setMoodboardView && (
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
        <div className="error-message">
          <p><AlertCircle size={20} className="error-icon" /> {error}</p>
          <button onClick={fetchSharedMoodboards} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (sharedMoodboards.length === 0) {
    return (
      <div className="moodboard-library">
        <div className="moodboard-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h1 style={{ margin: 0 }}>Moodboard Preview</h1>
            {setMoodboardView && (
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
        <div className="empty-library">
          <Image size={64} className="empty-library-icon" />
          <h2>No Collections Saved Yet</h2>
          <p>Create and save your first collection from the moodboard preview!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="moodboard-library">
      <div className="moodboard-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0 }}>Moodboard Preview</h1>
          {setMoodboardView && (
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

      <div className="moodboard-grid">
        {sharedMoodboards.map(moodboard => (
          <div key={moodboard.id} className="moodboard-card">
            <div
              className="moodboard-preview"
              onClick={() => openMoodboard(moodboard)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openMoodboard(moodboard);
                }
              }}
            >
              {moodboard.thumbnail ? (
                <img
                  src={moodboard.thumbnail}
                  alt={moodboard.title}
                  onError={handleImageError}
                />
              ) : (
                <div className="placeholder-img">
                  <Image size={48} className="placeholder-icon" />
                </div>
              )}
            </div>

            <div className="moodboard-info">
              <h3>{moodboard.title}</h3>
              <div className="moodboard-stats">
                <span>
                  <Eye size={14} className="stat-icon" /> {moodboard.views || 0} views
                </span>
                <span>
                  <Calendar size={14} className="stat-icon" /> {new Date(moodboard.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="moodboard-actions">
              <div className="share-popover-container" style={{ position: 'relative' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSharePopover(moodboard.id);
                  }}
                  className={`action-button ${sharePopoverId === moodboard.id ? 'active' : ''}`}
                  title="Share link"
                  aria-label="Share link"
                >
                  <Link size={16} />
                </button>

                {sharePopoverId === moodboard.id && (
                  <div className="share-link-popover" onClick={(e) => e.stopPropagation()}>
                    <div className="share-popover-header">
                      <span className="share-popover-title">Share Link</span>
                      <button
                        className="share-popover-close"
                        onClick={(e) => { e.stopPropagation(); setSharePopoverId(null); }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <div className="share-popover-url-row">
                      <input
                        type="text"
                        readOnly
                        value={getShareUrl(moodboard.shareCode)}
                        className="share-popover-input"
                        onClick={(e) => e.target.select()}
                      />
                      <button
                        className={`share-popover-btn copy ${popoverCopied ? 'copied' : ''}`}
                        onClick={() => handleCopyLink(moodboard.shareCode)}
                        title="Copy to clipboard"
                      >
                        {popoverCopied ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <a
                        href={getShareUrl(moodboard.shareCode)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="share-popover-btn open"
                        title="Open in new tab"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePrivacy(moodboard.id, moodboard.isPublic);
                }}
                className={`action-button ${moodboard.isPublic ? 'public' : 'private'}`}
                title={moodboard.isPublic ? "Make private" : "Make public"}
                aria-label={moodboard.isPublic ? "Make private" : "Make public"}
              >
                {moodboard.isPublic ? <Unlock size={16} /> : <Lock size={16} />}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onEditCollection) {
                    onEditCollection(moodboard.images);
                  }
                }}
                className="action-button"
                title="Edit collection content"
                aria-label="Edit collection content"
              >
                <LayoutTemplate size={16} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  editMoodboard(moodboard);
                }}
                className="action-button"
                title="Rename collection"
                aria-label="Rename collection"
              >
                <Edit size={16} />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(moodboard.id);
                }}
                className="action-button delete"
                title="Delete moodboard"
                aria-label="Delete moodboard"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Moodboard Modal */}
      {showModal && selectedMoodboard && (
        <div className="moodboard-modal-overlay" onClick={closeModal}>
          <div className={`moodboard-modal ${modalAction === 'view' ? 'full-width' : ''}`} onClick={e => e.stopPropagation()}>
            <button className="close-modal" onClick={closeModal} aria-label="Close modal">
              <X size={20} />
            </button>

            {modalAction === 'view' && (
              <>
                <h2>{selectedMoodboard.title}</h2>
                <div className="modal-stats">
                  <span>
                    <Eye size={16} className="stat-icon" /> {selectedMoodboard.views || 0} Views
                  </span>
                  <span>
                    {selectedMoodboard.isPublic ? <Unlock size={16} className="stat-icon" /> : <Lock size={16} className="stat-icon" />} {selectedMoodboard.isPublic ? 'Public' : 'Private'}
                  </span>
                  <span>
                    <Calendar size={16} className="stat-icon" /> {new Date(selectedMoodboard.createdAt).toLocaleDateString()}
                  </span>
                </div>

                {/* Check if this is a React Flow graph collection */}
                {(() => {
                  // Check API data first, then fall back to localStorage
                  let graphData = selectedMoodboard.images?.[0]?.type === 'react_flow_graph'
                    ? selectedMoodboard.images[0]
                    : null;

                  // Fallback: check localStorage if title starts with "Brand DNA:"
                  if (!graphData && selectedMoodboard.title?.startsWith('Brand DNA:')) {
                    const savedGraphs = JSON.parse(localStorage.getItem('inspo_saved_graphs') || '{}');
                    graphData = savedGraphs[selectedMoodboard.title] || null;
                  }

                  if (graphData && graphData.nodes?.length > 0) {
                    return (
                      <div style={{ width: '100%', height: '70vh', borderRadius: 12, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                        <ReactFlow
                          nodes={graphData.nodes}
                          edges={graphData.edges || []}
                          nodeTypes={nodeTypes}
                          fitView
                          minZoom={0.3}
                          maxZoom={1.5}
                          nodesConnectable={false}
                          nodesDraggable={false}
                          elementsSelectable={false}
                          defaultEdgeOptions={{
                            type: 'default',
                            animated: true,
                            style: { stroke: '#334155', strokeWidth: 2 }
                          }}
                        >
                          <Background color="#cbd5e1" gap={20} size={1} />
                          <Controls />
                          <MiniMap
                            nodeColor={n => {
                              if (n.type === 'website') return '#6366f1';
                              if (n.type === 'colors') return '#ec4899';
                              return '#cbd5e1';
                            }}
                          />
                        </ReactFlow>
                      </div>
                    );
                  }

                  return (
                    <div className="modal-images-grid">
                      {selectedMoodboard.images && selectedMoodboard.images.length > 0 ? (
                        selectedMoodboard.images.map((image, idx) => (
                          <div key={idx} className="modal-image">
                            <img
                              src={typeof image === 'string' ? image : image.image || image.url}
                              alt={image.title || `Image ${idx + 1}`}
                              onError={handleImageError}
                            />
                          </div>
                        ))
                      ) : (
                        <p>No images in this moodboard</p>
                      )}
                    </div>
                  );
                })()}

                <div className="modal-actions">
                  <button onClick={() => handleCopyLink(selectedMoodboard.shareCode)} className="cancel-button">
                    <Link size={16} className="button-icon" /> Copy Share Link
                  </button>
                  <button onClick={() => setModalAction('edit')} className="cancel-button">
                    <Edit size={16} className="button-icon" /> Rename
                  </button>
                  <button
                    onClick={() => togglePrivacy(selectedMoodboard.id, selectedMoodboard.isPublic)}
                    className="save-button"
                  >
                    {selectedMoodboard.isPublic ?
                      <><Lock size={16} className="button-icon" /> Make Private</> :
                      <><Unlock size={16} className="button-icon" /> Make Public</>
                    }
                  </button>
                </div>
              </>
            )}

            {modalAction === 'edit' && (
              <div className="edit-moodboard-form">
                <h2>Edit Moodboard Title</h2>
                <div className="form-group">
                  <label htmlFor="moodboard-title">Collection Name</label>
                  <input
                    type="text"
                    id="moodboard-title"
                    defaultValue={selectedMoodboard.title}
                    autoFocus
                    placeholder="Enter collection name..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const input = e.target;
                        if (input.value.trim()) {
                          updateMoodboardTitle(selectedMoodboard.id, input.value.trim());
                        }
                      } else if (e.key === 'Escape') {
                        closeModal();
                      }
                    }}
                  />
                </div>
                <div className="modal-actions">
                  <button onClick={closeModal} className="cancel-button">
                    Cancel
                  </button>
                  <button
                    className="save-button"
                    onClick={() => {
                      const input = document.getElementById('moodboard-title');
                      if (input && input.value.trim()) {
                        updateMoodboardTitle(selectedMoodboard.id, input.value.trim());
                      }
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MoodboardLibrary;