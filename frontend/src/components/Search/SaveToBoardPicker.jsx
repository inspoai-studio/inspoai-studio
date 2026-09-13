import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import MoodboardService from '../../services/MoodboardService';
import { auth } from '../../firebase';
import '../../styles/SaveToBoardPicker.css';

const MOODBOARD_STORAGE_KEY = 'moodboardImages';

const SaveToBoardPicker = ({ image, onSaved, onClose, moodboardImages, setMoodboardImages, anchorRef, cachedBoards, onBoardsCacheUpdate }) => {
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  const [savingTo, setSavingTo] = useState(null); // boardId being saved to
  const [savedTo, setSavedTo] = useState(new Set()); // boardIds already saved to
  const [creating, setCreating] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const searchRef = useRef(null);
  const createInputRef = useRef(null);
  const popoverRef = useRef(null);

  // Position the popover relative to the anchor element
  useEffect(() => {
    if (anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const popoverWidth = 340;
      const popoverHeight = 420;

      // Try to place above the button
      let top = rect.top - popoverHeight - 8;

      // Center horizontally relative to the button
      let left = rect.left + (rect.width / 2) - (popoverWidth / 2);

      // If popover would go above viewport, show it below
      if (top < 8) {
        top = rect.bottom + 8;
      }

      // If popover would go off right edge, align to right edge
      if (left + popoverWidth > window.innerWidth - 8) {
        left = window.innerWidth - popoverWidth - 8;
      }

      // If popover would go off left edge
      if (left < 8) {
        left = 8;
      }

      // If popover would go below viewport, clamp it
      if (top + popoverHeight > window.innerHeight - 8) {
        top = window.innerHeight - popoverHeight - 8;
      }

      setPosition({ top, left });
    }
  }, [anchorRef]);

  // Fetch existing boards on mount — use cache if available
  useEffect(() => {
    if (cachedBoards) {
      // Use pre-fetched boards — instant load
      setBoards(cachedBoards);
      setLoading(false);
      return;
    }
    // No cache — fetch from API
    const fetchBoards = async () => {
      if (!auth.currentUser) {
        setLoading(false);
        return;
      }
      try {
        const response = await MoodboardService.getUserSharedMoodboards();
        const sorted = (response.moodboards || []).sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setBoards(sorted);
        // Report back to parent for caching
        onBoardsCacheUpdate?.(sorted);
      } catch (err) {
        console.error('Error fetching boards:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBoards();
  }, [cachedBoards]);

  // Auto-focus search
  useEffect(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  // Auto-focus create input when shown
  useEffect(() => {
    if (showCreateForm && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [showCreateForm]);

  // Filter boards by search
  const filteredBoards = boards.filter(b =>
    b.title.toLowerCase().includes(search.toLowerCase())
  );

  // Save to current draft (localStorage)
  const handleSaveToDraft = useCallback(() => {
    const imageWithTime = { ...image, addedAt: new Date().toISOString() };
    const updatedMoodboard = [...moodboardImages, imageWithTime];
    setMoodboardImages(updatedMoodboard);
    localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(updatedMoodboard));

    window.dispatchEvent(new CustomEvent('moodboardUpdate', {
      detail: { count: updatedMoodboard.length }
    }));

    onSaved('Current Draft');
  }, [image, moodboardImages, setMoodboardImages, onSaved]);

  // Save to an existing board
  const handleSaveToBoard = useCallback(async (board) => {
    if (savingTo || savedTo.has(board.id)) return;
    setSavingTo(board.id);

    try {
      const imageWithTime = { ...image, addedAt: new Date().toISOString() };
      const updatedImages = [...(board.images || []), imageWithTime];

      try {
        // Primary approach: update the existing board
        await MoodboardService.updateMoodboard(board.id, {
          images: updatedImages
        });
      } catch (updateErr) {
        // Fallback: if update fails (404, auth mismatch, etc.), 
        // save as a new board with the same title + all images
        console.warn('updateMoodboard failed, falling back to saveCollection:', updateErr.message);
        await MoodboardService.saveCollection(updatedImages, board.title);
      }

      // Also add to current draft
      const draftImages = JSON.parse(localStorage.getItem(MOODBOARD_STORAGE_KEY) || '[]');
      const alreadyInDraft = draftImages.some(
        existing => existing._internalId && existing._internalId === image._internalId
      );
      if (!alreadyInDraft) {
        const updatedDraft = [...draftImages, imageWithTime];
        setMoodboardImages(updatedDraft);
        localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(updatedDraft));
        window.dispatchEvent(new CustomEvent('moodboardUpdate', {
          detail: { count: updatedDraft.length }
        }));
      }

      setSavedTo(prev => new Set([...prev, board.id]));
      // Invalidate cached boards so next open reflects the new image count
      onBoardsCacheUpdate?.(null);
      onSaved(board.title);
    } catch (err) {
      console.error('Error saving to board:', err);
      // Show save failed but still add to draft as fallback
      const imageWithTime = { ...image, addedAt: new Date().toISOString() };
      const draftImages = JSON.parse(localStorage.getItem(MOODBOARD_STORAGE_KEY) || '[]');
      const updatedDraft = [...draftImages, imageWithTime];
      setMoodboardImages(updatedDraft);
      localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(updatedDraft));
      window.dispatchEvent(new CustomEvent('moodboardUpdate', {
        detail: { count: updatedDraft.length }
      }));
      onSaved('Current Draft');
    } finally {
      setSavingTo(null);
    }
  }, [image, savingTo, savedTo, moodboardImages, setMoodboardImages, onSaved]);

  // Create a new board and save to it
  const handleCreateBoard = useCallback(async () => {
    if (!newBoardName.trim() || creating) return;
    setCreating(true);

    try {
      const imageWithTime = { ...image, addedAt: new Date().toISOString() };

      // Create the board with the image
      await MoodboardService.saveCollection([imageWithTime], newBoardName.trim());

      // Also add to current draft
      const draftImages = JSON.parse(localStorage.getItem(MOODBOARD_STORAGE_KEY) || '[]');
      const alreadyInDraft = draftImages.some(
        existing => existing._internalId && existing._internalId === image._internalId
      );
      if (!alreadyInDraft) {
        const updatedDraft = [...draftImages, imageWithTime];
        setMoodboardImages(updatedDraft);
        localStorage.setItem(MOODBOARD_STORAGE_KEY, JSON.stringify(updatedDraft));
        window.dispatchEvent(new CustomEvent('moodboardUpdate', {
          detail: { count: updatedDraft.length }
        }));
      }

      // Invalidate cached boards so next open reflects the new board
      onBoardsCacheUpdate?.(null);
      onSaved(newBoardName.trim());
    } catch (err) {
      console.error('Error creating board:', err);
    } finally {
      setCreating(false);
    }
  }, [newBoardName, creating, image, moodboardImages, setMoodboardImages, onSaved]);

  // Get thumbnail for a board
  const getBoardThumb = (board) => {
    if (board.thumbnail) return board.thumbnail;
    if (board.images && board.images.length > 0) {
      const first = board.images[0];
      return typeof first === 'string' ? first : first?.image || first?.url;
    }
    return null;
  };

  const draftCount = moodboardImages.length;

  const popoverContent = (
    <>
      {/* Backdrop to close picker on outside click */}
      <div className="stb-backdrop" onClick={onClose} />

      <div
        ref={popoverRef}
        className="stb-popover"
        style={{ top: position.top, left: position.left }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="stb-header">
          <h4 className="stb-header__title">Save to board</h4>
        </div>

        {/* Search */}
        <div className="stb-search">
          <div className="stb-search__wrapper">
            <svg className="stb-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              className="stb-search__input"
              type="text"
              placeholder="Search boards..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Board list */}
        <div className="stb-list">
          {loading ? (
            <div className="stb-loading">Loading boards...</div>
          ) : (
            <>
              {/* Current Draft — always first */}
              {!search && (
                <>
                  <div className="stb-section-label">Current draft</div>
                  <div className="stb-board stb-board--draft" onClick={handleSaveToDraft}>
                    <div className="stb-board__thumb-placeholder">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                        <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                      </svg>
                    </div>
                    <div className="stb-board__info">
                      <div className="stb-board__name">Current Draft</div>
                      <div className="stb-board__count">{draftCount} images</div>
                    </div>
                    <button className="stb-board__save-btn" onClick={e => { e.stopPropagation(); handleSaveToDraft(); }}>
                      Save
                    </button>
                  </div>
                </>
              )}

              {/* Saved boards */}
              {filteredBoards.length > 0 && (
                <>
                  <div className="stb-section-label">
                    {search ? 'Results' : 'Your boards'}
                  </div>
                  {filteredBoards.map(board => {
                    const thumb = getBoardThumb(board);
                    const isSaved = savedTo.has(board.id);
                    const isSaving = savingTo === board.id;
                    return (
                      <div
                        key={board.id}
                        className="stb-board"
                        onClick={() => handleSaveToBoard(board)}
                      >
                        {thumb ? (
                          <img
                            className="stb-board__thumb"
                            src={thumb}
                            alt={board.title}
                            onError={e => { e.target.onerror = null; e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <div className="stb-board__thumb-placeholder">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                              <circle cx="8.5" cy="8.5" r="1.5" />
                              <polyline points="21 15 16 10 5 21" />
                            </svg>
                          </div>
                        )}
                        <div className="stb-board__info">
                          <div className="stb-board__name">{board.title}</div>
                          <div className="stb-board__count">
                            {board.images?.length || 0} images
                          </div>
                        </div>
                        <button
                          className={`stb-board__save-btn ${isSaved ? 'stb-board__save-btn--saved' : ''}`}
                          disabled={isSaving || isSaved}
                          onClick={e => { e.stopPropagation(); handleSaveToBoard(board); }}
                        >
                          {isSaving ? '...' : isSaved ? 'Saved' : 'Save'}
                        </button>
                      </div>
                    );
                  })}
                </>
              )}

              {!loading && filteredBoards.length === 0 && search && (
                <div className="stb-empty">No boards matching "{search}"</div>
              )}
            </>
          )}
        </div>

        {/* Create Board */}
        {showCreateForm ? (
          <div className="stb-create-form">
            <input
              ref={createInputRef}
              className="stb-create-form__input"
              type="text"
              placeholder="Board name..."
              value={newBoardName}
              onChange={e => setNewBoardName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateBoard();
                if (e.key === 'Escape') { setShowCreateForm(false); setNewBoardName(''); }
              }}
            />
            <button
              className="stb-create-form__submit"
              onClick={handleCreateBoard}
              disabled={!newBoardName.trim() || creating}
            >
              {creating ? '...' : 'Create'}
            </button>
          </div>
        ) : (
          <div className="stb-create">
            <button className="stb-create__btn" onClick={() => setShowCreateForm(true)}>
              <div className="stb-create__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </div>
              Create board
            </button>
          </div>
        )}
      </div>
    </>
  );

  // Render via portal to escape overflow:hidden containers
  return createPortal(popoverContent, document.body);
};

export default SaveToBoardPicker;
