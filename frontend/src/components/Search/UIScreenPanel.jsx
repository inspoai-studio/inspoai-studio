import React, { useState, useEffect } from 'react';
import '../../styles/UIScreenPanel.css';

// Convert [R,G,B] tuple → #RRGGBB hex
const rgbToHex = ([r, g, b]) => {
    if (r == null) return '#888888';
    return '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
};

const faviconUrl = (domain) =>
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;

// SVG icon components (no emojis)
const Icons = {
    Close: () => (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
    ),
    PageType: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
        </svg>
    ),
    UXPattern: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M4.93 4.93a10 10 0 0 0 0 14.14" />
        </svg>
    ),
    UIElement: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
    ),
    Font: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
    ),
    Color: () => (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
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
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    ),
};

/**
 * UIScreenPanel — full-screen split view.
 * LEFT: Large screenshot | RIGHT: Dark metadata panel
 */
const UIScreenPanel = ({
    image,
    allResults = [],
    isSelected = false,
    onClose,
    onSave,
    onVisit,
    onSelectRelated,
}) => {
    if (!image) return null;

    const {
        fullImage, image: thumbImage, title, siteName, siteDomain, url,
        uxPatterns = [], pageTypes = [], uiElements = [], fonts = [], colors = [],
    } = image;

    const [displaySrc, setDisplaySrc] = useState(thumbImage || fullImage);
    const [isLoadingHD, setIsLoadingHD] = useState(fullImage !== thumbImage && !!fullImage);
    const [imgError, setImgError] = useState(false);

    const [faviconError, setFaviconError] = useState(false);

    // Progressive load: show thumbnail instantly (already in browser cache),
    // then silently load the HD image and swap it in when ready.
    useEffect(() => {
        if (!fullImage || fullImage === thumbImage) return;
        const hdImg = new Image();
        hdImg.onload = () => {
            setDisplaySrc(fullImage);
            setIsLoadingHD(false);
        };
        hdImg.src = fullImage;

    }, [fullImage, thumbImage]);


    // Escape to close
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Lock body scroll + hide floating search bar while panel is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        document.body.classList.add('ui-panel-open');
        return () => {
            document.body.style.overflow = '';
            document.body.classList.remove('ui-panel-open');
        };
    }, []);

    const imgSrc = !imgError ? (displaySrc || fullImage || thumbImage) : '/image-placeholder.svg';

    const displayName = siteName || title || 'App';
    const favicon = !faviconError && siteDomain ? faviconUrl(siteDomain) : null;

    const relatedScreens = allResults
        .filter(r => r.siteName === siteName && r.image !== (thumbImage || fullImage))
        .slice(0, 6);

    const colorHexes = (colors || []).slice(0, 6).map(c => {
        if (Array.isArray(c)) return rgbToHex(c);
        if (typeof c === 'string') return c.startsWith('#') ? c : `#${c}`;
        return null;
    }).filter(Boolean);


    return (
        <>
            {/* Backdrop — click to close */}
            <div className="ui-panel-backdrop" onClick={onClose} />

            {/* Split layout container */}
            <div className="ui-panel" role="dialog" aria-modal="true" aria-label={`${displayName} details`}>

                {/* ── LEFT: Large image ── */}
                <div className="ui-panel-image-side" onClick={onClose} title="Click to close">
                    <div className="ui-panel-image-wrapper">
                        <img
                            src={imgSrc}
                            alt={`${displayName} screenshot`}
                            onError={() => setImgError(true)}
                            onClick={(e) => e.stopPropagation()} /* don't close when clicking image itself */
                            className={isLoadingHD ? 'img-loading' : ''}
                        />
                        {isLoadingHD && !imgError && (
                            <div className="ui-panel-hd-loader">
                                <div className="ui-spinner"></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── RIGHT: Metadata panel ── */}
                <div className="ui-panel-right">
                    {/* Scrollable content */}
                    <div className="ui-panel-scroll">

                        {/* Close button */}
                        <div className="ui-panel-close">
                            <button className="ui-panel-close-btn" onClick={onClose} aria-label="Close">
                                <Icons.Close />
                            </button>
                        </div>

                        {/* App header */}
                        <div className="ui-panel-app-header">
                            {favicon && (
                                <img
                                    className="ui-panel-favicon"
                                    src={favicon}
                                    alt={displayName}
                                    onError={() => setFaviconError(true)}
                                />
                            )}
                            <div className="ui-panel-app-info">
                                <div className="ui-panel-app-name">{displayName}</div>
                                {siteDomain && <div className="ui-panel-app-domain">via {siteDomain}</div>}
                            </div>
                        </div>

                        {/* Metadata sections */}
                        <div className="ui-panel-body">

                            {pageTypes.length > 0 && (
                                <div className="ui-panel-section">
                                    <div className="ui-panel-section-label">
                                        <Icons.PageType /> Page Types
                                    </div>
                                    <div className="ui-panel-chips">
                                        {pageTypes.map((pt, i) => <span key={i} className="ui-panel-chip">{pt}</span>)}
                                    </div>
                                </div>
                            )}

                            {uxPatterns.length > 0 && (
                                <div className="ui-panel-section">
                                    <div className="ui-panel-section-label">
                                        <Icons.UXPattern /> UX Patterns
                                    </div>
                                    <div className="ui-panel-chips">
                                        {uxPatterns.map((p, i) => <span key={i} className="ui-panel-chip">{p}</span>)}
                                    </div>
                                </div>
                            )}

                            {uiElements.length > 0 && (
                                <div className="ui-panel-section">
                                    <div className="ui-panel-section-label">
                                        <Icons.UIElement /> UI Elements
                                    </div>
                                    <div className="ui-panel-chips">
                                        {uiElements.map((el, i) => <span key={i} className="ui-panel-chip">{el}</span>)}
                                    </div>
                                </div>
                            )}

                            {fonts.length > 0 && (
                                <div className="ui-panel-section">
                                    <div className="ui-panel-section-label">
                                        <Icons.Font /> Fonts
                                    </div>
                                    <div className="ui-panel-chips">
                                        {fonts.map((f, i) => <span key={i} className="ui-panel-chip">{f}</span>)}
                                    </div>
                                </div>
                            )}

                            {colorHexes.length > 0 && (
                                <div className="ui-panel-section">
                                    <div className="ui-panel-section-label">
                                        <Icons.Color /> Colors
                                    </div>
                                    <div className="ui-panel-colors">
                                        {colorHexes.map((hex, i) => (
                                            <div key={i} className="ui-panel-color-item" title={hex}>
                                                <div className="ui-panel-color-dot" style={{ background: hex }} />
                                                <span className="ui-panel-color-hex">{hex}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* More from app */}
                        {relatedScreens.length > 0 && (
                            <div className="ui-panel-more-section">
                                <div className="ui-panel-more-label">More from {displayName}</div>
                                <div className="ui-panel-more-grid">
                                    {relatedScreens.map((r, i) => (
                                        <div
                                            key={i}
                                            className="ui-panel-more-thumb"
                                            onClick={() => onSelectRelated?.(r)}
                                            title={r.pageTypes?.[0] || r.title}
                                        >
                                            <img
                                                src={r.image}
                                                alt={r.title}
                                                onError={(e) => { e.target.src = '/image-placeholder.svg'; }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Sticky action buttons */}
                    <div className="ui-panel-actions">
                        <button
                            className={`ui-panel-btn-primary ${isSelected ? 'selected' : ''}`}
                            onClick={(e) => onSave?.(image, e)}
                        >
                            {isSelected ? <><Icons.Check /> Saved to Moodboard</> : <><Icons.Bookmark /> Save to Moodboard</>}
                        </button>
                        {url && (
                            <button className="ui-panel-btn-secondary" onClick={() => onVisit?.(url)}>
                                <Icons.Globe /> Visit Website
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </>
    );
};

export default UIScreenPanel;
