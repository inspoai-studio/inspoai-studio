import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AlertCircle, X, Upload, RotateCcw, Palette, Type, Grid3X3, Eye, Sparkles, CheckCircle2, AlertTriangle, Layers, Link2, Tag, BarChart3, Accessibility, MessageSquare, ScanLine } from 'lucide-react';
import '../../styles/AIAudit.css';
import { auth } from '../../firebase';

// ── Category config with Lucide icons ──
const CATEGORY_META = {
  contrast:      { Icon: Palette, label: 'Contrast' },
  typography:    { Icon: Type, label: 'Typography' },
  spacing:       { Icon: Grid3X3, label: 'Spacing' },
  layout:        { Icon: BarChart3, label: 'Layout' },
  accessibility: { Icon: Accessibility, label: 'Accessibility' },
  color:         { Icon: Palette, label: 'Color' },
  hierarchy:     { Icon: Layers, label: 'Hierarchy' },
  consistency:   { Icon: Link2, label: 'Consistency' },
  brand:         { Icon: Tag, label: 'Brand' },
};

// ── Score label helper ──
const getScoreLabel = (score) => {
  if (score >= 90) return 'Excellent';
  if (score >= 75) return 'Good';
  if (score >= 60) return 'Average';
  if (score >= 40) return 'Needs Work';
  return 'Poor';
};

const getScoreClass = (score) => {
  if (score >= 85) return 'score-excellent';
  if (score >= 70) return 'score-good';
  if (score >= 50) return 'score-average';
  return 'score-poor';
};

// ── Circular Score with label ──
const CircularScore = ({ score, label }) => {
  const scoreClass = getScoreClass(score);
  return (
    <div className="score-card">
      <svg viewBox="0 0 36 36" className="circular-chart">
        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path
          className={`circle ${scoreClass}`}
          strokeDasharray={`${score || 0}, 100`}
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
        />
        <text x="18" y="20.35" className="percentage">{score || 0}</text>
      </svg>
      <div className="score-label">{label}</div>
      <div className={`score-verdict ${scoreClass}`}>{getScoreLabel(score)}</div>
    </div>
  );
};

// ── Color Swatch ──
const ColorSwatch = ({ color }) => (
  <div className="color-swatch-card">
    <div className="swatch-preview" style={{ background: color.hex }} />
    <div className="swatch-info">
      <div className="swatch-hex">{color.hex}</div>
      <div className="swatch-usage">{color.usage}</div>
      {color.contrastRatio && (
        <div className="swatch-contrast">
          <span className={`wcag-badge ${color.wcag?.toLowerCase()}`}>
            {color.wcag}
          </span>
          <span className="contrast-ratio">{color.contrastRatio}:1</span>
        </div>
      )}
      {color.onBrand !== undefined && (
        <div className={`brand-match ${color.onBrand ? 'on-brand' : 'off-brand'}`}>
          {color.onBrand ? '✓ On Brand' : `✗ Expected ${color.brandExpected}`}
        </div>
      )}
    </div>
  </div>
);

// ── Main Component ──
const AIAudit = ({ user, quota }) => {
  const [brandGuidelines, setBrandGuidelines] = useState({ isSet: false, imageUrl: null });
  const [designImage, setDesignImage] = useState(null);
  const [designImageUrl, setDesignImageUrl] = useState(null);
  const [designAnalysis, setDesignAnalysis] = useState(null);
  const [auditMode, setAuditMode] = useState('universal');
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [hoveredIssue, setHoveredIssue] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [uploadingBrandGuidelines, setUploadingBrandGuidelines] = useState(false);
  const [uploadingDesign, setUploadingDesign] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('issues');
  const [designContext, setDesignContext] = useState('');

  // ── Anti-overlap: nudge pins that are too close ──
  const resolvedPins = useMemo(() => {
    const issues = designAnalysis?.issues || [];
    if (issues.length === 0) return [];
    const MIN_DIST = 6; // minimum % distance between pins
    const pins = issues.map(issue => ({
      x: issue.location?.x ?? 50,
      y: issue.location?.y ?? 50,
    }));
    // Simple collision resolution — push overlapping pins apart
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < pins.length; i++) {
        for (let j = i + 1; j < pins.length; j++) {
          const dx = pins[j].x - pins[i].x;
          const dy = pins[j].y - pins[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MIN_DIST && dist > 0) {
            const push = (MIN_DIST - dist) / 2;
            const angle = Math.atan2(dy, dx);
            pins[j].x = Math.min(96, Math.max(4, pins[j].x + Math.cos(angle) * push));
            pins[j].y = Math.min(96, Math.max(4, pins[j].y + Math.sin(angle) * push));
            pins[i].x = Math.min(96, Math.max(4, pins[i].x - Math.cos(angle) * push));
            pins[i].y = Math.min(96, Math.max(4, pins[i].y - Math.sin(angle) * push));
          } else if (dist === 0) {
            // Identical position — offset diagonally
            pins[j].x = Math.min(96, pins[j].x + MIN_DIST * 0.7);
            pins[j].y = Math.min(96, pins[j].y + MIN_DIST * 0.7);
          }
        }
      }
    }
    return pins;
  }, [designAnalysis]);
  const issueRefs = useRef({});

  const getAuthToken = async () => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    return await auth.currentUser.getIdToken();
  };

  // Check guidelines on mount
  useEffect(() => {
    const checkStatus = async () => {
      const currentRole = user?.role || 'free';
      const canAccess = user && (
        currentRole === 'admin' || user.isAdmin ||
        ['free', 'trial', 'basic', 'lite', 'lite_annual', 'solo', 'solo_annual', 'freelancer', 'freelancer_annual', 'pro', 'team', 'team_annual', 'lifetime'].includes(currentRole)
      );
      if (!canAccess) return;
      try {
        const token = await getAuthToken();
        const response = await fetch(`${import.meta.env.VITE_API_URL}/brand-guidelines-status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        setBrandGuidelines({ isSet: data.isSet, imageUrl: data.imageUrl });
        if (data.isSet) setAuditMode('brand');
      } catch (err) {
        console.error('Status check error', err);
      }
    };
    checkStatus();
  }, [user]);

  // Upload brand guidelines
  const handleBrandGuidelinesSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingBrandGuidelines(true);
    setErrorMessage(null);
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${import.meta.env.VITE_API_URL}/upload-brand-guidelines`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      setBrandGuidelines({ isSet: true, imageUrl: data.imageUrl });
      setAuditMode('brand');
    } catch (e) {
      setErrorMessage(e.message);
    } finally {
      setUploadingBrandGuidelines(false);
    }
  };

  // Select design file
  const handleDesignSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setDesignImage(file);
      const reader = new FileReader();
      reader.onload = () => setDesignImageUrl(reader.result);
      reader.readAsDataURL(file);
      setDesignAnalysis(null);
      setSelectedIssue(null);
      setActiveTab('issues');
    }
  };

  // Re-upload (reset)
  const handleReUpload = () => {
    setDesignImage(null);
    setDesignImageUrl(null);
    setDesignAnalysis(null);
    setSelectedIssue(null);
    setErrorMessage(null);
    setDesignContext('');
  };

  // Run audit
  const runAudit = async () => {
    if (!designImage) return;
    setUploadingDesign(true);
    setErrorMessage(null);
    try {
      const token = await getAuthToken();
      const formData = new FormData();
      formData.append('image', designImage);
      formData.append('auditMode', auditMode);
      if (designContext.trim()) {
        formData.append('designContext', designContext.trim());
      }
      const res = await fetch(`${import.meta.env.VITE_API_URL}/analyze`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.message || errorData.error || 'Analysis failed');
      }
      const data = await res.json();

      // Normalize: support both old (overallScore, mistakes) and new (scores, issues) formats
      const normalized = normalizeResponse(data);
      setDesignAnalysis(normalized);
      setActiveTab('issues');
    } catch (e) {
      console.error('Analysis Error:', e);
      setErrorMessage(e.message);
    } finally {
      setUploadingDesign(false);
    }
  };

  // Normalize API response to handle both old and new formats
  const normalizeResponse = (data) => {
    // New format already has scores object
    if (data.scores) return data;

    // Old format: convert
    return {
      scores: {
        overall: data.overallScore || 0,
        visualHierarchy: data.hierarchyScore || 0,
        colorHarmony: data.aestheticsScore || 0,
        typography: 0,
        spacing: 0,
        accessibility: data.uxScore || 0,
      },
      issues: (data.mistakes || data.issues || []).map((m, i) => ({
        ...m,
        severity: (m.severity || 'medium').toLowerCase(),
        category: m.category || 'layout',
        location: typeof m.location === 'string'
          ? getOldLocationCoords(m.location)
          : m.location || { x: 50, y: 50 },
        suggestion: m.suggestion || '',
      })),
      colorPalette: data.colorPalette || [],
      typography: data.typography || null,
      spacingAnalysis: data.spacingAnalysis || '',
      strengths: data.strengths || [],
    };
  };

  // Fallback for old text-based locations
  const getOldLocationCoords = (loc) => {
    const l = (loc || '').toLowerCase();
    if (l.includes('top-left'))     return { x: 15, y: 15 };
    if (l.includes('top-right'))    return { x: 85, y: 15 };
    if (l.includes('bottom-left'))  return { x: 15, y: 85 };
    if (l.includes('bottom-right')) return { x: 85, y: 85 };
    if (l.includes('navigation') || l.includes('header')) return { x: 50, y: 10 };
    if (l.includes('footer'))      return { x: 50, y: 90 };
    if (l.includes('hero'))        return { x: 50, y: 30 };
    if (l.includes('sidebar'))     return { x: 15, y: 50 };
    return { x: 50, y: 50 };
  };

  // Pin click → scroll to issue card
  const handlePinClick = (idx) => {
    setSelectedIssue(idx);
    setActiveTab('issues');
    if (issueRefs.current[idx]) {
      issueRefs.current[idx].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Filter issues by severity
  const getFilteredIssues = () => {
    const issues = designAnalysis?.issues || [];
    if (severityFilter === 'all') return issues;
    return issues.filter(i => i.severity === severityFilter);
  };

  // Role-based access
  const userRole = user?.role || 'free';
  const hasAccess = user && (
    userRole === 'admin' || user.isAdmin ||
    ['free', 'trial', 'basic', 'lite', 'lite_annual', 'solo', 'solo_annual', 'freelancer', 'freelancer_annual', 'pro', 'team', 'team_annual', 'lifetime'].includes(userRole)
  );

  if (!hasAccess) return <div className="no-results"><h3>Premium Access Required</h3></div>;

  const scores = designAnalysis?.scores || {};
  const issues = designAnalysis?.issues || [];
  const filteredIssues = getFilteredIssues();

  return (
    <div className="ai-audit-container">
      {/* Header */}
      <div className="audit-header">
        <div className="audit-header-left">
          <h1 className="ai-audit-title">Design Studio Audit</h1>
          {designAnalysis && (
            <button className="reupload-btn" onClick={handleReUpload}>
              <RotateCcw size={14} /> New Audit
            </button>
          )}
        </div>
        <div className="mode-selector">
          <button className={`mode-btn ${auditMode === 'universal' ? 'active' : ''}`} onClick={() => setAuditMode('universal')}>
            Universal Audit
          </button>
          <button
            className={`mode-btn ${auditMode === 'brand' ? 'active' : ''}`}
            onClick={() => setAuditMode('brand')}
            disabled={!brandGuidelines.isSet}
          >
            Brand Check {brandGuidelines.isSet ? '✓' : '(coming soon)'}
          </button>
        </div>
      </div>

      {/* Brand Upload */}
      {auditMode === 'brand' && !brandGuidelines.isSet && (
        <div className="brand-upload-section">
          <h3>Upload Brand Guidelines to unlock Brand Check</h3>
          <input type="file" onChange={handleBrandGuidelinesSelect} disabled={uploadingBrandGuidelines} />
          {uploadingBrandGuidelines && <span>Uploading...</span>}
        </div>
      )}

      {/* Error Toast */}
      {errorMessage && (
        <div className="audit-error-toast">
          <AlertCircle size={20} className="audit-error-icon" />
          <div className="audit-error-content">
            <span className="audit-error-title">Analysis Failed</span>
            <p className="audit-error-desc">{errorMessage.replace('Failed to analyze image: ', '')}</p>
            <div className="audit-error-tip">
              <strong>Tip:</strong> Try uploading a UI/UX design, website section, or app screenshot.
            </div>
          </div>
          <button className="audit-error-close" onClick={() => setErrorMessage(null)}><X size={16} /></button>
        </div>
      )}

      {/* Workspace */}
      <div className="audit-workspace">
        {/* ── LEFT: Canvas ── */}
        <div className="audit-canvas">
          {!designImageUrl ? (
            <label className="canvas-placeholder">
              <input type="file" accept="image/*,.pdf" onChange={handleDesignSelect} />
              <Upload size={40} strokeWidth={1.5} />
              <p className="upload-main-text">Drop your design here</p>
              <p className="upload-sub-text">PNG, JPG, PDF — Screenshots, mockups, wireframes</p>
            </label>
          ) : (
            <div className="design-preview-container">
              <img src={designImageUrl} alt="Design to audit" className="design-preview" />

              {/* Comment-bubble Pins */}
              {designAnalysis && issues.map((issue, idx) => {
                const pin = resolvedPins[idx] || { x: 50, y: 50 };
                return (
                  <div
                    key={idx}
                    className={`audit-pin-wrap ${issue.severity} ${selectedIssue === idx ? 'selected' : ''} ${hoveredIssue === idx ? 'hovered' : ''}`}
                    style={{
                      position: 'absolute',
                      left: `${pin.x}%`,
                      top: `${pin.y}%`,
                    }}
                    onClick={() => handlePinClick(idx)}
                    onMouseEnter={() => setHoveredIssue(idx)}
                    onMouseLeave={() => setHoveredIssue(null)}
                    title={issue.title}
                  >
                    <svg width="30" height="34" viewBox="0 0 30 34" fill="none" className="pin-bubble-svg">
                      <path d="M2 4C2 2.34315 3.34315 1 5 1H25C26.6569 1 28 2.34315 28 4V22C28 23.6569 26.6569 25 25 25H18L15 33L12 25H5C3.34315 25 2 23.6569 2 22V4Z" />
                    </svg>
                    <span className="pin-number">{idx + 1}</span>
                  </div>
                );
              })}

              {/* Scanning overlay */}
              {uploadingDesign && (
                <div className="scanning-overlay">
                  <div className="scanner-bar" />
                  <div className="scan-text">
                    <ScanLine size={20} />
                    <p>Analyzing design...</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {designImageUrl && !designAnalysis && !uploadingDesign && (
            <div className="audit-context-bar">
              <input
                type="text"
                className="context-input"
                placeholder="What is this design? (e.g., Login page, Dashboard, Landing page...)"
                value={designContext}
                onChange={(e) => setDesignContext(e.target.value)}
                maxLength={100}
              />
              <button className="run-audit-btn" onClick={runAudit}>
                <ScanLine size={16} />
                Start {auditMode === 'universal' ? 'Universal' : 'Brand'} Audit
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Inspector ── */}
        <div className="audit-inspector">
          {!designAnalysis ? (
            <div className="inspector-empty">
              <Eye size={32} strokeWidth={1.5} />
              <h3>Ready to Inspect</h3>
              <p>Upload a design and run the audit to see AI insights.</p>
            </div>
          ) : (
            <div className="inspector-content">
              {/* Scores Row */}
              <div className="scores-grid">
                <CircularScore score={scores.overall} label="Overall" />
                <CircularScore score={scores.visualHierarchy} label="Hierarchy" />
                <CircularScore score={scores.colorHarmony} label="Color" />
                <CircularScore score={scores.typography} label="Typography" />
                <CircularScore score={scores.spacing} label="Spacing" />
                <CircularScore score={scores.accessibility} label="Accessibility" />
                {scores.brandConsistency !== undefined && (
                  <CircularScore score={scores.brandConsistency} label="Brand" />
                )}
              </div>

              {/* Tab Navigation */}
              <div className="inspector-tabs">
                <button className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`} onClick={() => setActiveTab('issues')}>
                  <AlertTriangle size={14} /> Issues ({issues.length})
                </button>
                <button className={`tab-btn ${activeTab === 'colors' ? 'active' : ''}`} onClick={() => setActiveTab('colors')}>
                  <Palette size={14} /> Colors
                </button>
                <button className={`tab-btn ${activeTab === 'typography' ? 'active' : ''}`} onClick={() => setActiveTab('typography')}>
                  <Type size={14} /> Type
                </button>
                <button className={`tab-btn ${activeTab === 'strengths' ? 'active' : ''}`} onClick={() => setActiveTab('strengths')}>
                  <CheckCircle2 size={14} /> Strengths
                </button>
              </div>

              {/* ─── ISSUES TAB ─── */}
              {activeTab === 'issues' && (
                <div className="tab-content">
                  {/* Severity Filter */}
                  <div className="severity-filter">
                    {['all', 'high', 'medium', 'low'].map(sev => (
                      <button
                        key={sev}
                        className={`sev-btn ${severityFilter === sev ? 'active' : ''} ${sev}`}
                        onClick={() => setSeverityFilter(sev)}
                      >
                        {sev === 'all' ? `All (${issues.length})` : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${issues.filter(i => i.severity === sev).length})`}
                      </button>
                    ))}
                  </div>

                  {/* Issue Cards */}
                  <div className="issues-list">
                    {filteredIssues.map((issue, filteredIdx) => {
                      const realIdx = issues.indexOf(issue);
                      return (
                        <div
                          key={realIdx}
                          ref={el => issueRefs.current[realIdx] = el}
                          className={`issue-card ${issue.severity} ${selectedIssue === realIdx ? 'active' : ''} ${hoveredIssue === realIdx ? 'hovered' : ''}`}
                          onClick={() => setSelectedIssue(realIdx)}
                          onMouseEnter={() => setHoveredIssue(realIdx)}
                          onMouseLeave={() => setHoveredIssue(null)}
                        >
                          <div className="issue-header">
                            <span className="issue-number">{realIdx + 1}</span>
                            {(() => { const CatIcon = CATEGORY_META[issue.category]?.Icon || Layers; return <CatIcon size={14} className="issue-category-icon" />; })()}
                            <h4>{issue.title}</h4>
                            <span className="issue-severity">{issue.severity}</span>
                          </div>
                          <p className="issue-description">{issue.description}</p>
                          {issue.suggestion && (
                            <div className="ai-suggestion-box">
                              <Sparkles size={14} />
                              <div>
                                <strong>InspoAI Suggestion</strong>
                                <p>{issue.suggestion}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredIssues.length === 0 && (
                      <div className="no-issues-msg">No {severityFilter} severity issues found.</div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── COLORS TAB ─── */}
              {activeTab === 'colors' && (
                <div className="tab-content">
                  <div className="section-intro">
                    <Palette size={16} />
                    <span>Extracted color palette with WCAG contrast analysis</span>
                  </div>
                  <div className="color-grid">
                    {(designAnalysis.colorPalette || []).map((color, i) => (
                      <ColorSwatch key={i} color={color} />
                    ))}
                  </div>
                  {(!designAnalysis.colorPalette || designAnalysis.colorPalette.length === 0) && (
                    <div className="no-data-msg">No color palette data available.</div>
                  )}
                </div>
              )}

              {/* ─── TYPOGRAPHY TAB ─── */}
              {activeTab === 'typography' && (
                <div className="tab-content">
                  <div className="section-intro">
                    <Type size={16} />
                    <span>Typography & spacing analysis</span>
                  </div>

                  {designAnalysis.typography && (
                    <div className="typography-section">
                      {/* Real detected fonts from WhatFontIs API */}
                      {designAnalysis.typography.detectedFonts?.length > 0 && (
                        <div className="type-block">
                          <h4>Fonts Detected</h4>
                          <div className="detected-fonts-grid">
                            {designAnalysis.typography.detectedFonts.map((font, i) => (
                              <a
                                key={i}
                                className="detected-font-card"
                                href={font.url || '#'}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={`View ${font.name} on WhatFontIs`}
                              >
                                {font.sampleImage && (
                                  <img src={font.sampleImage} alt={font.name} className="font-sample-img" />
                                )}
                                <span className="font-name">{font.name}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Fallback: AI-estimated font names (no detectedFonts) */}
                      {!designAnalysis.typography.detectedFonts?.length && designAnalysis.typography.fontsDetected?.length > 0 && (
                        <div className="type-block">
                          <h4>Fonts Detected (AI Estimate)</h4>
                          <div className="font-tags">
                            {designAnalysis.typography.fontsDetected.map((f, i) => (
                              <span key={i} className="font-tag">{f}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {designAnalysis.typography.hierarchyNote && (
                        <div className="type-block">
                          <h4>Hierarchy</h4>
                          <p>{designAnalysis.typography.hierarchyNote}</p>
                        </div>
                      )}

                      {designAnalysis.typography.issues?.length > 0 && (
                        <div className="type-block">
                          <h4>Issues</h4>
                          <ul className="type-issues-list">
                            {designAnalysis.typography.issues.map((issue, i) => (
                              <li key={i}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Brand font match */}
                      {designAnalysis.typography.brandFonts && (
                        <div className="type-block">
                          <h4>Brand Font Match</h4>
                          <div className="brand-font-match">
                            <span>Expected: {designAnalysis.typography.brandFonts.join(', ')}</span>
                            {designAnalysis.typography.fontMatchScore !== undefined && (
                              <span className={`match-score ${designAnalysis.typography.fontMatchScore >= 80 ? 'good' : 'poor'}`}>
                                {designAnalysis.typography.fontMatchScore}% match
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Spacing Analysis */}
                  {designAnalysis.spacingAnalysis && (
                    <div className="spacing-section">
                      <h4><Grid3X3 size={14} /> Spacing & Grid</h4>
                      <p>{designAnalysis.spacingAnalysis}</p>
                    </div>
                  )}

                  {!designAnalysis.typography && !designAnalysis.spacingAnalysis && (
                    <div className="no-data-msg">No typography or spacing data available.</div>
                  )}
                </div>
              )}

              {/* ─── STRENGTHS TAB ─── */}
              {activeTab === 'strengths' && (
                <div className="tab-content">
                  <div className="section-intro strengths-intro">
                    <CheckCircle2 size={16} />
                    <span>What you did well</span>
                  </div>
                  <div className="strengths-list">
                    {(designAnalysis.strengths || []).map((s, i) => (
                      <div key={i} className="strength-card">
                        <CheckCircle2 size={16} className="strength-icon" />
                        <p>{s}</p>
                      </div>
                    ))}
                  </div>
                  {(!designAnalysis.strengths || designAnalysis.strengths.length === 0) && (
                    <div className="no-data-msg">No strengths data available.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAudit;
