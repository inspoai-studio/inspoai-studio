import React, { useState, useEffect, useCallback, useRef } from 'react';

/**
 * IconCustomizer — Capability-aware edit panel for icons
 * 
 * Controls shown/hidden based on icon.iconMeta.capabilities:
 *   - Color picker: all sources
 *   - Size selector: all sources (16/24/32/48px)
 *   - Stroke width slider: Iconoir, SVG Repo, Iconify
 *   - Weight slider (100-700): Material only
 *   - Line/Fill toggle: Remix only (when variants exist)
 * 
 * Actions: Copy SVG, Copy PNG, Download SVG, Download PNG, Add to Moodboard
 */
const IconCustomizer = ({ icon, onClose, onAddToMoodboard }) => {
    const [color, setColor] = useState('#000000');
    const [strokeWidth, setStrokeWidth] = useState(0);
    const [size, setSize] = useState(48);
    const [weight, setWeight] = useState(400);
    const [activeVariant, setActiveVariant] = useState('line'); // 'line' or 'fill' for Remix
    const [svgContent, setSvgContent] = useState('');
    const [previewUrl, setPreviewUrl] = useState(icon.image);
    const [copied, setCopied] = useState(false);
    const [copiedPng, setCopiedPng] = useState(false);
    const [pngSize, setPngSize] = useState(128); // PNG export size
    const panelRef = useRef(null);
    const canvasRef = useRef(null);

    // Read capabilities from the icon
    const caps = icon.iconMeta?.capabilities || {
        color: true, size: true, weight: false, fill: false, strokeWidth: true, variants: null
    };

    // Preset color palette
    const presetColors = [
        '#000000', '#FFFFFF', '#FF3B30', '#FF9500', '#FFCC00',
        '#34C759', '#00C7BE', '#007AFF', '#5856D6', '#AF52DE',
        '#FF2D55', '#A2845E', '#8E8E93', '#636366', '#1C1C1E'
    ];

    const sizeOptions = [16, 24, 32, 48];
    const pngSizeOptions = [48, 128, 256, 512];

    // Get current SVG URL based on active controls
    const getCurrentSvgUrl = useCallback(() => {
        const meta = icon.iconMeta || {};
        const caps = icon.capabilities || {};

        // Google Material Icons (direct SVG URLs for variable weights)
        if (icon.source === 'Material' || icon.source === 'Material Symbols') {
            const name = meta.iconId || (icon.title || '').toLowerCase().replace(/\s+/g, '_');
            const w = weight || 400;
            const isFilled = activeVariant === 'fill';

            // Build the variant part of the URL (e.g., 'default', 'wght700', 'fill1', 'fill1_wght700')
            let variantPart = '';
            if (isFilled && w !== 400) variantPart = `fill1_wght${w}`;
            else if (isFilled) variantPart = 'fill1';
            else if (w !== 400) variantPart = `wght${w}`;
            else variantPart = 'default';

            return `https://fonts.gstatic.com/s/i/short-term/release/materialsymbolsoutlined/${name}/${variantPart}/48px.svg`;
        }

        // Weight support for other sources (if they provided a template URL, which we removed from Material but kept for others? No, better use a generic pattern if weight is enabled)
        if (caps.weight && weight && weight !== 400 && meta.weightUrl) {
            return typeof meta.weightUrl === 'function' ? meta.weightUrl(weight) : meta.svgUrl;
        }

        // Material: filled variant fallback (for non-variable sources)
        if (caps.fill && activeVariant === 'fill' && meta.filledUrl) {
            return meta.filledUrl;
        }

        // Remix: line/fill toggle
        if (caps.variants && Array.isArray(caps.variants)) {
            if (activeVariant === 'fill' && meta.fillUrl) return meta.fillUrl;
            if (activeVariant === 'line' && meta.lineUrl) return meta.lineUrl;
        }

        return meta.svgUrl || icon.image;
    }, [icon, caps, weight, activeVariant]);

    // Fetch raw SVG content when source URL changes
    useEffect(() => {
        const fetchSvg = async () => {
            try {
                const svgUrl = getCurrentSvgUrl();
                const res = await fetch(svgUrl);
                if (res.ok) {
                    const text = await res.text();
                    setSvgContent(text);
                }
            } catch (err) {
                console.error('Failed to fetch SVG:', err);
            }
        };
        fetchSvg();
    }, [getCurrentSvgUrl]);

    // Build preview URL (Iconify color param or data URI for stroke edits)
    useEffect(() => {
        const baseUrl = getCurrentSvgUrl();
        if (!baseUrl) return;

        // For Iconify-hosted SVGs, use URL params for color
        if (baseUrl.includes('iconify.design')) {
            const base = baseUrl.split('?')[0];
            const params = new URLSearchParams();
            params.set('width', String(size));
            params.set('height', String(size));
            if (color && color !== '#000000') {
                params.set('color', color.replace('#', '%23'));
            }
            setPreviewUrl(`${base}?${params.toString()}`);
        } else {
            setPreviewUrl(baseUrl);
        }
    }, [color, size, getCurrentSvgUrl]);

    // Generate customized SVG with all edits applied
    const getCustomizedSvg = useCallback(() => {
        if (!svgContent) return '';
        let svg = svgContent;

        // Apply color
        if (color) {
            // Replace existing fills/strokes
            svg = svg.replace(/fill="(?!none)[^"]*"/g, `fill="${color}"`);
            svg = svg.replace(/stroke="(?!none)[^"]*"/g, `stroke="${color}"`);

            // If no fill attribute matches on paths, try adding it to the root svg tag or paths
            if (!svg.includes(`fill="${color}"`) && !svg.includes('fill="none"')) {
                svg = svg.replace(/<svg/, `<svg fill="${color}"`);
            }
        }

        // Apply stroke width
        if (strokeWidth > 0 && caps.strokeWidth) {
            if (svg.includes('stroke-width')) {
                svg = svg.replace(/stroke-width="[^"]*"/g, `stroke-width="${strokeWidth}"`);
            } else {
                svg = svg.replace(/<(path|line|polyline|polygon|circle|rect|ellipse)/g,
                    `<$1 stroke-width="${strokeWidth}"`);
            }
            if (!svg.includes('stroke=')) {
                svg = svg.replace(/<(path|line|polyline|polygon|circle|rect|ellipse)/g,
                    `<$1 stroke="${color}"`);
            }
        }

        // Apply size via viewBox / width / height
        svg = svg.replace(/width="[^"]*"/, `width="${size}"`);
        svg = svg.replace(/height="[^"]*"/, `height="${size}"`);

        return svg;
    }, [svgContent, color, strokeWidth, size, caps]);

    // Preview source
    const getPreviewSrc = useCallback(() => {
        if ((strokeWidth > 0 || color !== '#000000') && svgContent) {
            const customSvg = getCustomizedSvg();
            return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(customSvg)}`;
        }
        return previewUrl;
    }, [strokeWidth, color, svgContent, previewUrl, getCustomizedSvg, weight, activeVariant]);

    // ── SVG → Canvas helper (used by PNG copy + download) ──
    const svgToCanvas = useCallback((exportSize) => {
        return new Promise((resolve, reject) => {
            const svg = getCustomizedSvg();
            if (!svg) return reject(new Error('No SVG content'));

            const canvas = document.createElement('canvas');
            canvas.width = exportSize;
            canvas.height = exportSize;
            const ctx = canvas.getContext('2d');

            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, exportSize, exportSize);
                resolve(canvas);
            };
            img.onerror = () => reject(new Error('SVG render failed'));
            img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        });
    }, [getCustomizedSvg]);

    // ── Copy SVG ──
    const handleCopySvg = async () => {
        let svg = getCustomizedSvg();
        if (!svg) {
            // Fallback: fetch from URL
            try {
                const res = await fetch(getCurrentSvgUrl());
                svg = await res.text();
            } catch { return; }
        }

        try {
            await navigator.clipboard.writeText(svg);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Copy SVG failed:', err);
        }
    };

    // ── Copy PNG ──
    const handleCopyPng = async () => {
        try {
            const canvas = await svgToCanvas(pngSize);
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    setCopiedPng(true);
                    setTimeout(() => setCopiedPng(false), 2000);
                } catch (err) {
                    // Fallback: download instead
                    console.warn('Clipboard write failed, downloading instead:', err);
                    downloadBlob(blob, 'png');
                }
            }, 'image/png');
        } catch (err) {
            console.error('Copy PNG failed:', err);
        }
    };

    // ── Download SVG ──
    const handleDownloadSvg = async () => {
        let svg = getCustomizedSvg();

        if (!svg) {
            try {
                const res = await fetch(getCurrentSvgUrl());
                if (res.ok) svg = await res.text();
            } catch { }
        }

        if (!svg) {
            // Last resort: open URL
            window.open(getCurrentSvgUrl(), '_blank');
            return;
        }

        const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, 'svg');
    };

    // ── Download PNG ──
    const handleDownloadPng = async () => {
        try {
            const canvas = await svgToCanvas(pngSize);
            canvas.toBlob((blob) => {
                if (blob) downloadBlob(blob, 'png');
            }, 'image/png');
        } catch (err) {
            console.error('Download PNG failed:', err);
        }
    };

    // ── Blob download helper ──
    const downloadBlob = (blob, ext) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(icon.title || 'icon').replace(/\s+/g, '-').toLowerCase()}.${ext}`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    };

    // Add customized icon to moodboard
    const handleAddToMoodboard = () => {
        const customizedIcon = {
            ...icon,
            image: getPreviewSrc(),
            title: `${icon.title} (${color})`
        };
        if (onAddToMoodboard) onAddToMoodboard(customizedIcon);
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    return (
        <div className="icon-customizer-backdrop" onClick={onClose}>
            <div
                className="icon-customizer-panel"
                ref={panelRef}
                onClick={(e) => e.stopPropagation()}
            >
                {/* ── Left Column: Large Preview ── */}
                <div
                    className="icon-customizer-left"
                    style={{ background: isLightColor(color) ? '#1d1d1f' : '#f5f5f7' }}
                >
                    <img
                        src={getPreviewSrc()}
                        alt={icon.title}
                        key={`${color}-${strokeWidth}-${size}-${weight}-${activeVariant}`}
                    />
                </div>

                {/* ── Right Column: Controls ── */}
                <div className="icon-customizer-right">
                    {/* Close button */}
                    <button className="icon-customizer-close" onClick={onClose} title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>

                    {/* Icon name + source badge */}
                    <h4 className="icon-customizer-title">{icon.title}</h4>
                    <span className="icon-customizer-source">
                        {icon.source}
                        {icon.iconMeta?.collection ? ` · ${icon.iconMeta.collection}` : ''}
                    </span>

                    {/* ── Color section ── */}
                    <div className="icon-customizer-section">
                        <label className="icon-customizer-label">Color</label>
                        <div className="icon-customizer-color-row">
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="icon-customizer-color-input"
                            />
                            <input
                                type="text"
                                value={color}
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v);
                                }}
                                className="icon-customizer-hex-input"
                                spellCheck={false}
                                maxLength={7}
                            />
                        </div>
                        <div className="icon-customizer-presets">
                            {presetColors.map((c) => (
                                <button
                                    key={c}
                                    className={`icon-preset-color ${color === c ? 'active' : ''}`}
                                    style={{ background: c, border: c === '#FFFFFF' ? '1px solid #ddd' : 'none' }}
                                    onClick={() => setColor(c)}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>

                    {/* ── Size section ── */}
                    <div className="icon-customizer-section">
                        <label className="icon-customizer-label">Size</label>
                        <div className="icon-customizer-size-row">
                            {sizeOptions.map((s) => (
                                <button
                                    key={s}
                                    className={`icon-size-btn ${size === s ? 'active' : ''}`}
                                    onClick={() => setSize(s)}
                                >
                                    {s}px
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Weight section (Material only) ── */}
                    {caps.weight && (
                        <div className="icon-customizer-section">
                            <label className="icon-customizer-label">
                                Weight
                                <span className="icon-customizer-value">{weight}</span>
                            </label>
                            <input
                                type="range"
                                min="100"
                                max="700"
                                step="100"
                                value={weight}
                                onChange={(e) => setWeight(parseInt(e.target.value))}
                                className="icon-customizer-slider"
                            />
                        </div>
                    )}

                    {/* ── Stroke Width section (Iconoir, SVG Repo, Iconify) ── */}
                    {caps.strokeWidth && (
                        <div className="icon-customizer-section">
                            <label className="icon-customizer-label">
                                Stroke Width
                                <span className="icon-customizer-value">{strokeWidth}</span>
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="4"
                                step="0.5"
                                value={strokeWidth}
                                onChange={(e) => setStrokeWidth(parseFloat(e.target.value))}
                                className="icon-customizer-slider"
                            />
                        </div>
                    )}

                    {/* ── Line/Fill toggle (Remix only) ── */}
                    {caps.variants && Array.isArray(caps.variants) && caps.variants.length > 1 && (
                        <div className="icon-customizer-section">
                            <label className="icon-customizer-label">Style</label>
                            <div className="icon-customizer-variant-row">
                                {caps.variants.map((v) => (
                                    <button
                                        key={v}
                                        className={`icon-variant-btn ${activeVariant === v ? 'active' : ''}`}
                                        onClick={() => setActiveVariant(v)}
                                    >
                                        {v.charAt(0).toUpperCase() + v.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Filled toggle (Material only) ── */}
                    {caps.fill && (
                        <div className="icon-customizer-section">
                            <label className="icon-customizer-label">Style</label>
                            <div className="icon-customizer-variant-row">
                                <button
                                    className={`icon-variant-btn ${activeVariant === 'line' ? 'active' : ''}`}
                                    onClick={() => setActiveVariant('line')}
                                >
                                    Outlined
                                </button>
                                <button
                                    className={`icon-variant-btn ${activeVariant === 'fill' ? 'active' : ''}`}
                                    onClick={() => setActiveVariant('fill')}
                                >
                                    Filled
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── PNG Export Size ── */}
                    <div className="icon-customizer-section">
                        <label className="icon-customizer-label">PNG Export Size</label>
                        <div className="icon-customizer-size-row">
                            {pngSizeOptions.map((s) => (
                                <button
                                    key={s}
                                    className={`icon-size-btn ${pngSize === s ? 'active' : ''}`}
                                    onClick={() => setPngSize(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* ── Actions ── */}
                    <div className="icon-customizer-actions">
                        <button className="icon-customizer-btn icon-btn-copy" onClick={handleCopySvg}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            {copied ? 'Copied!' : 'Copy SVG'}
                        </button>
                        <button className="icon-customizer-btn icon-btn-copy" onClick={handleCopyPng}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="3" y="3" width="18" height="18" rx="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" />
                                <polyline points="21 15 16 10 5 21" />
                            </svg>
                            {copiedPng ? 'Copied!' : 'Copy PNG'}
                        </button>
                    </div>
                    <div className="icon-customizer-actions">
                        <button className="icon-customizer-btn icon-btn-download" onClick={handleDownloadSvg}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            SVG
                        </button>
                        <button className="icon-customizer-btn icon-btn-download" onClick={handleDownloadPng}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="7 10 12 15 17 10" />
                                <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            PNG
                        </button>
                        <button className="icon-customizer-btn icon-btn-add" onClick={handleAddToMoodboard}>
                            + Moodboard
                        </button>
                    </div>
                </div>

                {/* Hidden canvas for PNG export */}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
        </div>
    );
};

// Helper: determine if a hex color is light
function isLightColor(hex) {
    if (!hex || hex.length < 7) return false;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 186;
}

export default IconCustomizer;
