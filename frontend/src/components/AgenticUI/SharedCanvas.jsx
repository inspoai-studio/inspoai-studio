import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Rnd } from 'react-rnd';
import '../../styles/AgenticUI.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function buildPreviewHtml(card) {
  const escapedHtml = JSON.stringify(card.html).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${card.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root { --bg: #F5F5F7; --control-bg: rgba(255,255,255,0.9); --border: rgba(0,0,0,0.08); --text: #1D1D1F; --text-muted: #86868B; --accent: #6C5CE7; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background-color: var(--bg); height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    .workspace { flex: 1; width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: radial-gradient(circle, rgba(0,0,0,0.02) 1px, transparent 1px) 0 0 / 20px 20px, #F8F9FA; overflow: hidden; position: relative; }
    .frame-container { position: relative; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); box-shadow: 0 12px 40px rgba(0,0,0,0.12); background: #000; box-sizing: border-box; }
    .frame-container.desktop { width: 100%; height: 100%; border-radius: 0; border: none; box-shadow: none; max-width: 100%; max-height: 100%; }
    .frame-container.tablet { width: 1024px; height: 768px; border-radius: 24px; border: 12px solid #000; outline: 1px solid var(--border); transform: scale(0.75); transform-origin: center; }
    .frame-container.mobile { width: 393px; height: 852px; border-radius: 48px; border: 12px solid #000; outline: 1px solid var(--border); transform: scale(0.67); transform-origin: center; }
    iframe { width: 100%; height: 100%; border: none; background: #fff; display: block; }
    .frame-container.desktop iframe { border-radius: 0; }
    .frame-container.tablet iframe { border-radius: 12px; }
    .frame-container.mobile iframe { border-radius: 36px; }
    .floating-selector { position: fixed; bottom: 24px; right: 24px; background: var(--control-bg); border: 1px solid var(--border); backdrop-filter: blur(20px); padding: 4px; border-radius: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); display: flex; gap: 4px; z-index: 1000; align-items: center; }
    .device-btn { background: transparent; border: none; color: var(--text-muted); width: 36px; height: 36px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .device-btn svg { width: 16px; height: 16px; stroke: currentColor; }
    .device-btn:hover { color: var(--text); background: rgba(0,0,0,0.04); }
    .device-btn.active { color: #fff; background: var(--accent); box-shadow: 0 2px 8px rgba(108,92,231,0.25); }
    .dimension-label { font-size: 10px; font-weight: 700; color: var(--text-muted); padding: 0 8px 0 4px; font-family: monospace; user-select: none; }
  </style>
</head>
<body>
  <div class="workspace">
    <div class="frame-container mobile" id="frame-container">
      <iframe id="preview-iframe"></iframe>
    </div>
  </div>
  <div class="floating-selector">
    <button class="device-btn" id="btn-desktop" onclick="setDevice('desktop','100%','100%')" title="Desktop Web">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    </button>
    <button class="device-btn" id="btn-tablet" onclick="setDevice('tablet','1024px','768px')" title="Tablet">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
    </button>
    <button class="device-btn active" id="btn-mobile" onclick="setDevice('mobile','393px','852px')" title="Mobile">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
    </button>
    <div style="width:1px;height:16px;background:var(--border);margin:0 4px;"></div>
    <span class="dimension-label" id="dimensions">393px × 852px</span>
  </div>
  <script>
    const cardHtml = ${escapedHtml};
    document.getElementById('preview-iframe').srcdoc = cardHtml;
    function setDevice(deviceClass, w, h) {
      document.querySelectorAll('.device-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('btn-' + deviceClass).classList.add('active');
      const container = document.getElementById('frame-container');
      container.className = 'frame-container ' + deviceClass;
      const wVal = deviceClass === 'desktop' ? window.innerWidth + 'px' : w;
      const hVal = deviceClass === 'desktop' ? window.innerHeight + 'px' : h;
      document.getElementById('dimensions').innerText = wVal + ' × ' + hVal;
    }
    window.addEventListener('resize', () => {
      if (document.getElementById('btn-desktop').classList.contains('active'))
        document.getElementById('dimensions').innerText = window.innerWidth + 'px × ' + window.innerHeight + 'px';
    });
  </script>
</body>
</html>`;
}

export default function SharedCanvas() {
  const { sessionId } = useParams();
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [ownerRole, setOwnerRole] = useState('free');
  const [activeTool, setActiveTool] = useState('hand');
  const [zoomScale, setZoomScale] = useState(1);
  const [selectedCard, setSelectedCard] = useState(null);
  const [exportingFigmaCardId, setExportingFigmaCardId] = useState(null);
  const [exportToastCardId, setExportToastCardId] = useState(null);
  const [activeResponsiveDropdownCardId, setActiveResponsiveDropdownCardId] = useState(null);
  const [cardPlatforms, setCardPlatforms] = useState({});
  const [isDragging, setIsDragging] = useState(null);
  const transformApiRef = useRef(null);

  const handleIframeLoad = (e) => {
    const iframe = e.target;
    if (!iframe || !iframe.contentWindow) return;
    try {
      const doc = iframe.contentWindow.document;
      if (doc) {
        doc.addEventListener('click', (event) => {
          const targetLink = event.target.closest('a');
          if (targetLink) {
            const href = targetLink.getAttribute('href');
            if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) {
              event.preventDefault();
            }
          }
        });
      }
    } catch (err) {
      console.error('Failed to intercept iframe clicks:', err);
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/agentic-ui/shared/${sessionId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); setLoading(false); return; }
        const screens = (data.screens || []).map(s => ({
          ...s,
          x: s.canvasX ?? 80,
          y: s.canvasY ?? 120,
          width: s.canvasWidth ?? 1440,
          height: s.canvasHeight ?? 960,
        }));
        setCards(screens);
        setOwnerRole(data.ownerRole || 'free');
        setLoading(false);
      })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [sessionId]);

  // Auto-fit the view to show all cards after they load
  useEffect(() => {
    if (cards.length === 0 || !transformApiRef.current) return;
    const minX = Math.min(...cards.map(c => c.x));
    const minY = Math.min(...cards.map(c => c.y));
    const maxX = Math.max(...cards.map(c => c.x + c.width));
    const maxY = Math.max(...cards.map(c => c.y + c.height));
    const totalW = maxX - minX;
    const totalH = maxY - minY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 120;
    const scale = Math.min((vw - padding) / totalW, (vh - padding) / totalH, 1);
    const newX = (vw - totalW * scale) / 2 - minX * scale;
    const newY = (vh - totalH * scale) / 2 - minY * scale;
    setTimeout(() => {
      transformApiRef.current?.setTransform(newX, newY, scale, 400, 'easeOut');
    }, 150);
  }, [cards.length]);

  useEffect(() => {
    const handleGlobalClick = () => setActiveResponsiveDropdownCardId(null);
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const getCardPlatform = (card) => cardPlatforms[card.id] || card.platform || 'web';

  const handleCardPlatformChange = (cardId, newPlatform) => {
    setCardPlatforms(prev => ({ ...prev, [cardId]: newPlatform }));
    setActiveResponsiveDropdownCardId(null);
  };

  const copyCardCode = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const match = card.html.match(/\/\/ LLM Generated Component Code:\s*([\s\S]*?)\s*\/\/ Dynamic Mount Execution/);
    const code = match ? match[1].trim() : card.html;
    navigator.clipboard.writeText(code);
  };

  const handleExportToFigma = async (cardId) => {
    if (exportingFigmaCardId) return;
    const card = cards.find(c => c.id === cardId);
    if (!card?.html) return;
    setExportingFigmaCardId(cardId);
    setExportToastCardId(null);
    try {
      if (!window.figma?.silentCapture) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/figma-capture.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Figma capture script'));
          document.head.appendChild(script);
        });
      }
      const tempId = `figma-temp-dom-${cardId}`;
      const tempEl = document.createElement('div');
      tempEl.id = tempId;
      tempEl.style.cssText = 'position:fixed;top:0;left:-9999px;';
      const cardPlatform = getCardPlatform(card);
      let tempWidth = '1440px';
      let tempHeight = '900px';
      if (cardPlatform === 'ios') {
        tempWidth = '393px';
        tempHeight = '852px';
      } else if (cardPlatform === 'tablet') {
        tempWidth = '1366px';
        tempHeight = '1024px';
      }
      tempEl.style.width = tempWidth;
      tempEl.style.height = tempHeight;
      const iframe = document.querySelector(`#figma-target-${cardId} iframe`);
      if (!iframe) throw new Error('Card iframe not found');
      await Promise.race([
        new Promise(r => {
          const doc = iframe.contentDocument;
          if (doc?.readyState === 'complete' || doc?.readyState === 'interactive') { r(); return; }
          iframe.addEventListener('load', r, { once: true });
        }),
        new Promise(r => setTimeout(r, 1500)),
      ]);
      const iframeDoc = iframe.contentDocument;
      if (!iframeDoc) throw new Error('Cannot access iframe document');
      iframeDoc.querySelectorAll('head style, head link[rel="stylesheet"]').forEach(s => tempEl.appendChild(s.cloneNode(true)));
      const bodyContent = document.createElement('div');
      bodyContent.style.cssText = 'width:100%;height:100%;';
      bodyContent.innerHTML = iframeDoc.body.innerHTML;
      tempEl.appendChild(bodyContent);
      document.body.appendChild(tempEl);
      await document.fonts.ready;
      const imgs = Array.from(tempEl.querySelectorAll('img'));
      await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })));
      await window.figma.silentCapture(`#${tempId}`);
      document.body.removeChild(tempEl);
      setExportToastCardId(cardId);
      setTimeout(() => setExportToastCardId(null), 4000);
    } catch (err) {
      console.error('Figma export failed:', err);
      alert(`Figma export failed: ${err.message}`);
      const el = document.getElementById(`figma-temp-dom-${cardId}`);
      if (el) document.body.removeChild(el);
    } finally {
      setExportingFigmaCardId(null);
    }
  };

  const openFullScreen = (cardId) => {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    const blob = new Blob([buildPreviewHtml(card)], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fa', fontFamily: "'Geist', sans-serif" }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
          <span style={{ color: '#888', fontSize: 14 }}>Loading canvas…</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8f9fa', fontFamily: "'Geist', sans-serif", flexDirection: 'column', gap: 16 }}>
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <p style={{ color: '#555', fontSize: 15, fontWeight: 600 }}>This canvas is no longer available</p>
        <a href="https://app.inspoai.io" style={{ color: '#6C5CE7', fontSize: 13, textDecoration: 'none' }}>Try Agentic UI →</a>
      </div>
    );
  }

  const isFreePlan = ownerRole === 'trial' || ownerRole === 'free';
  if (isFreePlan) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: '#f8f9fa',
        fontFamily: "'Geist', sans-serif",
        flexDirection: 'column',
        gap: 20,
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '16px',
          background: '#fee2e2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ef4444',
          marginBottom: '8px'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#111', margin: 0 }}>This canvas is locked</h2>
        <p style={{ color: '#666', fontSize: '15px', maxWidth: '420px', margin: '0 auto', lineHeight: 1.6 }}>
          The owner of this canvas is on a free plan. Let the administrator upgrade to a premium plan to enable sharing and view this product.
        </p>
        <a href="https://inspoai.io" style={{
          marginTop: '8px',
          padding: '12px 24px',
          background: '#111',
          color: '#fff',
          borderRadius: '10px',
          fontSize: '14px',
          fontWeight: '700',
          textDecoration: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'all 0.2s'
        }}>
          Learn More about InspoAI
        </a>
      </div>
    );
  }

  return (
    <div
      className="agentic-canvas"
      data-tool={activeTool}
      style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative', background: 'radial-gradient(#d9d9d9 1px, transparent 0)', backgroundSize: '20px 20px', backgroundColor: '#f8f9fa' }}
      onClick={() => setSelectedCard(null)}
    >
      {/* Top-right: InspoAI branding + CTA */}
      <div className="shared-canvas-header">
        <a href="https://app.inspoai.io" target="_blank" rel="noopener noreferrer" className="shared-canvas-logo-link">
          <img src="https://app.inspoai.io/LogoInspo.svg" alt="InspoAI" className="shared-canvas-logo" />
        </a>
        <a href="https://app.inspoai.io" target="_blank" rel="noopener noreferrer" className="shared-canvas-cta-btn">
          Try Agentic UI
        </a>
      </div>

      <TransformWrapper
        initialScale={1}
        minScale={0.1}
        maxScale={3}
        limitToBounds={false}
        panning={{ disabled: activeTool !== 'hand', velocityDisabled: false }}
        wheel={{ step: 0.1 }}
        onTransformed={(ref) => setZoomScale(ref.state.scale)}
      >
        {(api) => {
          transformApiRef.current = api;
          const { zoomIn, zoomOut, resetTransform } = api;
          return (
          <>
            <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '6000px', height: '4000px', position: 'relative' }}>
              <div id="canvas-content" style={{ position: 'relative', width: '100%', height: '100%' }} onClick={() => setSelectedCard(null)}>
                {cards.map(card => (
                  <Rnd
                    key={card.id}
                    scale={zoomScale}
                    position={{ x: card.x, y: card.y }}
                    size={{ width: card.width, height: card.height }}
                    onDragStart={() => setIsDragging(card.id)}
                    onDragStop={(e, d) => {
                      setIsDragging(null);
                      setCards(prev => prev.map(c => c.id === card.id ? { ...c, x: d.x, y: d.y } : c));
                    }}
                    disableDragging={false}
                    enableResizing={false}
                    dragHandleClassName="cct-drag-handle"
                    cancel=".shared-no-drag"
                    className={`canvas-card ${selectedCard === card.id ? 'selected' : ''}`}
                    onClick={e => { e.stopPropagation(); setSelectedCard(card.id); }}
                    onMouseEnter={() => {
                      if (activeTool === 'cursor' || activeTool === 'hand') {
                        setActiveTool('cursor');
                      }
                    }}
                    onMouseLeave={() => {
                      if (isDragging === card.id) return;
                      if (activeTool === 'cursor' || activeTool === 'hand') {
                        setActiveTool('hand');
                      }
                    }}
                  >
                    {/* Floating toolbar above card */}
                    <div className="canvas-card-toolbar" onClick={e => e.stopPropagation()}>

                      {/* Figma */}
                      <div className="cct-tooltip-wrap">
                        <button className="cct-btn" onClick={e => { e.stopPropagation(); handleExportToFigma(card.id); }} disabled={exportingFigmaCardId === card.id}>
                          {exportToastCardId === card.id ? (
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0ACF83" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          ) : (
                            <svg width="20" height="20" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: exportingFigmaCardId === card.id ? 0.5 : 1 }}>
                              <path d="M19 28.5C19 23.2533 14.7467 19 9.5 19C4.25329 19 0 23.2533 0 28.5C0 33.7467 4.25329 38 9.5 38H19V28.5Z" fill="#A259FF"/>
                              <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38C14.7467 38 19 42.2533 19 47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83"/>
                              <path d="M19 0H9.5C4.25329 0 0 4.2533 0 9.5C0 14.7467 4.25329 19 9.5 19H19V0Z" fill="#F24E1E"/>
                              <path d="M19 0H28.5C33.7467 0 38 4.2533 38 9.5C38 14.7467 33.7467 19 28.5 19C23.2533 19 19 14.7467 19 9.5V0Z" fill="#FF7262"/>
                              <path d="M38 28.5C38 23.2533 33.7467 19 28.5 19C23.2533 19 19 23.2533 19 28.5C19 33.7467 23.2533 38 28.5 38C33.7467 38 38 33.7467 38 28.5Z" fill="#1ABCFE"/>
                            </svg>
                          )}
                        </button>
                        <span className="cct-tooltip">{exportingFigmaCardId === card.id ? 'Exporting…' : exportToastCardId === card.id ? 'Copied to Figma!' : 'Copy as Figma UI'}</span>
                      </div>

                      <div className="cct-sep" />

                      {/* Copy Code */}
                      <div className="cct-tooltip-wrap">
                        <button className="cct-btn" onClick={e => { e.stopPropagation(); copyCardCode(card.id); }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                          </svg>
                        </button>
                        <span className="cct-tooltip">Copy Code</span>
                      </div>

                      <div className="cct-sep" />

                      {/* Responsive */}
                      <div className="cct-tooltip-wrap">
                        <button
                          className={`cct-btn ${activeResponsiveDropdownCardId === card.id ? 'active' : ''}`}
                          onClick={e => { e.stopPropagation(); setActiveResponsiveDropdownCardId(prev => prev === card.id ? null : card.id); }}
                        >
                          {getCardPlatform(card) === 'web' && (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                          )}
                          {getCardPlatform(card) === 'tablet' && (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                          )}
                          {getCardPlatform(card) === 'ios' && (
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                          )}
                        </button>
                        {activeResponsiveDropdownCardId === card.id ? (
                          <div className="cct-dropdown-menu" onClick={e => e.stopPropagation()}>
                            <button className={`cct-dropdown-item ${getCardPlatform(card) === 'web' ? 'active' : ''}`} onClick={() => handleCardPlatformChange(card.id, 'web')}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                              Desktop Web
                            </button>
                            <button className={`cct-dropdown-item ${getCardPlatform(card) === 'tablet' ? 'active' : ''}`} onClick={() => handleCardPlatformChange(card.id, 'tablet')}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                              Tablet
                            </button>
                            <button className={`cct-dropdown-item ${getCardPlatform(card) === 'ios' ? 'active' : ''}`} onClick={() => handleCardPlatformChange(card.id, 'ios')}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                              Mobile (iOS)
                            </button>
                          </div>
                        ) : (
                          <span className="cct-tooltip">Responsive View</span>
                        )}
                      </div>

                      <div className="cct-sep" />

                      {/* 6-dot drag handle */}
                      <div className="cct-tooltip-wrap cct-drag-handle" style={{ cursor: 'grab', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                          <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                          <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                          <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                        </svg>
                        <span className="cct-tooltip">Drag Screen</span>
                      </div>

                      <div className="cct-sep" />

                      {/* Preview / Play */}
                      <div className="cct-tooltip-wrap">
                        <button className="cct-btn" onClick={e => { e.stopPropagation(); openFullScreen(card.id); }}>
                          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                          </svg>
                        </button>
                        <span className="cct-tooltip">Preview</span>
                      </div>

                    </div>

                    {/* iframe */}
                    <div 
                      id={`figma-target-${card.id}`} 
                      className={`canvas-card-inner ${activeTool === 'hand' ? 'cct-drag-handle' : ''}`} 
                      onClick={e => { e.stopPropagation(); setSelectedCard(card.id); }}
                    >
                      {getCardPlatform(card) === 'ios' && card.width <= 500 ? (
                        <div className="canvas-card-mockup-wrapper" style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: 'transparent' }}>
                          <div style={{ position: 'relative', height: '98%', aspectRatio: '393/852', borderRadius: '48px', background: '#000', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: selectedCard === card.id ? '0 8px 24px rgba(74,144,217,0.25)' : '0 8px 24px rgba(0,0,0,0.15)', border: '12px solid #000', boxSizing: 'border-box', outline: selectedCard === card.id ? '3px solid #4A90D9' : 'none', outlineOffset: '2px' }}>
                            <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', borderRadius: '36px', transform: 'translate3d(0,0,0)', WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}>
                              <iframe srcDoc={card.html} sandbox="allow-scripts allow-same-origin" title={card.title} className="canvas-card-iframe" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: activeTool === 'hand' ? 'none' : 'auto', borderRadius: '36px', transform: 'translate3d(0,0,0)' }} onLoad={handleIframeLoad} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <iframe srcDoc={card.html} sandbox="allow-scripts allow-same-origin" title={card.title} className="canvas-card-iframe" style={{ width: '100%', height: '100%', border: 'none', pointerEvents: activeTool === 'hand' ? 'none' : 'auto' }} onLoad={handleIframeLoad} />
                      )}
                      {isDragging === card.id && (
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 100, cursor: 'grabbing', background: 'transparent' }} />
                      )}
                    </div>
                  </Rnd>
                ))}
              </div>
            </TransformComponent>

            {/* Bottom toolbar */}
            <div className="canvas-toolbar">
              <button className={`toolbar-btn ${activeTool === 'cursor' ? 'active' : ''}`} onClick={() => setActiveTool('cursor')} title="Select">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l7.07 17 2.51-7.39L21 11.07z"/></svg>
              </button>
              <button className={`toolbar-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')} title="Pan">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 11V6a2 2 0 00-4 0v1M14 10V4a2 2 0 00-4 0v6M10 10.5V5a2 2 0 00-4 0v9"/><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8H9a8 8 0 01-3-1L2 17"/></svg>
              </button>
              <div className="toolbar-divider" />
              <button className="toolbar-btn" onClick={() => zoomIn()} title="Zoom in">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <span className="zoom-level">{Math.round(zoomScale * 100)}%</span>
              <button className="toolbar-btn" onClick={() => zoomOut()} title="Zoom out">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              <div className="toolbar-divider" />
              <button onClick={() => resetTransform()} className="toolbar-btn zoom-fit-btn">Fit</button>
            </div>
          </>
          );
        }}
      </TransformWrapper>
    </div>
  );
}
