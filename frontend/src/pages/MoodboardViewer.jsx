import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from 'firebase/auth';
import MoodboardService from '../services/MoodboardService';
import ReactFlow, { Background, Controls, MiniMap } from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeTypes } from '../components/Scanner/ScannerNodes';
import '../styles/BrandScanner.css';
import '../styles/MoodboardViewer.css';
import { auth } from '../firebase';

// ─── Derive column span from aspect ratio for layout variety ────────────────
function getColSpanFromAspect(ratio) {
  if (ratio >= 2.5) return 8;   // panoramic
  if (ratio >= 1.6) return 6;   // landscape
  if (ratio >= 1.1) return 4;   // slightly landscape
  if (ratio >= 0.9) return 4;   // square
  if (ratio >= 0.6) return 3;   // portrait
  return 3;                     // tall portrait
}

// On mobile (2-col grid): landscape/square → span 2 (full), portrait → span 1 (half)
function getMobileColSpan(ratio) {
  return ratio >= 1.1 ? 2 : 1;
}

// Preload all images and return { colSpan, aspect } per image
function useImageSpans(images) {
  const [spans, setSpans] = useState([]);

  useEffect(() => {
    if (!images || images.length === 0) { setSpans([]); return; }
    setSpans(images.map(() => ({ colSpan: 4, colSpanMobile: 2, aspect: '4/3' })));

    const computed = Array(images.length).fill(null);
    let settled = 0;

    images.forEach((image, idx) => {
      const src = typeof image === 'string' ? image : image?.image || image?.url;
      if (!src || src.startsWith('data:')) {
        computed[idx] = { colSpan: 4, colSpanMobile: 2, aspect: '4/3' };
        if (++settled === images.length) setSpans([...computed]);
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const w = img.naturalWidth || 4;
        const h = img.naturalHeight || 3;
        const ratio = w / h;
        computed[idx] = {
          colSpan: getColSpanFromAspect(ratio),
          colSpanMobile: getMobileColSpan(ratio),
          aspect: `${w}/${h}`
        };
        if (++settled === images.length) setSpans([...computed]);
      };
      img.onerror = () => {
        computed[idx] = { colSpan: 4, colSpanMobile: 2, aspect: '4/3' };
        if (++settled === images.length) setSpans([...computed]);
      };
      img.src = src;
    });
  }, [images]);

  return spans;
}

// ─── Animated Loader ─────────────────────────────────────────────────────────
const MoodboardLoader = () => (
  <div className="mv-loader">
    <div className="mv-loader__cards">
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} className={`mv-loader__card mv-loader__card--${i}`} />
      ))}
    </div>
    <div className="mv-loader__text">
      <span>Collecting inspiration</span>
      <span className="mv-loader__dots">
        <span /><span /><span />
      </span>
    </div>
  </div>
);

// ─── Auth Gate (full page — for private boards) ──────────────────────────────
const AuthGate = ({ title, imageCount, onSignIn }) => (
  <div className="mv-auth-gate">
    <div className="mv-auth-gate__card">
      <div className="mv-auth-gate__lock">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h2 className="mv-auth-gate__title">{title || 'Private Moodboard'}</h2>
      <p className="mv-auth-gate__subtitle">
        {imageCount ? `${imageCount} images` : 'Sign in to view this collection'}
      </p>
      <button className="mv-auth-gate__btn" onClick={onSignIn}>
        Sign in to view →
      </button>
    </div>
  </div>
);

// ─── Inline Scroll Gate (for ungated shared boards) ──────────────────────────
const ScrollGate = ({ onSignIn, signingIn }) => (
  <div className="mv-scroll-gate">
    <div className="mv-scroll-gate__gradient" />
    <div className="mv-scroll-gate__card">
      <div className="mv-scroll-gate__icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <h3 className="mv-scroll-gate__title">Sign in to see the full moodboard</h3>
      <p className="mv-scroll-gate__subtitle">
        Create your free account to view all images, save collections, and build your own moodboards.
      </p>
      <button
        className="mv-scroll-gate__google-btn"
        onClick={onSignIn}
        disabled={signingIn}
      >
        <svg width="18" height="18" viewBox="0 0 48 48">
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 019.5 24c0-1.59.28-3.14.76-4.59l-7.98-6.19A23.99 23.99 0 000 24c0 3.77.9 7.35 2.56 10.53l7.97-5.94z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 5.94C6.51 42.62 14.62 48 24 48z" />
        </svg>
        {signingIn ? 'Signing in…' : 'Continue with Google'}
      </button>
      <p className="mv-scroll-gate__terms">
        Free forever · No credit card required
      </p>
    </div>
  </div>
);

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ images, index, onClose, onPrev, onNext }) => {
  const image = images[index];
  const src = typeof image === 'string' ? image : image?.image || image?.url;
  const title = typeof image === 'object' ? image?.title : null;
  const link = typeof image === 'object' ? image?.url || image?.link : null;
  const total = images.length;

  // Touch swipe
  const touchStart = useRef(null);
  const handleTouchStart = (e) => { touchStart.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStart.current) return;
    const delta = e.changedTouches[0].clientX - touchStart.current;
    if (delta > 60) onPrev();
    else if (delta < -60) onNext();
    touchStart.current = null;
  };

  return (
    <div
      className="mv-lightbox"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Prev arrow */}
      {total > 1 && (
        <button className="mv-lightbox__arrow mv-lightbox__arrow--prev" onClick={e => { e.stopPropagation(); onPrev(); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}

      <div className="mv-lightbox__content" onClick={e => e.stopPropagation()}>
        <button className="mv-lightbox__close" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <img
          key={src}
          src={src}
          alt={title || 'Moodboard image'}
          className="mv-lightbox__image"
          onError={e => { e.target.onerror = null; e.target.src = '/image-placeholder.svg'; }}
        />

        {(title || link) && (
          <div className="mv-lightbox__meta">
            {title && <span className="mv-lightbox__title">{title}</span>}
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="mv-lightbox__source">
                View source ↗
              </a>
            )}
          </div>
        )}
        {total > 1 && (
          <div className="mv-lightbox__counter">{index + 1} / {total}</div>
        )}
      </div>

      {/* Next arrow */}
      {total > 1 && (
        <button className="mv-lightbox__arrow mv-lightbox__arrow--next" onClick={e => { e.stopPropagation(); onNext(); }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TEASER_COUNT = 3; // Number of images visible before the scroll gate

// ─── Main Component ───────────────────────────────────────────────────────────
const MoodboardViewer = () => {
  const [moodboard, setMoodboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [requiresAuth, setRequiresAuth] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(!!auth.currentUser);
  const [signingIn, setSigningIn] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const shareCode = searchParams.get('code');

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
    });
    return () => unsubscribe();
  }, []);

  const fetchMoodboard = useCallback(async () => {
    if (!shareCode) { setError('No share code provided'); setLoading(false); return; }
    try {
      setLoading(true);
      const data = await MoodboardService.getSharedMoodboard(shareCode);
      if (data.requiresAuth) {
        setRequiresAuth(true);
        setMoodboard({ title: data.title, imageCount: data.imageCount });
      } else {
        setMoodboard(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load the shared moodboard');
    } finally {
      setLoading(false);
    }
  }, [shareCode]);

  useEffect(() => { fetchMoodboard(); }, [fetchMoodboard]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    const onKey = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') setLightboxIndex(i => Math.min(i + 1, (moodboard?.images?.length || 1) - 1));
      if (e.key === 'ArrowLeft') setLightboxIndex(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, moodboard]);

  // Lock scroll when lightbox open
  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [lightboxIndex]);

  // Inline Google Sign-In (popup, no redirect)
  const handleInlineSignIn = async () => {
    setSigningIn(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will set isAuthenticated = true
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignIn = () => navigate('/login', { state: { returnTo: `/view?code=${shareCode}` } });

  const handleSaveToCollection = async () => {
    if (!auth.currentUser) { handleSignIn(); return; }
    try {
      if (moodboard?.images) {
        localStorage.setItem('moodboardImages', JSON.stringify(moodboard.images));
        window.dispatchEvent(new CustomEvent('moodboardUpdate'));
        navigate('/moodboard');
      }
    } catch { setError('Failed to save moodboard'); }
  };

  const images = moodboard?.images || [];
  const spans = useImageSpans(images);

  // Determine if we need the scroll gate
  const needsScrollGate = !isAuthenticated && images.length > TEASER_COUNT;
  const visibleImages = needsScrollGate ? images.slice(0, TEASER_COUNT) : images;
  const visibleSpans = needsScrollGate ? spans.slice(0, TEASER_COUNT) : spans;

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="mv-root">
      <MoodboardLoader />
    </div>
  );

  // ── Error state ──────────────────────────────────────────────────────────
  if (error || (!moodboard && !requiresAuth)) return (
    <div className="mv-root">
      <div className="mv-error">
        <div className="mv-error__icon">✕</div>
        <h2>Moodboard not found</h2>
        <p>{error || 'This link may have expired.'}</p>
        <button className="mv-btn mv-btn--primary" onClick={() => navigate('/')}>Go to InspoAI →</button>
      </div>
    </div>
  );

  // ── Auth gate (for fully private boards) ───────────────────────────────
  if (requiresAuth) return (
    <div className="mv-root">
      <AuthGate
        title={moodboard?.title}
        imageCount={moodboard?.imageCount}
        onSignIn={handleSignIn}
      />
    </div>
  );

  // ── Detect graph moodboards (Brand DNA) ──────────────────────────────
  let graphData = images[0]?.type === 'react_flow_graph' ? images[0] : null;
  if (!graphData && moodboard.title?.startsWith('Brand DNA:')) {
    const saved = JSON.parse(localStorage.getItem('inspo_saved_graphs') || '{}');
    graphData = saved[moodboard.title] || null;
  }

  return (
    <div className="mv-root">
      {/* ── Header ───────────────────────────────────────────────────── */}
      <header className="mv-header">
        <div className="mv-header__logo">
          <img src="/LogoInspo.svg" alt="InspoAI" height="36" />
        </div>
        <div className="mv-header__center">
          <h1 className="mv-header__title">{moodboard.title || 'Moodboard'}</h1>
          <span className="mv-header__meta">
            {images.length} images · {new Date(moodboard.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
        <div className="mv-header__actions">
          <button className="mv-btn mv-btn--primary" onClick={handleSaveToCollection}>
            Save to collection
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────────── */}
      <main className="mv-content">
        {graphData && graphData.nodes?.length > 0 ? (
          <div className="mv-graph">
            <ReactFlow
              nodes={graphData.nodes}
              edges={graphData.edges || []}
              nodeTypes={nodeTypes}
              fitView minZoom={0.3} maxZoom={1.5}
              nodesConnectable={false} nodesDraggable={false} elementsSelectable={false}
              defaultEdgeOptions={{ type: 'default', animated: true, style: { stroke: '#334155', strokeWidth: 2 } }}
            >
              <Background color="#1a1a2e" gap={20} size={1} />
              <Controls />
              <MiniMap nodeColor={n => n.type === 'website' ? '#6366f1' : n.type === 'colors' ? '#ec4899' : '#334155'} />
            </ReactFlow>
          </div>
        ) : (
          <div className="mv-bento-wrapper">
            <div className="mv-bento">
              {visibleImages.map((image, idx) => {
                const { colSpan = 4, colSpanMobile = 1, aspect = '4/3' } = visibleSpans[idx] || {};
                const src = typeof image === 'string' ? image : image?.image || image?.url;
                const isUnavailable = image?._unavailable;
                return (
                  <div
                    key={idx}
                    className={`mv-bento__item ${isUnavailable ? 'mv-bento__item--unavailable' : ''}`}
                    style={{ '--col-span': colSpan, '--col-span-mobile': colSpanMobile, '--aspect': aspect, animationDelay: `${idx * 0.04}s` }}
                    onClick={() => !isUnavailable && setLightboxIndex(idx)}
                  >
                    {isUnavailable ? (
                      <div className="mv-bento__placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                        </svg>
                        <span>Image unavailable</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src={src}
                          alt={image?.title || 'Inspiration'}
                          className="mv-bento__img"
                          loading="lazy"
                          onError={e => { e.target.onerror = null; e.target.src = '/image-placeholder.svg'; }}
                        />
                        <div className="mv-bento__overlay">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                          </svg>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Scroll Gate — shown when user is NOT authenticated ─── */}
            {needsScrollGate && (
              <ScrollGate onSignIn={handleInlineSignIn} signingIn={signingIn} />
            )}
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="mv-footer">
        <span>Created with</span>
        <a href="https://app.inspoai.io" target="_blank" rel="noopener noreferrer">InspoAI</a>
      </footer>

      {/* ── Lightbox ─────────────────────────────────────────────────── */}
      {lightboxIndex !== null && (
        <Lightbox
          images={isAuthenticated ? images : visibleImages}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onPrev={() => setLightboxIndex(i => Math.max(i - 1, 0))}
          onNext={() => setLightboxIndex(i => Math.min(i + 1, (isAuthenticated ? images.length : visibleImages.length) - 1))}
        />
      )}
    </div>
  );
};

export default MoodboardViewer;
