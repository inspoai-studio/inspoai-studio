import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MoodboardService from '../../services/MoodboardService';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import ScannerService from '../../services/ScannerService';
import { useAuth } from '../../context/AuthContext';
import PricingModal from '../PricingModal';
import UpgradePromptModal from '../UpgradePromptModal';
import '../../styles/BrandScanner.css';
import {
    Search,
    Globe,
    RotateCw,
    X,
    Target,
    Rocket,
    ChevronDown,
    Figma,
    Check
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                CUSTOM NODES                                */
/* -------------------------------------------------------------------------- */

import { nodeTypes } from './ScannerNodes';

/* -------------------------------------------------------------------------- */
/*                                MAIN COMPONENT                              */
/* -------------------------------------------------------------------------- */

const BrandScanner = () => {
    const navigate = useNavigate();
    const { userData } = useAuth();
    const [url, setUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [scanResult, setScanResult] = useState(null);
    const [modalImages, setModalImages] = useState(null);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
    const [upgradeMessage, setUpgradeMessage] = useState({ title: '', message: '' });
    const [analyzingCompetitors, setAnalyzingCompetitors] = useState(false);
    const [analyzingICP, setAnalyzingICP] = useState(false);
    const [analyzingAudit, setAnalyzingAudit] = useState(false);
    const [marketingDropdownOpen, setMarketingDropdownOpen] = useState(false);
    const [exportingToFigma, setExportingToFigma] = useState(false);
    const [exportToast, setExportToast] = useState(null); // 'success' | 'error' | null

    // Close dropdown on outside click
    React.useEffect(() => {
        const handleClickOutside = (e) => {
            if (marketingDropdownOpen && !e.target.closest('.marketing-dropdown-container')) {
                setMarketingDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [marketingDropdownOpen]);

    const handleAnalyzeICP = async () => {
        if (!url || nodes.length === 0) return;
        setAnalyzingICP(true);
        try {
            const data = await ScannerService.analyzeICP(url);

            const centerX = 0;
            const centerY = 0;
            const newNodeId = 'icp-node';

            setNodes(nds => [
                ...nds,
                {
                    id: newNodeId,
                    type: 'icp',
                    position: { x: centerX + 500, y: centerY - 650 },
                    data: { icp: data }
                }
            ]);

            setEdges(eds => [
                ...eds,
                {
                    id: `e-root-${newNodeId}`,
                    source: 'root',
                    target: newNodeId,
                    type: 'default',
                    animated: true,
                    style: { stroke: '#9333ea', strokeWidth: 1.5, opacity: 0.8 },
                }
            ]);
        } catch (err) {
            if (err.limitReached || err.upgradeRequired) {
                setUpgradeMessage({
                    title: 'Upgrade Required',
                    message: err.message || 'Target Audience (ICP) generation is a premium feature. Please upgrade to unlock this capability.'
                });
                setShowUpgradePrompt(true);
            } else {
                setError(err.message || 'Failed to analyze ICP.');
            }
        } finally {
            setAnalyzingICP(false);
        }
    };

    const handleAnalyzeAudit = async () => {
        if (!url || nodes.length === 0) return;
        setAnalyzingAudit(true);
        try {
            const data = await ScannerService.analyzeAudit(url);

            const centerX = 0;
            const centerY = 0;
            const tools = data.tools || [];
            const keywords = data.keywords || [];
            const timestamp = Date.now();

            setNodes(nds => {
                const newNodes = [...nds];

                // Create Header Nodes
                const toolsHeaderId = `header-tools-${timestamp}`;
                const keywordsHeaderId = `header-keywords-${timestamp}`;

                if (tools.length > 0) {
                    newNodes.push({
                        id: toolsHeaderId,
                        type: 'growthHeader',
                        position: { x: centerX - 1300, y: centerY - 700 },
                        data: {
                            title: 'Engineering as Marketing',
                            subtitle: 'Free Lead-Gen Tools',
                            icon: 'rocket',
                            color: '#16a34a',
                            bgColor: '#f0fdf4'
                        }
                    });
                }

                if (keywords.length > 0) {
                    newNodes.push({
                        id: keywordsHeaderId,
                        type: 'growthHeader',
                        position: { x: centerX - 850, y: centerY - 700 },
                        data: {
                            title: 'SEO Content Keywords',
                            subtitle: 'High-Intent Content',
                            icon: 'search',
                            color: '#8b5cf6',
                            bgColor: '#f5f3ff'
                        }
                    });
                }

                // Lay out tools vertically under the header
                tools.forEach((t, i) => {
                    newNodes.push({
                        id: `tool-${timestamp}-${i}`,
                        type: 'toolNode',
                        position: { x: centerX - 1300, y: centerY - 500 + (i * 220) },
                        data: t
                    });
                });

                // Lay out keywords vertically under the header
                keywords.forEach((k, i) => {
                    newNodes.push({
                        id: `keyword-${timestamp}-${i}`,
                        type: 'keywordNode',
                        position: { x: centerX - 850, y: centerY - 500 + (i * 140) },
                        data: k
                    });
                });

                return newNodes;
            });

            setEdges(eds => {
                const newEdges = [...eds];
                const toolsHeaderId = `header-tools-${timestamp}`;
                const keywordsHeaderId = `header-keywords-${timestamp}`;

                // Connect Root to Headers
                if (tools.length > 0) {
                    newEdges.push({
                        id: `e-root-${toolsHeaderId}`,
                        source: 'root',
                        target: toolsHeaderId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#16a34a', strokeWidth: 2, opacity: 0.8 },
                    });
                }

                if (keywords.length > 0) {
                    newEdges.push({
                        id: `e-root-${keywordsHeaderId}`,
                        source: 'root',
                        target: keywordsHeaderId,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#8b5cf6', strokeWidth: 2, opacity: 0.8 },
                    });
                }

                // Connect Headers to individual nodes
                tools.forEach((t, i) => {
                    newEdges.push({
                        id: `e-${toolsHeaderId}-tool-${i}`,
                        source: toolsHeaderId,
                        target: `tool-${timestamp}-${i}`,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#16a34a', strokeWidth: 1.5, opacity: 0.6 },
                    });
                });

                keywords.forEach((k, i) => {
                    newEdges.push({
                        id: `e-${keywordsHeaderId}-keyword-${i}`,
                        source: keywordsHeaderId,
                        target: `keyword-${timestamp}-${i}`,
                        type: 'smoothstep',
                        animated: true,
                        style: { stroke: '#8b5cf6', strokeWidth: 1.5, opacity: 0.6 },
                    });
                });

                return newEdges;
            });
        } catch (err) {
            if (err.limitReached || err.upgradeRequired) {
                setUpgradeMessage({
                    title: 'Upgrade Required',
                    message: err.message || 'Growth Ideas & Audits are premium features. Please upgrade to unlock them.'
                });
                setShowUpgradePrompt(true);
            } else {
                setError(err.message || 'Failed to perform audit.');
            }
        } finally {
            setAnalyzingAudit(false);
        }
    };

    const handleAnalyzeCompetitors = async () => {
        if (!url || nodes.length === 0) return;
        setAnalyzingCompetitors(true);
        try {
            const data = await ScannerService.analyzeCompetitors(url);

            const centerX = 0;
            const centerY = 0;
            const newNodeId = 'competitors';

            setNodes(nds => {
                const newNodes = [...nds];
                // Layout logic for competitors (arc/circle pattern below the main node)
                data.forEach((comp, index) => {
                    // Spread competitors out wide below the main entity
                    // Calculate positions in a slight arc
                    const totalComps = data.length;
                    const spreadWidth = Math.max(1600, totalComps * 250); // Total width to spread across
                    const startX = centerX - (spreadWidth / 2);
                    const spacingX = spreadWidth / (totalComps > 1 ? totalComps - 1 : 1);

                    const posX = startX + (index * spacingX);
                    // Add a slight arc by manipulating Y based on distance from center
                    const distFromCenter = Math.abs(posX - centerX);
                    const posY = centerY + 800 + (distFromCenter * 0.15);

                    const compNodeId = `competitor-${index}`;

                    newNodes.push({
                        id: compNodeId,
                        type: 'competitorSingle',
                        position: { x: posX, y: posY },
                        data: comp
                    });
                });
                return newNodes;
            });

            setEdges(eds => {
                const newEdges = [...eds];
                data.forEach((_, index) => {
                    const compNodeId = `competitor-${index}`;
                    newEdges.push({
                        id: `e-root-${compNodeId}`,
                        source: 'root',
                        target: compNodeId,
                        type: 'default',
                        animated: true,
                        style: { stroke: '#ef4444', strokeWidth: 1.5, opacity: 0.8 },
                    });
                });
                return newEdges;
            });
        } catch (err) {
            setError(err.message || 'Failed to analyze competitors.');
        } finally {
            setAnalyzingCompetitors(false);
        }
    };

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    const handleScan = async (e, forcedRefresh = false) => {
        if (e) e.preventDefault();
        if (!url) return;

        let validUrl = url.trim();
        if (!validUrl.startsWith('http')) {
            validUrl = `https://${validUrl}`;
        }

        setLoading(true);
        setError(null);
        setNodes([]);
        setEdges([]);
        setScanResult(null);
        setModalImages(null);

        try {
            const data = await ScannerService.scanWebsite(validUrl, forcedRefresh);
            if (!data.isCached) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
            setScanResult(data);

            const centerX = 0;
            const centerY = 0;

            const newNodes = [];
            const newEdges = [];

            // 1. Center Node
            newNodes.push({
                id: 'root',
                type: 'website',
                position: { x: centerX, y: centerY },
                data: {
                    label: data.title || validUrl,
                    url: validUrl,
                    description: data.description,
                    logo: data.logo,
                    screenshot: data.screenshot
                }
            });

            // Quadrant Layout Logic
            const layoutPositions = {
                contacts: { x: centerX - 550, y: centerY - 250 },
                colors: { x: centerX - 50, y: centerY - 500 },
                fonts: { x: centerX + 350, y: centerY - 450 },
                assets: { x: centerX + 550, y: centerY + 0 },
                seo: { x: centerX + 150, y: centerY + 450 },
                pricing: { x: centerX - 450, y: centerY + 450 },
                logo: { x: centerX - 550, y: centerY + 100 },
                tech: { x: centerX + 450, y: centerY + 350 },
                builtwith: { x: centerX - 450, y: centerY + 200 },
                subdomains: { x: centerX + 600, y: centerY + 100 },
            };

            const branches = [];
            if (data.colors?.length > 0) branches.push({ type: 'colors', data: { colors: data.colors } });
            if (data.fonts?.length > 0) branches.push({ type: 'fonts', data: { fonts: data.fonts } });
            if (data.techStack?.length > 0) branches.push({ type: 'tech', data: { stack: data.techStack } });
            if (data.images?.length > 0) branches.push({ type: 'assets', data: { images: data.images, onOpenModal: (imgs) => setModalImages(imgs) } });
            if (data.meta) branches.push({ type: 'seo', data: { description: data.description, meta: data.meta } });
            if (data.pricing?.hasPricing || (data.pricing?.plans && data.pricing.plans.length > 0)) branches.push({ type: 'pricing', data: { ...data.pricing } });
            if (data.logo) branches.push({ type: 'logo', data: { logo: data.logo } });
            if ((data.emails?.length > 0) || (data.social && Object.keys(data.social).length > 0)) branches.push({ type: 'contacts', data: { emails: data.emails, phones: data.phones, social: data.social } });
            if (data.subdomains?.length > 0) branches.push({ type: 'subdomains', data: { subdomains: data.subdomains } });

            // Built With — extract CMS/platform from techStack + generator meta
            const detectedPlatforms = (data.techStack || []).filter(t => t.type === 'Platform').map(t => t.name);
            if (data.meta?.generator) {
                const gen = data.meta.generator;
                if (!detectedPlatforms.some(p => gen.toLowerCase().includes(p.toLowerCase()))) {
                    detectedPlatforms.push(gen.split(' ')[0]);
                }
            }
            // Also check for CMS from builtWith field if backend provides it
            if (data.builtWith?.length > 0) {
                data.builtWith.forEach(cms => {
                    if (!detectedPlatforms.includes(cms)) detectedPlatforms.push(cms);
                });
            }
            branches.push({ type: 'builtwith', data: { platforms: [...new Set(detectedPlatforms)] } });

            branches.forEach((branch) => {
                const pos = layoutPositions[branch.type] || { x: centerX + (Math.random() - 0.5) * 1000, y: centerY + (Math.random() - 0.5) * 1000 };
                const nodeId = branch.type;

                newNodes.push({
                    id: nodeId,
                    type: branch.type,
                    position: pos,
                    data: branch.data
                });

                newEdges.push({
                    id: `e-root-${nodeId}`,
                    source: 'root',
                    target: nodeId,
                    type: 'default',
                    animated: true,
                    style: { stroke: '#64748b', strokeWidth: 1.5, opacity: 0.8 },
                });
            });

            setNodes(newNodes);
            setEdges(newEdges);

        } catch (err) {
            if (err.limitReached) {
                setUpgradeMessage({
                    title: 'Scanner Limit Reached',
                    message: err.message || 'You have reached your scanner limit. Please upgrade your plan to run more scans.'
                });
                setShowUpgradePrompt(true);
            } else {
                setError(err.message || 'Failed to scan website. Please check the URL and try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleSaveToMoodboard = async () => {
        if (!scanResult) return;
        setSaving(true);
        try {
            const title = `Brand DNA: ${scanResult.title || url}`;

            const graphData = {
                type: 'react_flow_graph',
                nodes: nodes,
                edges: edges,
                image: scanResult.screenshot, // for thumbnails/previews
                title: title
            };

            // Save graph data to localStorage as backup (until backend schema supports Mixed type)
            const savedGraphs = JSON.parse(localStorage.getItem('inspo_saved_graphs') || '{}');
            savedGraphs[title] = graphData;
            localStorage.setItem('inspo_saved_graphs', JSON.stringify(savedGraphs));

            await MoodboardService.saveCollection([graphData], title);
            navigate('/moodboard', { state: { showCollections: true } });
        } catch (err) {
            setError('Failed to save moodboard: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Export to Figma — load h2d capture script, serialize ReactFlow canvas, copy to clipboard
    const handleExportToFigma = async () => {
        if (exportingToFigma) return;
        setExportingToFigma(true);
        setExportToast(null);

        try {
            // Lazy-load the Figma capture script if not already loaded
            if (!window.figma?.silentCapture) {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = '/figma-capture.min.js';
                    script.onload = resolve;
                    script.onerror = () => reject(new Error('Failed to load Figma capture script'));
                    document.head.appendChild(script);
                });
            }

            // Silent capture: serializes DOM + copies to clipboard with NO toolbar UI
            await window.figma.silentCapture('.react-flow');

            setExportToast('success');
            setTimeout(() => setExportToast(null), 4000);
        } catch (err) {
            console.error('Figma export failed:', err);
            setExportToast('error');
            setTimeout(() => setExportToast(null), 4000);
        } finally {
            setExportingToFigma(false);
        }
    };

    return (
        <div className="brand-scanner-container">
            {/* Header (Only show when results or loading exists) */}
            {(nodes.length > 0 || (loading && url)) && (
                <div className="scanner-header">
                    <div className="scanner-title-container">
                        <div className="scanner-title">
                            <h1>Brand DNA Scanner</h1>
                        </div>
                        <span className="beta-tag">BETA</span>
                    </div>
                    <form onSubmit={handleScan} className="scanner-form">
                        <div className="scanner-input-wrapper">
                            <Search className="scanner-input-icon" size={18} />
                            <input
                                type="text"
                                placeholder="Enter website URL..."
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                disabled={loading || saving}
                            />
                            {url && (
                                <button
                                    type="button"
                                    className="scanner-refresh-inline"
                                    onClick={(e) => handleScan(e, true)}
                                    title="Force Clear & Refresh DNA"
                                    disabled={loading}
                                >
                                    <RotateCw size={14} className={loading ? 'spinning' : ''} />
                                </button>
                            )}
                        </div>
                        <button type="submit" disabled={loading || saving} className="primary-scan-btn">
                            {loading ? 'Analyzing...' : 'Scan DNA'}
                        </button>

                        {scanResult && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSaveToMoodboard}
                                    disabled={saving}
                                    style={{
                                        marginLeft: 12,
                                        background: '#000000',
                                        border: 'none',
                                        color: 'white',
                                        padding: '10px 24px',
                                        borderRadius: '24px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.95rem',
                                        fontFamily: "var(--font-sans)"
                                    }}
                                >
                                    {saving ? 'Saving...' : 'Save to Moodboard'}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleExportToFigma}
                                    disabled={exportingToFigma}
                                    style={{
                                        marginLeft: 12,
                                        background: exportToast === 'success' ? '#16a34a' : '#ffffff',
                                        border: exportToast === 'success' ? '1px solid #16a34a' : '1px solid #e2e8f0',
                                        color: exportToast === 'success' ? '#ffffff' : '#334155',
                                        padding: '10px 24px',
                                        borderRadius: '24px',
                                        cursor: exportingToFigma ? 'wait' : 'pointer',
                                        fontWeight: 600,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        whiteSpace: 'nowrap',
                                        fontSize: '0.95rem',
                                        fontFamily: "var(--font-sans)",
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    {exportingToFigma ? (
                                        <><RotateCw size={16} className="spinning" /> Exporting...</>
                                    ) : exportToast === 'success' ? (
                                        <><Check size={16} /> Copied! Paste in Figma</>
                                    ) : (
                                        <><Figma size={16} /> Export to Figma</>
                                    )}
                                </button>

                                <div className="marketing-dropdown-container" style={{ position: 'relative', marginLeft: 12 }}>
                                    <button
                                        type="button"
                                        onClick={() => setMarketingDropdownOpen(!marketingDropdownOpen)}
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            color: '#334155',
                                            padding: '10px 24px',
                                            borderRadius: '24px',
                                            cursor: 'pointer',
                                            fontWeight: 600,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 8,
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.95rem',
                                            fontFamily: "var(--font-sans)"
                                        }}
                                    >
                                        Marketing Analysis
                                        <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: marketingDropdownOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                                    </button>

                                    {marketingDropdownOpen && (
                                        <div className="marketing-dropdown-menu">
                                            <div className="marketing-dropdown-section-title">Deep Dive Tools</div>
                                            <button
                                                type="button"
                                                onClick={() => { handleAnalyzeICP(); setMarketingDropdownOpen(false); }}
                                                disabled={analyzingICP || nodes.some(n => n.type === 'icp')}
                                                className="marketing-dropdown-item"
                                            >
                                                {analyzingICP ? <RotateCw size={16} className="spinning" /> : <Target size={16} />}
                                                <span>{analyzingICP ? 'Analyzing...' : 'Target Audience (ICP)'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { handleAnalyzeCompetitors(); setMarketingDropdownOpen(false); }}
                                                disabled={analyzingCompetitors || nodes.some(n => n.type === 'competitorSingle')}
                                                className="marketing-dropdown-item"
                                            >
                                                {analyzingCompetitors ? <RotateCw size={16} className="spinning" /> : <Globe size={16} />}
                                                <span>{analyzingCompetitors ? 'Analyzing...' : 'Analyse Competitor'}</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { handleAnalyzeAudit(); setMarketingDropdownOpen(false); }}
                                                disabled={analyzingAudit || nodes.some(n => n.type === 'audit')}
                                                className="marketing-dropdown-item"
                                            >
                                                {analyzingAudit ? <RotateCw size={16} className="spinning" /> : <Rocket size={16} />}
                                                <span>{analyzingAudit ? 'Analyzing...' : 'Growth Ideas'}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </form>
                </div>
            )}

            {/* Canvas / Placeholder / Loading */}
            <div className="scanner-canvas">
                {error && (
                    <div className="scanner-error-toast">
                        {error}
                    </div>
                )}

                {/* Image Viewer Modal */}
                {modalImages && (
                    <div className="scanner-modal-overlay" onClick={() => setModalImages(null)}>
                        <div className="scanner-modal-content" onClick={e => e.stopPropagation()}>
                            <div className="scanner-modal-header">
                                <h3>All Assets ({modalImages.length})</h3>
                                <button className="scanner-modal-close" onClick={() => setModalImages(null)}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="scanner-modal-grid">
                                {modalImages.map((img, i) => (
                                    <div key={i} className="scanner-modal-item">
                                        <img src={img} alt={`Asset ${i}`} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="scanning-container">
                        <div className="scanning-visuals">
                            <div className="scanning-ring"></div>
                            <div className="scanning-ring-inner"></div>
                            <div className="scanning-core">
                                <Globe size={48} color="var(--scanner-primary)" />
                            </div>
                            <div className="scanning-beam"></div>
                        </div>
                        <div className="scanning-status">
                            <h3>Analyzing DNA</h3>
                            <div className="scanning-progress-text">Collecting brand assets & tech stack...</div>
                        </div>
                    </div>
                ) : nodes.length > 0 ? (
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        nodeTypes={nodeTypes}
                        defaultEdgeOptions={{
                            type: 'default',
                            animated: true,
                            style: { stroke: '#334155', strokeWidth: 2 }
                        }}
                        fitView
                        minZoom={0.5}
                        maxZoom={1.5}
                        attributionPosition="bottom-right"
                    >
                        <Background color="#cbd5e1" gap={20} size={1} />
                        <Controls />
                        <MiniMap
                            nodeColor={n => {
                                if (n.type === 'website') return 'var(--scanner-primary)';
                                if (n.type === 'colors') return 'var(--scanner-accent)';
                                return '#cbd5e1';
                            }}
                        />
                    </ReactFlow>
                ) : (
                    <div className="scanner-placeholder-content">
                        <div className="scanner-placeholder-hero">
                            <h2>Enter brand URL</h2>
                            <p>Extract colors, fonts, tech stack, and visual assets from any website in seconds.</p>

                            <div className="hero-search-container">
                                <form onSubmit={(e) => handleScan(e)} className="hero-search-wrapper">
                                    <input
                                        type="text"
                                        placeholder="e.g. stripe.com or apple.com"
                                        value={url}
                                        onChange={(e) => setUrl(e.target.value)}
                                        disabled={loading}
                                    />
                                    {url && !nodes.length && (
                                        <button
                                            type="button"
                                            className="scanner-refresh-inline hero"
                                            onClick={(e) => handleScan(e, true)}
                                            title="Force Fresh Scan"
                                        >
                                            <RotateCw size={16} className={loading ? 'spinning' : ''} />
                                        </button>
                                    )}
                                    <button type="submit" className="hero-search-btn" disabled={loading}>
                                        Scan Now
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>

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

export default BrandScanner;
