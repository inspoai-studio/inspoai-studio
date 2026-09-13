import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ArrowLeft, ArrowRight, ZoomIn, ZoomOut, Maximize2, Send, BookmarkPlus, Figma, Sparkles, LayoutGrid, X, RefreshCw, Plus, Search, Eye, CheckCircle2, Cpu, Check, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { generateFlowSVG, copyToClipboard } from '../../utils/figmaExport';
import '../../styles/CurationCanvas.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Agent timeline stages ──
const AGENT_STAGES = [
  { agent: 'researcher', icon: 'search', text: 'Performing live search across 150k+ screens…', sub: 'Inspo Researcher' },
  { agent: 'researcher', icon: 'search', text: 'Contacting InspoAI design agent…', sub: 'Inspo Researcher' },
  { agent: 'researcher', icon: 'search', text: 'Scanning design databases…', sub: 'Inspo Researcher' },
  { agent: 'researcher', icon: 'search', text: 'Found promising screens, handing off…', sub: 'Inspo Researcher → InspoAI Analyzer' },
  { agent: 'analyzer', icon: 'eye', text: 'Analyzing design patterns & layout…', sub: 'InspoAI Analyzer' },
  { agent: 'analyzer', icon: 'eye', text: 'Evaluating visual consistency & flow…', sub: 'InspoAI Analyzer' },
  { agent: 'analyzer', icon: 'eye', text: 'Scoring relevance & curating the best…', sub: 'InspoAI Analyzer' },
  { agent: 'both', icon: 'check', text: 'Arranging your curated moodboard…', sub: 'InspoAI Agents' },
];

// ── Cursor waypoints for each stage ──
const RESEARCHER_POSITIONS = [
  { x: -180, y: -40 },  // stage 0: searching far left
  { x: -120, y: 20 },   // stage 1: found something
  { x: -60, y: -30 },   // stage 2: bringing card in
  { x: 0, y: 10 },      // stage 3: handing off to center
  { x: -100, y: 40 },   // stage 4: stepped back
  { x: -140, y: -20 },  // stage 5: watching
  { x: -80, y: 30 },    // stage 6: assisting
  { x: -40, y: 0 },     // stage 7: final arrange
];

const ANALYZER_POSITIONS = [
  { x: 160, y: 30 },    // stage 0: waiting
  { x: 140, y: -10 },   // stage 1: watching
  { x: 100, y: 20 },    // stage 2: moving closer
  { x: 60, y: -20 },    // stage 3: receiving cards
  { x: 20, y: 10 },     // stage 4: inspecting center
  { x: 40, y: -30 },    // stage 5: analyzing top cards
  { x: 80, y: 20 },     // stage 6: scoring
  { x: 40, y: 0 },      // stage 7: final arrange
];

/**
 * AgentLoader — Phase 1: Multi-agent loading with Figma-style cursors
 * Two cursor pointers with name labels that roam around the card arena
 */
const AgentLoader = ({ query }) => {
  const [stageIndex, setStageIndex] = useState(0);
  const [cardPhase, setCardPhase] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex(prev => {
        const next = prev + 1;
        if (next >= AGENT_STAGES.length) return prev;
        return next;
      });
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Start cards flying in immediately
    const flyIn = setTimeout(() => setCardPhase(1), 500);
    return () => clearTimeout(flyIn);
  }, []);

  useEffect(() => {
    if (stageIndex >= 4 && cardPhase === 1) setCardPhase(2);
    if (stageIndex >= 7 && cardPhase === 2) setCardPhase(3);
  }, [stageIndex, cardPhase]);

  const [cursorReady, setCursorReady] = useState(false);

  // Delay cursor entrance so they fly in from sides
  useEffect(() => {
    const t = setTimeout(() => setCursorReady(true), 300);
    return () => clearTimeout(t);
  }, []);

  const currentStage = AGENT_STAGES[stageIndex] || AGENT_STAGES[AGENT_STAGES.length - 1];
  const resPos = cursorReady ? (RESEARCHER_POSITIONS[stageIndex] || RESEARCHER_POSITIONS[7]) : { x: -500, y: 0 };
  const anaPos = cursorReady ? (ANALYZER_POSITIONS[stageIndex] || ANALYZER_POSITIONS[7]) : { x: 500, y: 0 };

  return (
    <div className="agent-loader">

      {/* ── Card Arena with Cursors ── */}
      <div className="agent-card-arena">

        {/* Inspo Researcher Cursor — dark gradient */}
        <div
          className={`agent-cursor researcher-cursor ${currentStage.agent === 'researcher' || currentStage.agent === 'both' ? 'active' : 'idle'}`}
          style={{ transform: `translate(${resPos.x}px, ${resPos.y}px)` }}
        >
          <svg className="agent-cursor-arrow" width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="researcherGrad" x1="2" y1="1" x2="18" y2="26" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1a1a2e" />
                <stop offset="100%" stopColor="#16213e" />
              </linearGradient>
            </defs>
            <path d="M2.5 1L20.5 15L12 15.5L15.5 26L11.5 27L8 16.5L2.5 22L2.5 1Z" fill="url(#researcherGrad)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <div className="agent-cursor-label researcher-label">Inspo Researcher</div>
        </div>

        {/* InspoAI Analyzer Cursor — blue gradient */}
        <div
          className={`agent-cursor analyzer-cursor ${currentStage.agent === 'analyzer' || currentStage.agent === 'both' ? 'active' : 'idle'}`}
          style={{ transform: `translate(${anaPos.x}px, ${anaPos.y}px)` }}
        >
          <svg className="agent-cursor-arrow" width="22" height="28" viewBox="0 0 22 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="analyzerGrad" x1="2" y1="1" x2="18" y2="26" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>
            <path d="M2.5 1L20.5 15L12 15.5L15.5 26L11.5 27L8 16.5L2.5 22L2.5 1Z" fill="url(#analyzerGrad)" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <div className="agent-cursor-label analyzer-label">InspoAI Analyzer</div>
        </div>

        {/* Flying cards from left */}
        <div className={`agent-flying-card fly-left-1 phase-${cardPhase}`} />
        <div className={`agent-flying-card fly-left-2 phase-${cardPhase}`} />
        <div className={`agent-flying-card fly-left-3 phase-${cardPhase}`} />

        {/* Flying cards from right */}
        <div className={`agent-flying-card fly-right-1 phase-${cardPhase}`} />
        <div className={`agent-flying-card fly-right-2 phase-${cardPhase}`} />
        <div className={`agent-flying-card fly-right-3 phase-${cardPhase}`} />

        {/* Analyzer annotations (appear in phase 2) */}
        {cardPhase >= 2 && (
          <>
            <div className="agent-annotation ann-1">
              <CheckCircle2 size={10} />
              <span>Layout: ✓ Consistent</span>
            </div>
            <div className="agent-annotation ann-2">
              <Cpu size={10} />
              <span>Relevance: 94%</span>
            </div>
            <div className="agent-annotation ann-3">
              <Eye size={10} />
              <span>Flow: ✓ Logical</span>
            </div>
          </>
        )}
      </div>

      {/* ── Status text ── */}
      <div className="agent-status-section">
        <div className="agent-status-text" key={stageIndex}>
          {currentStage.text}
        </div>
        <div className="agent-status-sub" key={`sub-${stageIndex}`}>
          {currentStage.sub}
        </div>
      </div>

      {/* Query */}
      <div className="agent-query-display">{query}</div>

      {/* Progress bar */}
      <div className="agent-progress-bar">
        <div className="agent-progress-fill" style={{ animationDuration: `${AGENT_STAGES.length * 2.4}s` }} />
      </div>

      {/* ── Activity log ── */}
      <div className="agent-activity-log">
        {AGENT_STAGES.slice(0, stageIndex + 1).map((stage, i) => (
          <div key={i} className={`agent-log-entry ${i === stageIndex ? 'current' : 'done'}`}>
            {i < stageIndex ? (
              <CheckCircle2 size={11} />
            ) : (
              <div className="agent-log-spinner" />
            )}
            <span>{stage.text.replace('…', '')}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * CurationCanvas — Smart Curation Mode UI
 *
 * Renders curated screens in either:
 * - Flow layout (horizontal steps with arrows) for app journey queries
 * - Collection layout (freeform scatter) for component/pattern queries
 *
 * Supports: zoom/pan, drag to rearrange, continue search, Figma export, save to moodboard
 * Features: AI agent loading animation, one-by-one screen reveal
 */
const CurationCanvas = ({ curation, onBack, onSaveAsMoodboard, user, isLoading }) => {
  const [steps, setSteps] = useState(curation?.steps || []);
  const [screens, setScreens] = useState(curation?.screens || []);
  const [continueQuery, setContinueQuery] = useState('');
  const [popupScreen, setPopupScreen] = useState(null);
  const [followUpNotes, setFollowUpNotes] = useState([]);
  const [isRefining, setIsRefining] = useState(false);
  const [collectionPositions, setCollectionPositions] = useState([]);
  const [flowPositions, setFlowPositions] = useState({});
  const [stickyPos, setStickyPos] = useState({ x: 40, y: 40 });
  const continueInputRef = useRef(null);
  const transformRef = useRef(null);
  const [dragState, setDragState] = useState(null);

  // ── Animation state ──
  const [revealPhase, setRevealPhase] = useState(isLoading ? 'loading' : 'idle'); // 'loading' | 'revealing' | 'done'
  const [revealedCount, setRevealedCount] = useState(0);
  const [showBottomBar, setShowBottomBar] = useState(false);
  const revealTimerRef = useRef(null);
  const hasAnimatedRef = useRef(false);

  const isFlow = curation?.type === 'flow';

  // Count total screens for reveal tracking
  const totalScreens = useMemo(() => {
    if (isFlow) return steps.reduce((sum, s) => sum + s.screens.length, 0);
    return screens.length;
  }, [isFlow, steps, screens]);

  // ── Sync steps/screens when curation prop changes AND trigger reveal ──
  useEffect(() => {
    if (curation?.steps) setSteps(curation.steps);
    if (curation?.screens) setScreens(curation.screens);

    // When curation data arrives (after loading), start reveal animation
    if (curation && !isLoading && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setRevealPhase('revealing');
      setRevealedCount(0);
    }
  }, [curation, isLoading]);

  // ── Phase 2: One-by-one reveal timer ──
  useEffect(() => {
    if (revealPhase !== 'revealing') return;
    if (totalScreens === 0) {
      setRevealPhase('done');
      setShowBottomBar(true);
      return;
    }

    revealTimerRef.current = setInterval(() => {
      setRevealedCount(prev => {
        const next = prev + 1;
        if (next >= totalScreens) {
          clearInterval(revealTimerRef.current);
          // Phase 3: Show bottom bar after all screens revealed
          setTimeout(() => {
            setRevealPhase('done');
            setShowBottomBar(true);
          }, 400);
        }
        return next;
      });
    }, 150); // 150ms stagger per screen

    return () => clearInterval(revealTimerRef.current);
  }, [revealPhase, totalScreens]);

  // ── If component mounts with data already (no loading phase), show everything ──
  useEffect(() => {
    if (!isLoading && curation && !hasAnimatedRef.current) {
      hasAnimatedRef.current = true;
      setRevealPhase('revealing');
      setRevealedCount(0);
    }
  }, []);

  // Initialize collection positions on mount
  useEffect(() => {
    if (!isFlow && screens.length > 0 && collectionPositions.length === 0) {
      const positions = screens.map((_, i) => {
        const cols = 3;
        const col = i % cols;
        const row = Math.floor(i / cols);
        return {
          x: 100 + col * 420 + (Math.random() * 16 - 8),
          y: 100 + row * 560 + (Math.random() * 16 - 8),
        };
      });
      setCollectionPositions(positions);
    }
  }, [isFlow, screens, collectionPositions.length]);

  // ── Continue Search ──
  const handleContinue = useCallback(async () => {
    if (!continueQuery.trim() || isRefining) return;
    setIsRefining(true);

    try {
      const token = user?.accessToken || (await user?.getIdToken?.());
      const res = await fetch(`${API_BASE}/api/curate/refine`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          query: continueQuery.trim(),
          existingType: curation?.type || 'flow',
          platform: curation?.platform,
          originalQuery: curation?.originalQuery || curation?.title || '',
          styles: curation?.styles || [],
        }),
      });

      const data = await res.json();
      if (data.success && data.step) {
        if (isFlow) {
          setSteps(prev => [...prev, data.step]);
        } else {
          const newScreens = data.step.screens || [];
          setScreens(prev => [...prev, ...newScreens]);
          setCollectionPositions(prev => {
            const newPositions = newScreens.map((_, i) => ({
              x: 100 + ((prev.length + i) % 3) * 420 + (Math.random() * 16 - 8),
              y: 100 + Math.floor((prev.length + i) / 3) * 560 + (Math.random() * 16 - 8),
            }));
            return [...prev, ...newPositions];
          });
        }
        setContinueQuery('');
        toast.success(`Added "${data.step.label}" — ${data.step.screens.length} screens`);

        // Track follow-up sticky note
        setFollowUpNotes(prev => [...prev, {
          query: continueQuery.trim(),
          stepIndex: isFlow ? steps.length : null,
          screenCount: data.step.screens.length,
        }]);
      } else {
        toast.error('No results found for that query');
      }
    } catch (err) {
      console.error('Refine error:', err);
      toast.error('Failed to add screens');
    } finally {
      setIsRefining(false);
    }
  }, [continueQuery, isRefining, curation, user, isFlow]);

  // ── Remove Screen ──
  const handleRemoveScreen = useCallback((stepIndex, screenIndex) => {
    if (isFlow) {
      setSteps(prev => {
        const updated = [...prev];
        updated[stepIndex] = {
          ...updated[stepIndex],
          screens: updated[stepIndex].screens.filter((_, i) => i !== screenIndex),
        };
        return updated.filter(s => s.screens.length > 0);
      });
    } else {
      setScreens(prev => prev.filter((_, i) => i !== screenIndex));
      setCollectionPositions(prev => prev.filter((_, i) => i !== screenIndex));
    }
  }, [isFlow]);

  const handleRemoveStep = useCallback((stepIndex) => {
    setSteps(prev => prev.filter((_, i) => i !== stepIndex));
  }, []);

  // ── Figma Export ──
  const [figmaCopied, setFigmaCopied] = useState(false);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const handleFigmaExport = useCallback(async () => {
    if (figmaLoading) return;
    setFigmaLoading(true);
    try {
      const exportData = isFlow
        ? { ...curation, steps, type: 'flow' }
        : { ...curation, screens, type: 'collection' };

      const svg = await generateFlowSVG(exportData);
      const success = await copyToClipboard(svg);
      if (success) {
        setFigmaCopied(true);
        toast.success('SVG with images copied! Paste in Figma (Cmd/Ctrl+V)');
        setTimeout(() => setFigmaCopied(false), 3000);
      } else {
        toast.error('Failed to copy to clipboard');
      }
    } catch (err) {
      console.error('Figma export error:', err);
      toast.error('Export failed — please try again');
    } finally {
      setFigmaLoading(false);
    }
  }, [curation, steps, screens, isFlow, figmaLoading]);

  // ── Save as Moodboard ──
  const handleSaveAsMoodboard = useCallback(() => {
    const allScreens = isFlow ? steps.flatMap(s => s.screens) : screens;
    if (onSaveAsMoodboard) {
      onSaveAsMoodboard({
        title: curation?.title || 'Curated Moodboard',
        images: allScreens.map(s => ({
          image: s.fullImage || s.image,
          title: s.title,
          source: s.source,
          url: s.url,
          _internalId: s._internalId,
        })),
      });
    }
  }, [curation, steps, screens, isFlow, onSaveAsMoodboard]);

  // ── Drag handlers ──
  const handleDragStart = useCallback((key, origX, origY, e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragState({ key, startX: e.clientX, startY: e.clientY, origX, origY });
  }, []);

  const handleCollectionDragStart = useCallback((index, e) => {
    const pos = collectionPositions[index] || { x: 0, y: 0 };
    handleDragStart(`col-${index}`, pos.x, pos.y, e);
  }, [collectionPositions, handleDragStart]);

  const handleFlowDragStart = useCallback((stepIdx, screenIdx, e) => {
    const key = `${stepIdx}-${screenIdx}`;
    const pos = flowPositions[key] || { x: 0, y: 0 };
    handleDragStart(`flow-${key}`, pos.x, pos.y, e);
  }, [flowPositions, handleDragStart]);

  const handleStickyDragStart = useCallback((e) => {
    handleDragStart('sticky', stickyPos.x, stickyPos.y, e);
  }, [stickyPos, handleDragStart]);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e) => {
      const scale = transformRef.current?.instance?.transformState?.scale || 1;
      const dx = (e.clientX - dragState.startX) / scale;
      const dy = (e.clientY - dragState.startY) / scale;
      if (dragState.key.startsWith('col-')) {
        const index = parseInt(dragState.key.replace('col-', ''));
        setCollectionPositions(prev => {
          const updated = [...prev];
          updated[index] = { x: dragState.origX + dx, y: dragState.origY + dy };
          return updated;
        });
      } else if (dragState.key.startsWith('flow-')) {
        const posKey = dragState.key.replace('flow-', '');
        setFlowPositions(prev => ({ ...prev, [posKey]: { x: dragState.origX + dx, y: dragState.origY + dy } }));
      } else if (dragState.key === 'sticky') {
        setStickyPos({ x: dragState.origX + dx, y: dragState.origY + dy });
      }
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
  }, [dragState]);

  // ── Helper: calculate flat screen index from step/screen indices ──
  const getFlatIndex = useCallback((stepIndex, screenIndex) => {
    let flat = 0;
    for (let s = 0; s < stepIndex; s++) {
      flat += steps[s]?.screens?.length || 0;
    }
    return flat + screenIndex;
  }, [steps]);

  // ── If in loading state, show the AgentLoader ──
  if (isLoading && !curation) {
    return (
      <div className="curation-canvas-wrapper">
        <AgentLoader query={curation?.originalQuery || ''} />
      </div>
    );
  }

  return (
    <div className="curation-canvas-wrapper">

      {/* ── Canvas Area ── */}
      <div className="curation-canvas-area">

        <TransformWrapper
          ref={transformRef}
          initialScale={0.7}
          minScale={0.1}
          maxScale={3}
          centerOnInit={false}
          limitToBounds={false}
          initialPositionX={0}
          initialPositionY={0}
          panning={{ disabled: !!dragState, velocityDisabled: true }}
          doubleClick={{ disabled: true }}
          alignmentAnimation={{ disabled: true }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              {/* Zoom Controls */}
              <div className="curation-zoom-controls">
                <button className="curation-zoom-btn" onClick={() => zoomIn()} title="Zoom in">
                  <ZoomIn />
                </button>
                <div className="curation-zoom-divider" />
                <button className="curation-zoom-btn" onClick={() => zoomOut()} title="Zoom out">
                  <ZoomOut />
                </button>
                <div className="curation-zoom-divider" />
                <button className="curation-zoom-btn" onClick={() => resetTransform()} title="Fit to view">
                  <Maximize2 />
                </button>
              </div>

              <TransformComponent
                wrapperStyle={{ width: '100%', height: '100%' }}
                contentStyle={{ width: '100%', height: '100%' }}
              >
                <div className="curation-canvas-content">
                  {/* ── Sticky Note (replaces header) ── */}
                  <div
                    className={`curation-sticky-note ${revealPhase === 'done' ? 'revealed' : ''}`}
                    style={{
                      left: stickyPos.x,
                      top: stickyPos.y,
                      cursor: dragState?.key === 'sticky' ? 'grabbing' : 'grab',
                      transition: (dragState?.key === 'sticky' || revealPhase !== 'done') ? 'none' : 'transform 0.5s ease',
                      position: 'absolute'
                    }}
                    onMouseDown={handleStickyDragStart}
                  >
                    <div className="sticky-note-pin">
                      <Pin size={16} />
                    </div>
                    <span className={`curation-badge ${isFlow ? 'flow' : 'collection'}`}>
                      {isFlow ? <LayoutGrid size={12} /> : <LayoutGrid size={12} />}
                      {isFlow ? 'Curated Flow' : 'Curated Collection'}
                    </span>
                    <div className="sticky-note-query">{curation?.originalQuery || curation?.title}</div>
                    <div className="sticky-note-meta">
                      {totalScreens} screens
                      {curation?.platform && ` · ${curation.platform.toUpperCase()}`}
                      {curation?.reference && ` · inspired by ${curation.reference}`}
                      {curation?.duration && ` · ${Math.round(curation.duration / 1000)}s`}
                    </div>
                    {(curation?.tags || curation?.styles || []).length > 0 && (
                      <div className="sticky-note-tags">
                        {(curation?.tags || curation?.styles || []).map((tag, i) => (
                          <span key={i} className="curation-tag">{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {isFlow ? (
                    /* ── Flow Layout ── */
                    <div className="curation-flow-layout">
                      {steps.map((step, stepIndex) => (
                        <React.Fragment key={stepIndex}>
                          <div className="curation-step">
                            {/* Follow-up sticky note for this step */}
                            {followUpNotes.find(n => n.stepIndex === stepIndex) && (
                              <div className="curation-followup-note">
                                <div className="followup-note-pin"><Pin size={10} /></div>
                                <div className="followup-note-query">
                                  "{followUpNotes.find(n => n.stepIndex === stepIndex).query}"
                                </div>
                                <div className="followup-note-meta">
                                  +{followUpNotes.find(n => n.stepIndex === stepIndex).screenCount} screens added
                                </div>
                              </div>
                            )}
                            {/* Step label — reveals first */}
                            <div
                              className={`curation-step-label ${revealPhase !== 'loading' ? 'step-label-reveal' : ''}`}
                              style={{ animationDelay: `${stepIndex * 150}ms` }}
                            >
                              {step.label}
                              {steps.length > 1 && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleRemoveStep(stepIndex); }}
                                  style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: '12px' }}
                                  title="Remove step"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                            <div className="curation-step-screens">
                              {step.screens.map((screen, screenIndex) => {
                                const posKey = `${stepIndex}-${screenIndex}`;
                                const pos = flowPositions[posKey] || { x: 0, y: 0 };
                                const flatIdx = getFlatIndex(stepIndex, screenIndex);
                                const isRevealed = revealPhase === 'done' || flatIdx < revealedCount;

                                return (
                                  <div
                                    key={screen._internalId || screenIndex}
                                    className={`screen-reveal-wrapper ${isRevealed ? 'revealed' : ''}`}
                                    style={{
                                      transform: `translate(${pos.x}px, ${pos.y}px)`,
                                      cursor: dragState?.key === `flow-${posKey}` ? 'grabbing' : 'grab',
                                      transition: dragState?.key === `flow-${posKey}` ? 'none' : 'transform 0.15s ease',
                                      animationDelay: `${flatIdx * 150}ms`,
                                    }}
                                    onMouseDown={(e) => handleFlowDragStart(stepIndex, screenIndex, e)}
                                  >
                                    <ScreenCard
                                      screen={screen}
                                      onRemove={() => handleRemoveScreen(stepIndex, screenIndex)}
                                      onClick={() => { if (!dragState) setPopupScreen(screen); }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          {/* Arrow between steps — draws in after screens */}
                          {stepIndex < steps.length - 1 && (
                            <div className={`curation-flow-arrow ${revealPhase === 'done' ? 'arrow-draw-in' : ''}`}
                              style={{ animationDelay: `${(stepIndex + 1) * 300}ms` }}
                            >
                              <ArrowRight size={20} color="#bbb" />
                            </div>
                          )}
                        </React.Fragment>
                      ))}

                      <button className="curation-add-step" title="Add step via Continue search">
                        <Plus />
                      </button>
                    </div>
                  ) : (
                    /* ── Collection Layout ── */
                    <div className="curation-collection-layout">
                      {screens.map((screen, index) => {
                        const isRevealed = revealPhase === 'done' || index < revealedCount;

                        return (
                          <div
                            key={screen._internalId || index}
                            className={`curation-collection-item ${dragState?.index === index ? 'dragging' : ''} ${isRevealed ? 'collection-item-revealed' : 'collection-item-hidden'}`}
                            style={{
                              left: collectionPositions[index]?.x || 0,
                              top: collectionPositions[index]?.y || 0,
                              width: 380,
                              animationDelay: `${index * 120}ms`,
                            }}
                            onMouseDown={(e) => handleCollectionDragStart(index, e)}
                          >
                            <ScreenCard
                              screen={screen}
                              onRemove={() => handleRemoveScreen(null, index)}
                              onClick={() => { if (!dragState) setPopupScreen(screen); }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      {/* ── Bottom Bar (slides up after reveal) ── */}
      <div className={`curation-bottom-bar ${showBottomBar ? 'bottom-bar-revealed' : 'bottom-bar-hidden'}`}>
        <div className="curation-continue-input">
          <input
            ref={continueInputRef}
            type="text"
            placeholder="Continue: add more screens..."
            value={continueQuery}
            onChange={(e) => setContinueQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
            disabled={isRefining}
          />
          <button
            className="curation-continue-btn"
            onClick={handleContinue}
            disabled={!continueQuery.trim() || isRefining}
          >
            {isRefining ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="curation-actions">
          <button className="curation-action-btn primary" onClick={handleSaveAsMoodboard}>
            <BookmarkPlus size={14} /> Save as Moodboard
          </button>
          <button className={`curation-action-btn ${figmaCopied ? 'copied' : 'secondary'}`} onClick={handleFigmaExport} disabled={figmaLoading}>
            {figmaLoading ? <><RefreshCw size={14} className="animate-spin" /> Processing...</> : figmaCopied ? <><Check size={14} /> Copied — paste in Figma</> : <><Figma size={14} /> Export to Figma</>}
          </button>
        </div>
      </div>

      {/* ── Screen Popup (draggable) ── */}
      {popupScreen && (
        <ScreenPopup screen={popupScreen} onClose={() => setPopupScreen(null)} />
      )}
    </div>
  );
};

/**
 * ScreenPopup — Draggable full-size image popup
 */
const ScreenPopup = ({ screen, onClose }) => {
  const [pos, setPos] = useState({ x: Math.max(20, window.innerWidth / 2 - 400), y: 40 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const popupRef = useRef(null);

  const handleMouseDown = useCallback((e) => {
    if (e.target.closest('.screen-popup-close')) return;
    setIsDragging(true);
    const rect = popupRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      setPos({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      ref={popupRef}
      className="screen-popup"
      style={{ left: pos.x, top: pos.y }}
    >
      <div className="screen-popup-header" onMouseDown={handleMouseDown}>
        <span className="screen-popup-title">{screen.title || screen.siteName || 'UI Screen'}</span>
        <button className="screen-popup-close" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="screen-popup-body">
        <img
          src={screen.fullImage || screen.image}
          alt={screen.title || 'UI Screen'}
          draggable={false}
        />
      </div>
    </div>
  );
};

/**
 * ScreenCard — Individual screen thumbnail with hover actions
 */
const ScreenCard = ({ screen, onRemove, onClick }) => {
  const [imgError, setImgError] = useState(false);

  return (
    <div className="curation-screen-card" onClick={onClick} style={{ cursor: 'pointer' }}>
      {!imgError ? (
        <img
          src={screen.image || screen.fullImage}
          alt={screen.title || 'UI Screen'}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div style={{
          width: '100%',
          height: 280,
          background: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ccc',
          fontSize: 12,
        }}>
          Image unavailable
        </div>
      )}
      <div className="curation-screen-card-overlay">
        <div className="curation-screen-card-title">
          {screen.title || screen.siteName || 'UI Screen'}
        </div>
      </div>
      <button className="curation-screen-card-remove" onClick={(e) => { e.stopPropagation(); onRemove(); }} title="Remove">
        <X />
      </button>
    </div>
  );
};

export default CurationCanvas;
