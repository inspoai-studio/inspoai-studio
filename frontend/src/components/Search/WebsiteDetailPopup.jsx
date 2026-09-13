import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../../styles/WebsiteDetailPopup.css';

/* ── Color helpers ── */
const COLOR_NAME_TO_HEX = {
    black: '#000000', white: '#FFFFFF', red: '#E53E3E', blue: '#3B82F6',
    green: '#38A169', yellow: '#ECC94B', orange: '#ED8936', pink: '#ED64A6',
    purple: '#9F7AEA', teal: '#38B2AC', gray: '#A0AEC0', grey: '#A0AEC0',
    brown: '#8B6914', navy: '#1A365D', 'light blue': '#63B3ED', 'dark blue': '#2A4365',
    'multiple colors': null,
};

const resolveColor = (c) => {
    if (!c) return null;
    if (typeof c === 'string') {
        if (c.startsWith('#')) return c;
        if (c.startsWith('rgb')) return c;
        const mapped = COLOR_NAME_TO_HEX[c.toLowerCase()];
        return mapped === null ? null : (mapped || '#888888');
    }
    if (Array.isArray(c)) {
        return '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    }
    return null;
};

/* ── SVG Icons ── */
const Icons = {
    Close: () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    ZoomIn: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
    ),
    ZoomOut: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
    ),
    Hand: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 11V6a2 2 0 0 0-4 0v1" /><path d="M14 10V4a2 2 0 0 0-4 0v2" />
            <path d="M10 10.5V6a2 2 0 0 0-4 0v8" />
            <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
        </svg>
    ),
    Bookmark: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
    ),
    Check: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    ),
    Globe: () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    ),
    Calendar: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
    ),
    Palette: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" /><circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" /><circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
    ),
    Type: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
    ),
    Tag: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
            <line x1="7" y1="7" x2="7.01" y2="7" />
        </svg>
    ),
    Monitor: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    ),
    Images: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
        </svg>
    ),
    // Figma logo icon
    Figma: () => (
        <svg width="14" height="14" viewBox="0 0 38 57" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
            <path d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 0 1-19 0z" />
            <path d="M19 0v19h9.5a9.5 9.5 0 0 0 0-19H19z" />
            <path d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
            <path d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
        </svg>
    ),
    Copy: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    ),
    Spinner: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="wd-btn-spinner">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    ),
};

/* ── Platform Icons (inline) ── */
const PLATFORM_ICONS = {
    'Webflow': '◆',
    'Framer': '▲',
    'WordPress': '⬡',
    'Shopify': 'Store',
    'Squarespace': '■',
    'Wix': '◇',
};

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 10.0;
const ZOOM_STEP = 0.25;

/**
 * WebsiteDetailPopup — full-screen overlay for website search results.
 * LEFT: Zoomable + pannable image viewer
 * RIGHT: Metadata sidebar (colors, typefaces, platform, year, etc.)
 */
const WebsiteDetailPopup = ({
    image,
    isSelected = false,
    onClose,
    onSave,
}) => {
    if (!image) return null;

    const {
        image: thumbImage, fullImage, title, description, source, url,
        categories = [], colors = [], typefaces = [], platform,
        publishedYear, extraImages = [], components = [],
        isWebsiteResult,
    } = image;

    // ── Image viewer state ──
    const [zoom, setZoom] = useState(5);
    const [isPanning, setIsPanning] = useState(true);
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [activeImage, setActiveImage] = useState(fullImage || thumbImage);
    const [imgError, setImgError] = useState(false);
    const [isLoadingHD, setIsLoadingHD] = useState(false);

    // ── Figma converter state ──
    // 'idle' | 'loading' | 'ready' | 'copied' | 'error'
    const [figmaState, setFigmaState] = useState('idle');
    const [svgData, setSvgData] = useState(null);
    const [figmaError, setFigmaError] = useState('');

    const viewerRef = useRef(null);
    const imgRef = useRef(null);

    // Resolve colors to displayable values
    const displayColors = colors
        .map(c => {
            const hex = resolveColor(c);
            const label = typeof c === 'string' ? c : hex;
            return hex ? { hex, label } : null;
        })
        .filter(Boolean);

    // Progressive HD load
    useEffect(() => {
        if (!fullImage || fullImage === thumbImage) return;
        setIsLoadingHD(true);
        const hdImg = new Image();
        hdImg.onload = () => {
            setActiveImage(fullImage);
            setIsLoadingHD(false);
        };
        hdImg.onerror = () => setIsLoadingHD(false);
        hdImg.src = fullImage;
    }, [fullImage, thumbImage]);

    // Keyboard shortcuts
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose?.();
            if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX));
            if (e.key === '-') setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.classList.add('website-popup-open');
        document.body.classList.add('modal-open');
        return () => {
            document.body.style.overflow = '';
            document.body.classList.remove('website-popup-open');
            document.body.classList.remove('modal-open');
        };
    }, []);

    // ── Zoom via scroll wheel ──
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        setZoom(z => {
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            return Math.min(Math.max(z + delta, ZOOM_MIN), ZOOM_MAX);
        });
    }, []);

    // ── Pan handlers ──
    const handleMouseDown = useCallback((e) => {
        if (zoom <= 1) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }, [isPanning, zoom, panOffset]);

    const handleMouseMove = useCallback((e) => {
        if (!isDragging) return;
        setPanOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y,
        });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Reset pan when zoom resets
    useEffect(() => {
        if (zoom <= 1) {
            setPanOffset({ x: 0, y: 0 });
        }
    }, [zoom]);

    // ── Figma Plugin handler ──────────────────────────────────────────────────
    // Clicking "Open in Figma Plugin" stores the website URL on our backend.
    // The Figma plugin auto-reads it on load — no clipboard needed.
    const handleConvertToFigma = useCallback(async () => {
        if (!url) return;
        setFigmaState('loading');
        setSvgData(null);
        setFigmaError('');
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            // Store URL for the plugin to pick up
            await fetch(`${API_URL}/api/figma/current`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            setFigmaState('ready');
        } catch (err) {
            console.error('Figma plugin prep error:', err);
            setFigmaError(err.message || 'Failed to prepare');
            setFigmaState('error');
        }
    }, [url]);

    // Switch active image (for extra images)
    const switchImage = (imgUrl) => {
        setActiveImage(imgUrl);
        setZoom(1);
        setPanOffset({ x: 0, y: 0 });
        setImgError(false);
    };

    const imgSrc = !imgError ? activeImage : '/image-placeholder.svg';
    const zoomPercent = Math.round(zoom * 100);

    const cursorStyle = zoom > 1
        ? (isDragging ? 'grabbing' : 'grab')
        : 'zoom-in';

    return (
        <>
            {/* Backdrop */}
            <div className="wd-popup-backdrop" onClick={onClose} />

            {/* Main container */}
            <div className="wd-popup" role="dialog" aria-modal="true" aria-label={`${title} details`}>

                {/* ── LEFT: Image viewer ── */}
                <div className="wd-popup-viewer">
                    <div
                        className="wd-popup-image-area"
                        ref={viewerRef}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ cursor: cursorStyle }}
                        onClick={(e) => {
                            if (e.target === e.currentTarget) {
                                // Click on empty space
                            }
                        }}
                    >
                        <img
                            ref={imgRef}
                            src={imgSrc}
                            alt={title || 'Website screenshot'}
                            className={`wd-popup-main-image ${isLoadingHD ? 'loading' : ''}`}
                            onError={() => setImgError(true)}
                            draggable={false}
                            style={{
                                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
                                transformOrigin: 'center center',
                            }}
                        />
                        {isLoadingHD && (
                            <div className="wd-popup-loader">
                                <div className="wd-spinner" />
                            </div>
                        )}
                    </div>

                    {/* Zoom controls bar */}
                    <div className="wd-popup-zoom-bar">
                        <button
                            className="wd-zoom-btn"
                            onClick={() => setZoom(z => Math.max(z - ZOOM_STEP, ZOOM_MIN))}
                            title="Zoom out (−)"
                            aria-label="Zoom out"
                        >
                            <Icons.ZoomOut />
                        </button>
                        <input
                            type="range"
                            className="wd-zoom-slider"
                            min={ZOOM_MIN * 100}
                            max={ZOOM_MAX * 100}
                            value={zoom * 100}
                            onChange={(e) => setZoom(Number(e.target.value) / 100)}
                            aria-label="Zoom level"
                        />
                        <button
                            className="wd-zoom-btn"
                            onClick={() => setZoom(z => Math.min(z + ZOOM_STEP, ZOOM_MAX))}
                            title="Zoom in (+)"
                            aria-label="Zoom in"
                        >
                            <Icons.ZoomIn />
                        </button>
                        <span className="wd-zoom-label">{zoomPercent}%</span>
                    </div>

                    {/* Extra images strip */}
                    {extraImages.length > 0 && (
                        <div className="wd-popup-thumbstrip">
                            <div
                                className={`wd-thumb-item ${activeImage === (fullImage || thumbImage) ? 'active' : ''}`}
                                onClick={() => switchImage(fullImage || thumbImage)}
                            >
                                <img src={thumbImage || fullImage} alt="Main" draggable={false}
                                    onError={(e) => { e.target.src = '/image-placeholder.svg'; }} />
                                <span>Main</span>
                            </div>
                            {extraImages.map((ei, i) => (
                                <div
                                    key={i}
                                    className={`wd-thumb-item ${activeImage === ei.url ? 'active' : ''}`}
                                    onClick={() => switchImage(ei.url)}
                                >
                                    <img src={ei.url} alt={ei.title || `Page ${i + 1}`} draggable={false}
                                        onError={(e) => { e.target.src = '/image-placeholder.svg'; }} />
                                    <span>{ei.title || `Page ${i + 1}`}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── RIGHT: Metadata sidebar ── */}
                <div className="wd-popup-sidebar">
                    <div className="wd-popup-sidebar-scroll">

                        {/* Close */}
                        <button className="wd-popup-close" onClick={onClose} aria-label="Close">
                            <Icons.Close />
                        </button>

                        {/* Header */}
                        <div className="wd-popup-header">
                            <h2 className="wd-popup-title">{title}</h2>
                            {description && <p className="wd-popup-description">{description}</p>}
                        </div>

                        {/* Metadata sections */}
                        <div className="wd-popup-meta">

                            {/* Categories */}
                            {categories.length > 0 && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Tag /> Categories</div>
                                    <div className="wd-meta-chips">
                                        {categories.map((cat, i) => (
                                            <span key={i} className="wd-meta-chip">{cat}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Colors */}
                            {displayColors.length > 0 && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Palette /> Colors</div>
                                    <div className="wd-meta-colors">
                                        {displayColors.map((c, i) => (
                                            <div key={i} className="wd-color-item" title={c.label}>
                                                <div className="wd-color-swatch" style={{ background: c.hex }} />
                                                <span className="wd-color-name">{c.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Typefaces */}
                            {typefaces.length > 0 && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Type /> Typefaces</div>
                                    <div className="wd-meta-chips">
                                        {typefaces.map((f, i) => (
                                            <span key={i} className="wd-meta-chip wd-chip-typeface">{f}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Platform */}
                            {platform && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Monitor /> Platform</div>
                                    <div className="wd-meta-platform">
                                        {PLATFORM_ICONS[platform] && <span className="wd-platform-icon">{PLATFORM_ICONS[platform]}</span>}
                                        <span>{platform}</span>
                                    </div>
                                </div>
                            )}

                            {/* Year */}
                            {publishedYear && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Calendar /> Year</div>
                                    <div className="wd-meta-year">{publishedYear}</div>
                                </div>
                            )}

                            {/* Components (Landbook) */}
                            {components.length > 0 && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Monitor /> Components</div>
                                    <div className="wd-meta-chips">
                                        {components.map((comp, i) => (
                                            <span key={i} className="wd-meta-chip">{comp}</span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Extra Pages gallery */}
                            {extraImages.length > 0 && (
                                <div className="wd-meta-section">
                                    <div className="wd-meta-label"><Icons.Images /> More Pages ({extraImages.length})</div>
                                    <div className="wd-meta-gallery">
                                        {extraImages.map((ei, i) => (
                                            <div
                                                key={i}
                                                className="wd-gallery-thumb"
                                                onClick={() => switchImage(ei.url)}
                                                title={ei.title || `Page ${i + 1}`}
                                            >
                                                <img src={ei.url} alt={ei.title || `Page ${i + 1}`} draggable={false}
                                                    onError={(e) => { e.target.src = '/image-placeholder.svg'; }} />
                                                <span className="wd-gallery-label">{ei.title || `Page ${i + 1}`}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>

                    {/* Sticky action buttons */}
                    <div className="wd-popup-actions">
                        <button
                            className={`wd-action-primary ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => onSave?.(image, e)}
                        >
                            {isSelected ? <><Icons.Check /> Saved to Moodboard</> : <><Icons.Bookmark /> Save to Moodboard</>}
                        </button>
                        {url && (
                            <button
                                className="wd-action-secondary"
                                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                            >
                                <Icons.Globe /> Visit Website
                            </button>
                        )}

                        {/* ── Convert to Figma ── only for website results ── */}
                        {isWebsiteResult && url && (
                            <>
                                {figmaState === 'idle' && (
                                    <button
                                        className="wd-action-figma"
                                        onClick={handleConvertToFigma}
                                        id="btn-convert-figma"
                                    >
                                        <Icons.Figma /> Open in Figma Plugin
                                    </button>
                                )}
                                {figmaState === 'loading' && (
                                    <button className="wd-action-figma loading" disabled>
                                        <Icons.Spinner /> Preparing URL…
                                    </button>
                                )}
                                {figmaState === 'ready' && (
                                    <div className="wd-figma-ready-box">
                                        <p className="wd-figma-ready-title"><Icons.Check /> Link Ready for Figma</p>
                                        <ol className="wd-figma-ready-steps">
                                            <li>Open the <strong>Inspo AI</strong> plugin in Figma</li>
                                            <li>The URL will auto-fill</li>
                                            <li>Click <strong>Import</strong></li>
                                        </ol>
                                    </div>
                                )}
                                {figmaState === 'error' && (
                                    <button
                                        className="wd-action-figma error"
                                        onClick={handleConvertToFigma}
                                        title={figmaError}
                                    >
                                        <Icons.Figma /> Retry Convert to Figma
                                    </button>
                                )}
                                {figmaState === 'error' && figmaError && (
                                    <p className="wd-figma-error">{figmaError}</p>
                                )}
                            </>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
};

export default WebsiteDetailPopup;
