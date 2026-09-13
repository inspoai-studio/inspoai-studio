import React, { useState, useRef, useEffect, useCallback } from 'react';
import { auth } from '../../firebase';
import { Rnd } from 'react-rnd';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import '../../styles/AgenticUI.css';
import PricingModal from '../PricingModal';
import { NavigationEvents } from '../Layout/Sidebar';
import ModeToggle from '../ModeToggle';
import { Zap, RotateCw } from 'lucide-react';
import NinjaBlob from './NinjaBlob';
import { useAuth } from '../../context/AuthContext';


const INSPO_LOGO = '/inspo1.svg';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Animated "Original Thinking" rose curve avatar
function ThinkingCurve({ size = 28 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const s = size * 2; // retina
    canvas.width = s; canvas.height = s;
    const cfg = { baseRadius: 7, detailAmplitude: 3, petalCount: 7, curveScale: 3.9, particleCount: 48, trailSpan: 0.38, durationMs: 4600, pulseDurationMs: 4200, rotationDurationMs: 28000 };
    const started = performance.now();
    let animId;
    function point(progress, detailScale) {
      const t = progress * Math.PI * 2;
      const p = Math.round(cfg.petalCount);
      return {
        x: 50 + (cfg.baseRadius * Math.cos(t) - cfg.detailAmplitude * detailScale * Math.cos(p * t)) * cfg.curveScale,
        y: 50 + (cfg.baseRadius * Math.sin(t) - cfg.detailAmplitude * detailScale * Math.sin(p * t)) * cfg.curveScale,
      };
    }
    function render(now) {
      const time = now - started;
      const progress = (time % cfg.durationMs) / cfg.durationMs;
      const pulseP = (time % cfg.pulseDurationMs) / cfg.pulseDurationMs;
      const ds = 0.52 + ((Math.sin(pulseP * Math.PI * 2 + 0.55) + 1) / 2) * 0.48;
      const rot = -((time % cfg.rotationDurationMs) / cfg.rotationDurationMs) * 360;
      ctx.clearRect(0, 0, s, s);
      ctx.save();
      ctx.translate(s / 2, s / 2);
      ctx.rotate(rot * Math.PI / 180);
      ctx.translate(-s / 2, -s / 2);
      // Path
      ctx.beginPath();
      for (let i = 0; i <= 360; i++) {
        const pt = point(i / 360, ds);
        const px = pt.x / 100 * s, py = pt.y / 100 * s;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = 'rgba(17, 17, 17, 0.12)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // Particles
      for (let i = 0; i < cfg.particleCount; i++) {
        const tailOff = i / (cfg.particleCount - 1);
        const p = ((progress - tailOff * cfg.trailSpan) % 1 + 1) % 1;
        const pt = point(p, ds);
        const fade = Math.pow(1 - tailOff, 0.56);
        ctx.beginPath();
        ctx.arc(pt.x / 100 * s, pt.y / 100 * s, (0.6 + fade * 2.2), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(17, 17, 17, ${(0.05 + fade * 0.95).toFixed(3)})`;
        ctx.fill();
      }
      ctx.restore();
      animId = requestAnimationFrame(render);
    }
    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [size]);
  return <canvas ref={canvasRef} style={{ width: size, height: size, borderRadius: '50%' }} />;
}

const SUGGESTIONS = [
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="2" width="14" height="20" rx="3"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>', text: 'Fintech dashboard with revenue chart, dark mode, iOS' },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>', text: 'E-commerce product page, modern minimal, light theme, web' },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>', text: 'Social media feed screen, dark theme, iOS' },
  { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>', text: 'Health app onboarding flow, light theme, tablet' },
];

const PLATFORMS = [
  { id: 'web', label: 'Web', dims: '1440 × 900', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>' },
  { id: 'ios', label: 'iOS', dims: '393 × 852', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>' },
  { id: 'tablet', label: 'Tablet', dims: '1366 × 1024', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>' },
];

const DEVICE_SIZES = {
  web: { width: 1440, height: 900 },
  ios: { width: 393, height: 852 },
  tablet: { width: 1366, height: 1024 },
};

const getCalculatedPageHeight = (html, defaultHeight = 900) => {
  return defaultHeight;
};

const FUNNY_LOADING_PHRASES = [
  "Cooking up some tasteful layouts...",
  "Fixing the creative angle...",
  "Steeping the creative juices...",
  "Consulting the design oracle...",
  "Aligning pixels to absolute perfection...",
  "Polishing the whitespace...",
  "Sprinkling some visual magic...",
  "Balancing the design cosmos...",
  "Drafting screens with extreme craft...",
  "Adding a pinch of creative soul..."
];

const PremiumGenerationPreview = ({ html, platform, theme }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 140 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const deviceSize = DEVICE_SIZES[platform] || DEVICE_SIZES.ios;
  const frameWidth = deviceSize.width;
  const frameHeight = deviceSize.height || 800;

  // Compute scale to fit perfectly inside container with small padding (8px on each side)
  const scale = Math.min((dimensions.width - 16) / frameWidth, (dimensions.height - 16) / frameHeight);
  const isMobile = platform === 'ios';

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: theme === 'dark' ? '#0f0f11' : '#fcfcfc',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {isMobile ? (
        <div style={{
          position: 'relative',
          width: frameWidth,
          height: frameHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          borderRadius: '48px',
          background: theme === 'dark' ? '#0c0c0e' : '#ffffff',
          flexShrink: 0,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          border: '12px solid #000000',
          boxSizing: 'border-box'
        }}>
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: '36px',
            transform: 'translate3d(0, 0, 0)',
            WebkitMaskImage: '-webkit-radial-gradient(white, black)'
          }}>
            <iframe
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                pointerEvents: 'none',
                borderRadius: '36px',
                transform: 'translate3d(0, 0, 0)'
              }}
            />
          </div>
        </div>
      ) : (
        <div style={{
          position: 'relative',
          width: frameWidth,
          height: frameHeight,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          borderRadius: '12px',
          border: '8px solid #18181b',
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          overflow: 'hidden',
          background: theme === 'dark' ? '#0c0c0e' : '#ffffff',
          flexShrink: 0
        }}>
          {/* Browser header bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '24px',
            background: '#18181b',
            display: 'flex',
            alignItems: 'center',
            padding: '0 10px',
            gap: '5px',
            zIndex: 10,
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }} />
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
          </div>
          <div style={{ width: '100%', height: 'calc(100% - 24px)', marginTop: '24px' }}>
            <iframe
              srcDoc={html}
              sandbox="allow-scripts allow-same-origin"
              scrolling="no"
              style={{ width: '100%', height: '100%', border: 'none', pointerEvents: 'none' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

const COLOR_PALETTES = [
  // LIGHT PRESETS
  { name: 'Soft Clay', theme: 'light', background: '#F6EFE9', surface: '#FFFFFF', accent: '#D77A5E', accent2: '#5F7C8A', textPrimary: '#2D221E' },
  { name: 'Peach Signal', theme: 'light', background: '#FFF4EC', surface: '#FFFFFF', accent: '#FF6A3D', accent2: '#6C63FF', textPrimary: '#250F08' },
  { name: 'Ocean Board', theme: 'light', background: '#EEF7FA', surface: '#FFFFFF', accent: '#1398D6', accent2: '#14B8A6', textPrimary: '#0F172A' },
  { name: 'Mint Studio', theme: 'light', background: '#F1F8F5', surface: '#FFFFFF', accent: '#14B8A6', accent2: '#2563EB', textPrimary: '#0F172A' },
  { name: 'Sage Gold', theme: 'light', background: '#F5F7F2', surface: '#FFFFFF', accent: '#7C9A6D', accent2: '#D4A843', textPrimary: '#283618' },
  { name: 'Rose Product', theme: 'light', background: '#FCF1F5', surface: '#FFFFFF', accent: '#E11D74', accent2: '#7C3AED', textPrimary: '#1F0913' },
  { name: 'Sand Amber', theme: 'light', background: '#FAF6EE', surface: '#FFFFFF', accent: '#E68A00', accent2: '#5B6CFF', textPrimary: '#291B05' },
  { name: 'Ice Indigo', theme: 'light', background: '#F3F6FB', surface: '#FFFFFF', accent: '#4F46E5', accent2: '#06B6D4', textPrimary: '#0F172A' },
  { name: 'Cloud Lime', theme: 'light', background: '#F7F8F2', surface: '#FFFFFF', accent: '#84CC16', accent2: '#0F766E', textPrimary: '#111827' },
  { name: 'Stone Cherry', theme: 'light', background: '#F7F4F2', surface: '#FFFFFF', accent: '#EF4444', accent2: '#8B5CF6', textPrimary: '#1F1111' },

  // DARK PRESETS
  { name: 'Midnight Violet', theme: 'dark', background: '#090B14', surface: '#121424', accent: '#7C5CFF', accent2: '#22D3EE', textPrimary: '#F5F5F7' },
  { name: 'Ink Cyan', theme: 'dark', background: '#07131B', surface: '#0E1F2B', accent: '#009FF5', accent2: '#22C55E', textPrimary: '#E6F4FE' },
  { name: 'Deep Ocean', theme: 'dark', background: '#071A22', surface: '#0F2630', accent: '#1D9BF0', accent2: '#2DD4BF', textPrimary: '#E0F2FE' },
  { name: 'Forest Neon', theme: 'dark', background: '#08170F', surface: '#102419', accent: '#22C55E', accent2: '#A3E635', textPrimary: '#ECFDF5' },
  { name: 'Charcoal Ember', theme: 'dark', background: '#121010', surface: '#1E1B1B', accent: '#FF7A1A', accent2: '#FACC15', textPrimary: '#FFEDD5' },
  { name: 'Graphite Rose', theme: 'dark', background: '#11131A', surface: '#1A1D29', accent: '#FF2D95', accent2: '#8B5CF6', textPrimary: '#FFFFFF' },
  { name: 'Carbon Mint', theme: 'dark', background: '#0A1111', surface: '#121F1F', accent: '#2DD4BF', accent2: '#60A5FA', textPrimary: '#E6FFFC' },
  { name: 'Night Coral', theme: 'dark', background: '#120D11', surface: '#1E161C', accent: '#FF6B6B', accent2: '#F59E0B', textPrimary: '#FFEBEB' },
  { name: 'Black Iris', theme: 'dark', background: '#08090F', surface: '#10121F', accent: '#5B5AF7', accent2: '#38BDF8', textPrimary: '#ECECFF' },
  { name: 'Obsidian Jade', theme: 'dark', background: '#06110E', surface: '#0F1F1B', accent: '#10B981', accent2: '#D1FA5C', textPrimary: '#E6FFF7' }
];

const FONT_OPTIONS = [
  { name: 'Inter', category: 'Clean & Modern' },
  { name: 'DM Sans', category: 'Friendly & Rounded' },
  { name: 'Outfit', category: 'Bold & Startup' },
  { name: 'Plus Jakarta Sans', category: 'Premium' },
  { name: 'Manrope', category: 'Geometric' },
  { name: 'Space Grotesk', category: 'Developer' },
  { name: 'Sora', category: 'Futuristic' },
  { name: 'Geist', category: 'Minimal' },
  { name: 'Playfair Display', category: 'Classic Serif' },
  { name: 'Instrument Serif', category: 'Elegant Serif' },
  { name: 'EB Garamond', category: 'Traditional Serif' },
];

const ICON_STYLES = [
  {
    id: 'outline', label: 'Outline', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
  {
    id: 'filled', label: 'Filled', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.1L1 10.5h3V21h6v-7h4v7h6V10.5h3L12 2.1z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>` },
  {
    id: 'duotone', label: 'Duotone', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" fill="currentColor" opacity="0.2"/><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 21V12h6v9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z" fill="currentColor" opacity="0.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" fill="currentColor" opacity="0.15"/><circle cx="11" cy="11" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>` },
  {
    id: 'sharp', label: 'Sharp', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter" stroke-linecap="square"><path d="M3 10L12 3l9 7V21H4V10z"/><path d="M9 21V13h6v8"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="miter"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="square"><circle cx="11" cy="11" r="7"/><line x1="20" y1="20" x2="15.65" y2="15.65"/></svg>` },
  {
    id: 'rounded', label: 'Rounded', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V20a2 2 0 01-2 2H6a2 2 0 01-2-2v-9.5z"/><path d="M9 22V13a1 1 0 011-1h4a1 1 0 011 1v9"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
  {
    id: 'minimal', label: 'Minimal', icon: `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 000-7.78z"/></svg>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>` },
];

// Helper to format relative time (e.g. "2h ago")
const formatRelativeTime = (date) => {
  if (!date) return '';
  const now = new Date();
  const diff = now - new Date(date);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
};

export default function AgenticUI({ user }) {
  const { trackActivity } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null); // { url, path }
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const paletteStripRef = useRef(null);

  useEffect(() => {
    if (trackActivity) {
      trackActivity('Agentic UI');
    }
  }, [trackActivity]);

  // Auto-resize textarea when input state changes
  useEffect(() => {
    const textareas = document.querySelectorAll('.agentic-premium-input-wrapper-new textarea, .agentic-main-textarea');
    textareas.forEach(ta => {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    });
  }, [input]);

  const [platform, setPlatform] = useState('ios');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [currentHTML, setCurrentHTML] = useState(null);
  const [screens, setScreens] = useState([]);
  const [activeScreen, setActiveScreen] = useState(0);
  const [designBrief, setDesignBrief] = useState(null);
  const [references, setReferences] = useState([]);
  const [pendingIntent, setPendingIntent] = useState(null);
  const [originalPrompt, setOriginalPrompt] = useState('');
  const [clarificationAnswer, setClarificationAnswer] = useState('');
  const [requestId, setRequestId] = useState('');
  const [isLandingView, setIsLandingView] = useState(true);
  const [showSuggestionsDropdown, setShowSuggestionsDropdown] = useState(false);
  const [agenticQuota, setAgenticQuota] = useState(null);
  const [cachedScan, setCachedScan] = useState(null);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [thinkingMode, setThinkingMode] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [robotSide, setRobotSide] = useState('right');
  const [isRobotWalking, setIsRobotWalking] = useState(false);

  // Landing-site handoff: /agentic-ui?prompt=... pre-fills the composer so the
  // hero search bar on the website flows straight into a generation.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('prompt');
    if (p) {
      setInput(p);
      setIsInputFocused(true);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [thinkingLogs, setThinkingLogs] = useState([]);
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false);

  useEffect(() => {
    if (!loading) {
      setThinkingLogs([]);
      return;
    }

    const logsList = [
      { text: 'Analyzing prompt intent...', delay: 0 },
      { text: uploadedImage ? 'Scanning screenshot structures...' : 'Evaluating page layout structures...', delay: 2000 },
      { text: 'Synthesizing theme configurations...', delay: 4500 },
      { text: 'Drafting React Component JSX...', delay: 7000 },
      { text: 'Polishing interface aesthetics...', delay: 10500 },
    ];

    setThinkingLogs([{ text: logsList[0].text, status: 'active' }]);

    const timeouts = [];
    logsList.forEach((log, index) => {
      if (index === 0) return;
      
      const t = setTimeout(() => {
        setThinkingLogs(prev => {
          const updated = prev.map((item, idx) => 
            idx === prev.length - 1 ? { ...item, status: 'completed' } : item
          );
          return [...updated, { text: log.text, status: 'active' }];
        });
      }, log.delay);
      timeouts.push(t);
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [loading, uploadedImage]);

  const effectiveQuota = agenticQuota || (user?.usageStats?.agenticGenerations ? {
    used: user.usageStats.agenticGenerations.used,
    limit: user.usageStats.agenticGenerations.limit,
    remaining: user.usageStats.agenticGenerations.remaining,
    isUnlimited: user.usageStats.agenticGenerations.limit === 'Unlimited'
  } : null);
  // Design brief picker state
  const [showDesignBrief, setShowDesignBrief] = useState(false);
  const [selectedPalette, setSelectedPalette] = useState(COLOR_PALETTES[0]);
  const [headingFont, setHeadingFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('DM Sans');
  const [iconStyle, setIconStyle] = useState('outline');
  const [uiStyles, setUiStyles] = useState([]);
  const [selectedStyle, setSelectedStyle] = useState('taste-skill');
  const [previewSkill, setPreviewSkill] = useState(null);
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [customPrimary, setCustomPrimary] = useState('#1A1A2E');
  const [customAccent, setCustomAccent] = useState('#FF5A2B');
  const [customBg, setCustomBg] = useState('#FFF3ED');
  const [sessionHasImage, setSessionHasImage] = useState(false);
  const [sessionImagePath, setSessionImagePath] = useState(null);

  // AI Palette states
  const [aiPalette, setAiPalette] = useState(null);
  const [isThinkingPalette, setIsThinkingPalette] = useState(false);
  const [paletteSource, setPaletteSource] = useState('preset');
  const [paletteLocked, setPaletteLocked] = useState(false);
  const [visualAssetMode, setVisualAssetMode] = useState('mixed');

  const suggestPalette = async (promptText) => {
    if (!promptText || paletteLocked) return;
    setIsThinkingPalette(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/suggest-palette`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          prompt: promptText,
          platform,
          theme: selectedPalette?.theme || 'dark',
          selectedSkill: selectedStyle,
          visualAssetMode
        })
      });
      const data = await res.json();
      if (data.status === 'success' && data.palette) {
        setAiPalette(data.palette);
        setPaletteSource('ai');
        setSelectedPalette(data.palette);
      }
    } catch (err) {
      console.error('Failed to suggest palette:', err);
    } finally {
      setIsThinkingPalette(false);
    }
  };
  // Canvas state
  const [canvasItems, setCanvasItems] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTool, setActiveTool] = useState('hand');
  const [zoomScale, setZoomScale] = useState(1);
  const [chatCollapsed, setChatCollapsed] = useState(true); // sidebar hidden by default — center composer is primary
  const [isDragging, setIsDragging] = useState(null);
  const [exportingFigmaCardId, setExportingFigmaCardId] = useState(null);
  const [exportToastCardId, setExportToastCardId] = useState(null);
  const [exportingAllFigma, setExportingAllFigma] = useState(false);
  const [exportAllToast, setExportAllToast] = useState(false);
  const [comingSoonToast, setComingSoonToast] = useState(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); // To support speed multiplier
  const [cardChatInputs, setCardChatInputs] = useState({});
  const [activeResponsiveDropdownCardId, setActiveResponsiveDropdownCardId] = useState(null);
  // Error detection & free fix state
  const [cardErrors, setCardErrors] = useState({}); // { [cardId]: errorMessage }
  const [fixingCards, setFixingCards] = useState({}); // { [cardId]: true } while fix is in-flight
  // v3: structured clarification question cards (bottom-center dock)
  const [structuredQuestions, setStructuredQuestions] = useState(null);
  const [questionIdx, setQuestionIdx] = useState(0);
  const [questionAnswers, setQuestionAnswers] = useState({}); // { [qId]: Set-like array of labels }
  const [selectedDnaId, setSelectedDnaId] = useState(null);
  const [fontsCustomized, setFontsCustomized] = useState(false); // only send font overrides when the user actually chose
  const [liveBuilding, setLiveBuilding] = useState(false); // true once live-build frames are on canvas (hides blob overlay)
  const genCardsRef = useRef({}); // { [screenIndex]: canvasCardId } for the current generation
  const lastPartialHtmlRef = useRef({}); // cache of the latest partial HTML for live streaming

  // Live-build partials: the FIRST chunk loads the document shell (one
  // iframe load); every later chunk is postMessage'd into the running
  // document so Tailwind/fonts are never re-fetched — no reload thrash.
  const liveShellLoadedRef = useRef({});
  const applyScreenPartial = (idx, html) => {
    const cardId = genCardsRef.current[idx];
    if (!cardId || typeof html !== 'string') return;
    
    // Always store the latest HTML chunk for this card
    lastPartialHtmlRef.current[cardId] = html;

    if (!liveShellLoadedRef.current[cardId]) {
      liveShellLoadedRef.current[cardId] = true;
      setCanvasItems(prev => prev.map(c => c.id === cardId ? { ...c, html, initialHtml: html, building: true } : c));
      return;
    }
    const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const iframe = document.querySelector(`#figma-target-${cardId} iframe`);
    if (m && iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'v3-body', html: m[1] }, '*');
    } else {
      setCanvasItems(prev => prev.map(c => c.id === cardId ? { ...c, html, building: true } : c));
    }
  };

  // Animated skeleton shown in a card from the moment its screen starts
  // composing until the first streamed chunk replaces it. (Cards with empty
  // html are filtered out of the canvas — this also makes placeholders render.)
  const buildSkeletonDoc = (plat) => {
    const mobile = plat === 'ios';
    const blocks = mobile
      ? `<div class="sk h48 w40"></div><div class="sk h220"></div><div class="row"><div class="sk h90"></div><div class="sk h90"></div></div><div class="sk h16 w70"></div><div class="sk h16 w50"></div><div class="sk h120"></div><div class="sk h120"></div>`
      : `<div class="row" style="margin-bottom:28px"><div class="sk h40" style="max-width:140px"></div><div style="flex:3"></div><div class="sk h40" style="max-width:120px"></div></div><div class="row"><div class="sk h110"></div><div class="sk h110"></div><div class="sk h110"></div><div class="sk h110"></div></div><div class="row" style="margin-top:8px"><div class="sk h260" style="flex:2"></div><div class="sk h260" style="flex:1"></div></div><div class="sk h200" style="margin-top:8px"></div>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#F4F4F2;font-family:sans-serif;padding:${mobile ? '20px 16px' : '32px 40px'}}
      .sk{background:linear-gradient(90deg,#E7E7E3 25%,#F0F0EC 45%,#E7E7E3 65%);background-size:200% 100%;animation:sh 1.4s infinite;border-radius:12px;flex:1;display:block;margin-bottom:14px}
      .row{display:flex;gap:16px}
      .h16{height:16px}.h40{height:40px}.h48{height:48px}.h90{height:90px}.h110{height:110px}.h120{height:120px}.h200{height:200px}.h220{height:220px}.h260{height:260px}
      .w40{max-width:40%}.w50{max-width:50%}.w70{max-width:70%}
      @keyframes sh{0%{background-position:200% 0}100%{background-position:-200% 0}}
    </style></head><body>${blocks}</body></html>`;
  };
  // v3: one-click global retheme
  const [dnaCatalog, setDnaCatalog] = useState([]);
  const [showThemePopover, setShowThemePopover] = useState(false);
  const [retheming, setRetheming] = useState(false);
  const [themeDraft, setThemeDraft] = useState({ dnaId: null, headingFont: '', bodyFont: '', iconSet: null });
  const canvasItemsRef = useRef(canvasItems); // stable ref for postMessage handler

  useEffect(() => {
    // Load lazily on first popover open (needs auth token, defined later)
    if (!showThemePopover || dnaCatalog.length) return;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${API_URL}/api/agentic-ui/dna`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const d = await res.json();
        setDnaCatalog(d.dna || []);
      } catch { /* popover shows empty grid; retry on next open */ }
    })();
  }, [showThemePopover]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveResponsiveDropdownCardId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => {
      window.removeEventListener('click', handleGlobalClick);
    };
  }, []);

  // Keep ref in sync so the postMessage listener always sees fresh canvasItems
  useEffect(() => { canvasItemsRef.current = canvasItems; }, [canvasItems]);

  // Listen for runtime errors and inline text edits bubbled from iframes via postMessage
  useEffect(() => {
    const handleIframeMessage = (event) => {
      const type = event.data?.type;
      if (type !== 'iframe-render-error' && type !== 'v3-edit') return;
      // Match the source iframe to a canvas card by comparing contentWindow
      const items = canvasItemsRef.current;
      for (const card of items) {
        const el = document.querySelector(`#figma-target-${card.id} iframe`);
        if (el && el.contentWindow === event.source) {
          if (type === 'v3-edit') {
            applyInlineEdit(card.id, event.data);
          } else {
            setCardErrors(prev => ({ ...prev, [card.id]: event.data.error || 'Component render error' }));
          }
          return;
        }
      }
    };
    window.addEventListener('message', handleIframeMessage);
    return () => window.removeEventListener('message', handleIframeMessage);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Double-click text editing: the iframe already shows the new text — patch the
  // same element in the stored document (never re-serialize the live DOM, which
  // carries canvas-only mutations) and persist. initialHtml is left alone so the
  // iframe doesn't reload mid-edit.
  const applyInlineEdit = (cardId, edit) => {
    const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
    // Text elements may carry <br> line breaks (multi-line headlines) — mirror
    // the shell's editability rule when matching the source element.
    const textOnly = el => Array.from(el.children).every(k => k.tagName === 'BR');
    setCanvasItems(prev => prev.map(c => {
      if (c.id !== cardId || !c.html) return c;
      try {
        const doc = new DOMParser().parseFromString(c.html, 'text/html');
        const matches = Array.from(doc.body.querySelectorAll(edit.tag))
          .filter(el => textOnly(el) && norm(el.textContent) === norm(edit.origText));
        const target = matches[edit.matchIndex] || (matches.length === 1 ? matches[0] : null);
        if (!target) return c; // source diverged (e.g. Alpine-rendered text) — edit stays visual only
        if (edit.newHtml != null) {
          // Keep line breaks; strip anything that isn't a <br> (paste safety)
          target.innerHTML = String(edit.newHtml).replace(/<(?!br\s*\/?>)[^>]*>/gi, '');
        } else {
          target.textContent = edit.newText;
        }
        const html = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
        saveEditedHtml(c.dbId || c.id, html);
        return { ...c, html, initialHtml: c.initialHtml || c.html };
      } catch {
        return c;
      }
    }));
  };

  const saveEditedHtml = async (generationId, html) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/agentic-ui/update-html`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ generationId, html })
      });
    } catch { }
  };

  const getCardPlatform = (card) => {
    if (card.platform) return card.platform;
    if (card.width > 1100) return 'web';
    if (card.width > 600) return 'tablet';
    return 'ios';
  };

  const handleCardPlatformChange = (cardId, newPlatform) => {
    const deviceSize = DEVICE_SIZES[newPlatform] || DEVICE_SIZES.ios;
    const newWidth = deviceSize.width;
    const newHeight = deviceSize.height + 40;

    setCanvasItems(prev => prev.map(c => {
      if (c.id === cardId) {
        savePosition(cardId, c.x, c.y, newWidth, newHeight);
        return {
          ...c,
          platform: newPlatform,
          width: newWidth,
          height: newHeight
        };
      }
      return c;
    }));
    setActiveResponsiveDropdownCardId(null);
  };

  const handleIframeLoad = (e, cardId) => {
    const iframe = e.target;
    if (!iframe || !iframe.contentWindow) return;

    // Send the latest partial HTML body if the iframe finished loading the shell document
    const lastHtml = lastPartialHtmlRef.current[cardId];
    if (lastHtml) {
      const m = lastHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (m) {
        iframe.contentWindow.postMessage({ type: 'v3-body', html: m[1] }, '*');
      }
    }

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
      // Only auto-resize height for desktop web cards (bypass for tablet and mobile)
      const card = canvasItems.find(c => c.id === cardId);
      const platformLabel = card?.platform || card?.designBrief?.platform || card?.designBrief?.device || 'ios';
      if (platformLabel !== 'web') {
        return;
      }
      
      const body = doc.body;
      const html = doc.documentElement;
      
      // Calculate content height
      const contentHeight = Math.max(
        body ? body.scrollHeight : 0,
        body ? body.offsetHeight : 0,
        html ? html.clientHeight : 0,
        html ? html.scrollHeight : 0,
        html ? html.offsetHeight : 0
      );
      
      if (contentHeight > 100) {
        setCanvasItems(prev => prev.map(c => {
          if (c.id === cardId) {
            // Web cards behave like a monitor: at most 1080px tall.
            // Longer pages scroll inside the iframe (same as live preview),
            // so a bad height measurement can never blow the card up.
            const newHeight = Math.min(contentHeight, 1080) + 40; // 40px toolbar offset
            if (Math.abs(c.height - newHeight) > 5) { // offset tolerance of 5px
              savePosition(cardId, c.x, c.y, c.width, newHeight);
              return { ...c, height: newHeight };
            }
          }
          return c;
        }));
      }
    } catch (err) {
    }
  };

  const currentPalette = useCustomColors
    ? {
        background: customBg,
        surface: customPrimary,
        accent: customAccent,
        accent2: customAccent,
        textPrimary: (customBg.startsWith('#0') || customBg.startsWith('#1')) ? '#F5F5F7' : '#111827',
        theme: (customBg.startsWith('#0') || customBg.startsWith('#1')) ? 'dark' : 'light'
      }
    : selectedPalette || COLOR_PALETTES[0];

  const triggerComingSoonToast = (featureName) => {
    setComingSoonToast(featureName);
    setTimeout(() => {
      setComingSoonToast(null);
    }, 2500);
  };

  const [funnyPhraseIndex, setFunnyPhraseIndex] = useState(0);

  useEffect(() => {
    if (!loading) {
      setFunnyPhraseIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setFunnyPhraseIndex(prev => (prev + 1) % FUNNY_LOADING_PHRASES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    const unsubscribe = NavigationEvents.subscribe(NavigationEvents.VIEWS.NEW_CHAT, () => {
      setIsLandingView(true);
      setMessages([]);
      setCanvasItems([]);
      setCurrentSessionId(null);
      setSelectedCard(null);
      setInput('');
      setUploadedImage(null);
      setSessionImagePath(null);
      setSessionHasImage(false);
      setLoading(false);
      setDesignBrief(null);
    });
    return () => unsubscribe();
  }, []);
  // Persistence state
  const [savedSessions, setSavedSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const messagesRef = useRef(null);
  const iframeRef = useRef(null);
  const canvasRef = useRef(null);
  const transformRef = useRef(null);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages, loading, showDesignBrief]);

  const fetchQuota = useCallback(async (userObj = null) => {
    try {
      const user = userObj || auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/quota`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.error) setAgenticQuota(data);
    } catch (err) {
      console.error('Failed to fetch agentic quota:', err);
    }
  }, []);

  useEffect(() => {
    if (auth.currentUser) {
      fetchQuota(auth.currentUser);
    }
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchQuota(user);
      }
    });
    return () => unsubscribe();
  }, [fetchQuota]);

  // Landing Page Product Tour
  useEffect(() => {
    const hasSeenTour = localStorage.getItem('agentic_ui_tour_completed');
    if (!hasSeenTour) {
      setTimeout(() => {
        const driverObj = driver({
          showProgress: false,
          animate: true,
          smoothScroll: true,
          popoverClass: 'agentic-driver-theme',
          steps: [
            {
              element: '.agentic-premium-input-container',
              popover: {
                title: 'Start building here',
                description: 'Describe the UI you want to generate. Be as detailed or as simple as you like.',
                side: 'bottom',
                align: 'center'
              }
            }
          ],
          onDestroyStarted: () => {
            localStorage.setItem('agentic_ui_tour_completed', 'true');
            if (driverObj.hasNextStep()) {
              driverObj.destroy();
            } else {
              driverObj.destroy();
            }
          }
        });
        driverObj.drive();
      }, 800); // Wait for animations to settle
    }
  }, []);

  // Chat View Product Tour
  useEffect(() => {
    if (showDesignBrief) {
      const hasSeenChatTour = localStorage.getItem('agentic_ui_chat_tour_completed');
      if (!hasSeenChatTour) {
        setTimeout(() => {
          const driverObj = driver({
            showProgress: false,
            animate: true,
            smoothScroll: true,
            popoverClass: 'agentic-driver-theme',
            steps: [
              {
                element: '.agentic-design-brief-v2',
                popover: {
                  title: 'Customize your design',
                  description: 'Choose colors, typography, and icon styles to match your brand aesthetic.',
                  side: 'right',
                  align: 'start'
                }
              },
              {
                element: '.brief-platform-bar',
                popover: {
                  title: 'Select a platform',
                  description: 'Toggle between Web, iOS, and Tablet formats.',
                  side: 'top',
                  align: 'center'
                },
                onHighlightStarted: () => {
                  if (messagesRef.current) {
                    messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
                  }
                }
              },
              {
                element: '.agentic-input-area-new',
                popover: {
                  title: 'Refine your UI',
                  description: 'Send a message to the agent to generate new screens or modify existing ones.',
                  side: 'top',
                  align: 'center'
                },
                onHighlightStarted: () => {
                  if (messagesRef.current) {
                    messagesRef.current.scrollTo({ top: messagesRef.current.scrollHeight, behavior: 'smooth' });
                  }
                }
              }
            ],
            onDestroyStarted: () => {
              localStorage.setItem('agentic_ui_chat_tour_completed', 'true');
              if (driverObj.hasNextStep()) {
                driverObj.destroy();
              } else {
                driverObj.destroy();
              }
            }
          });
          driverObj.drive();
        }, 800); // Wait for the chat to render
      }
    }
  }, [showDesignBrief]);

  const getToken = async () => {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  };

  // Load saved sessions
  const loadSessions = async (user) => {
    const currentUser = user || auth.currentUser;
    if (!currentUser) {
      return;
    }
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.sessions) {
        setSavedSessions(data.sessions);
      }
    } catch (err) {
      console.error('[Error] loadSessions failed:', err.message);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        loadSessions(user);
      } else {
        setSavedSessions([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Refresh sessions when returning to landing view
  useEffect(() => {
    if (isLandingView && auth.currentUser) {
      loadSessions();
    }
  }, [isLandingView]);

  // Fetch available skills on mount
  useEffect(() => {
    const loadStyles = async () => {
      try {
        const res = await fetch(`${API_URL}/api/agentic-ui/styles`);
        const data = await res.json();
        if (data.styles) {
          setUiStyles(data.styles);
          setSelectedStyle(null);
        }
      } catch (err) {
      }
    };
    loadStyles();
  }, []);

  // Load a saved session into the canvas
  const loadSession = (session, existingToken = null) => {
    setIsLandingView(false);
    setSessionHasImage(false);
    setSessionImagePath(null);
    // Opening a saved session must NEVER re-trigger generation: clear any
    // leftover clarification/brief state so the next input is a fresh action.
    setPendingIntent(null);
    setShowDesignBrief(false);
    setStructuredQuestions(null);
    setQuestionAnswers({});
    setLoading(false);
    setLoadingStep('');
    const deviceSize = DEVICE_SIZES[session.designBrief?.device || platform] || DEVICE_SIZES.ios;
    const validScreens = (session.screens || [])
      .filter(Boolean)
      .filter(s => typeof s.html === 'string' && s.html.trim().length > 0);
    const items = validScreens.map((s, i) => ({
      id: s.id || `card-${Date.now()}-${i}`,
      html: s.html,
      initialHtml: s.html,
      reactCode: s.reactCode || null,
      title: s.title || `Screen ${i + 1}`,
      x: s.canvasX ?? 60 + i * (deviceSize.width + 60),
      y: s.canvasY ?? 60,
      width: s.canvasWidth ?? deviceSize.width,
      height: s.canvasHeight ?? deviceSize.height + 40,
      platform: s.platform || (s.canvasWidth > 1100 ? 'web' : s.canvasWidth > 600 ? 'tablet' : 'ios'),
      prompt: s.prompt,
      createdAt: new Date(s.createdAt).getTime(),
      dbId: s.id  // database ID for position updates
    }));
    setCanvasItems(items);
    setCurrentSessionId(session.sessionId);
    if (session.designBrief) setDesignBrief(session.designBrief);

    // Restore chat messages from session brief or construct fallback history from prompt
    if (session.designBrief?.messages) {
      setMessages(session.designBrief.messages);
    } else if (session.screens?.[0]?.designBrief?.messages) {
      setMessages(session.screens[0].designBrief.messages);
    } else {
      const firstPrompt = session.screens?.[0]?.prompt || session.prompt || '';
      if (firstPrompt) {
        setMessages([
          { role: 'user', content: firstPrompt },
          { role: 'assistant', content: `Loaded saved generation session containing ${items.length} screen(s).` }
        ]);
      } else {
        setMessages([]);
      }
    }

    if (items.length > 0) {
      setCurrentHTML(items[0].html);
      setSelectedCard(items[0].id);
      
      // Auto-focus and zoom viewport to the first loaded screen card so it is directly visible
      setTimeout(() => {
        if (transformRef.current && items[0]) {
          transformRef.current.zoomToElement(items[0].id, 0.8, 500);
        }
      }, 200);
    }
  };

  // Helper to get next grid position (3 columns)
  const getNextGridPosition = (items = canvasItems) => {
    const deviceSize = DEVICE_SIZES[designBrief?.device || platform] || DEVICE_SIZES.ios;
    const spacingX = 60;
    const spacingY = 100;
    const colCount = 3;
    const index = items.length;
    const col = index % colCount;
    const row = Math.floor(index / colCount);

    // Base x/y (starting at 60,60)
    const x = 60 + col * (deviceSize.width + spacingX);
    const y = 60 + row * (deviceSize.height + 120); // 120 accounts for card header/footer
    return { x, y };
  };

  const scrollPalettes = (direction) => {
    if (paletteStripRef.current) {
      const scrollAmount = direction === 'left' ? -180 : 180;
      paletteStripRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Save a screen to Supabase (non-blocking)
  const saveScreen = async (screenData) => {
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(screenData)
      });
      const data = await res.json();
      if (data.sessionId && !currentSessionId) {
        setCurrentSessionId(data.sessionId);
      }
      return data;
    } catch (err) {
      console.warn('Failed to save screen:', err.message);
      return null;
    }
  };

  // Save position to DB on drag (debounced)
  const savePosition = async (cardId, x, y, width, height) => {
    try {
      const token = await getToken();
      await fetch(`${API_URL}/api/agentic-ui/update-position`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ generationId: cardId, canvasX: x, canvasY: y, canvasWidth: width, canvasHeight: height })
      });
    } catch { }
  };

  const addMessage = (role, content, image = null) => {
    setMessages(prev => [...prev, { role, content, image, ts: Date.now() }]);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Only image files are allowed!');
      return;
    }

    setIsUploading(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_URL}/api/agentic-ui/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const data = await res.json();
      if (data.success) {
        setUploadedImage({
          url: `${API_URL}${data.url}`,
          path: data.path
        });
      } else {
        alert(data.message || 'Failed to upload image.');
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Error uploading image: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSkillChange = (styleId) => {
    setSelectedStyle(styleId);
    if (!styleId) return;
    const styleObj = uiStyles.find(s => s.id === styleId);
    if (styleObj) {
      if (styleObj.font) {
        setHeadingFont(styleObj.font);
        setBodyFont(styleObj.font);
      }
    }
  };

  const skillThumbStyle = (skill) => {
    if (!skill) return {};
    if (skill.thumbnail?.startsWith('gradient:'))
      return { background: skill.thumbnail.replace('gradient:', '') };
    if (skill.thumbnail)
      return { backgroundImage: `url(${skill.thumbnail})`, backgroundSize: 'cover', backgroundPosition: 'center top' };
    return { background: skill.accentColor || '#1A1A1A' };
  };

  const handleRemoveImage = () => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handlePlusClick = (e) => {
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleGenerate = async (prompt, isFollowUp = false, previousCtx = '') => {
    if (!prompt.trim() || loading) return;
    setIsLandingView(false);

    if (!paletteLocked) {
      suggestPalette(prompt);
    }

    const currentUploadedPath = uploadedImage?.path;
    const currentUploadedUrl = uploadedImage?.url;

    let newRequestId = requestId;
    if (!isFollowUp) {
      if (currentUploadedUrl) {
        setSessionHasImage(true);
        setSessionImagePath(currentUploadedPath || null);
      } else {
        setSessionHasImage(false);
        setSessionImagePath(null);
        setCachedScan(null);
      }
      newRequestId = 'req-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      setRequestId(newRequestId);
      setOriginalPrompt(prompt);
      setClarificationAnswer('');
    }

    // Determine or generate the session ID for this generation cycle
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
      setCurrentSessionId(activeSessionId);
    }

    addMessage('user', prompt, currentUploadedUrl);
    setInput('');
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    setLoading(true);
    setLoadingStep(isFollowUp ? 'Extracting your vision...' : 'Understanding your request...');

    try {
      const token = await getToken();
      // Always use the SSE endpoint so the live build (skeleton → streamed
      // HTML) works even when the prompt bypasses clarification.
      const res = await fetch(`${API_URL}/api/agentic-ui/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          prompt,
          platform,
          theme: selectedPalette?.theme || null,
          isFollowUp,
          previousContext: previousCtx,
          uploadedImagePath: currentUploadedPath,
          preScannedDesign: cachedScan || undefined,
          visualAssetMode,
          useReasoner: thinkingMode,
          requestId: isFollowUp ? requestId : newRequestId,
          generationOutputMode: 'preview-component'
        })
      });

      genCardsRef.current = {};
      lastPartialHtmlRef.current = {};
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === 'clarification') {
              setPendingIntent(data.intent);
              if (Array.isArray(data.intent?.structuredQuestions) && data.intent.structuredQuestions.length) {
                setStructuredQuestions(data.intent.structuredQuestions);
                setQuestionIdx(0);
                setQuestionAnswers({});
              }
              if (data.intent?.platform) setPlatform(data.intent.platform);
              if (data.preScannedDesign) setCachedScan(data.preScannedDesign);
              if (!isFollowUp) setOriginalPrompt(prompt);
              if (data.intent?.suggestedPalette && !paletteLocked) {
                setAiPalette(data.intent.suggestedPalette);
                setPaletteSource('ai');
                setSelectedPalette(data.intent.suggestedPalette);
                setIsThinkingPalette(false);
              }
              if (data.scanWarning) addMessage('assistant', `[Warning] ${data.scanWarning}`);
              addMessage('assistant', data.question);
              setShowDesignBrief(true);
            } else if (data.event === 'status') {
              setLoadingStep(data.step);
            } else if (data.event === 'screen_start') {
              setScreens(prev => [...prev, { html: null, title: data.title, loading: true }]);
              setLiveBuilding(true);
              const idx = data.index ?? 0;
              if (!genCardsRef.current[idx]) {
                const deviceSize = DEVICE_SIZES[platform] || DEVICE_SIZES.ios;
                const phId = `gen-live-${Date.now()}-${idx}`;
                genCardsRef.current[idx] = phId;
                setCanvasItems(prev => [...prev, {
                  id: phId,
                  html: buildSkeletonDoc(platform),
                  building: true,
                  reactCode: null,
                  title: data.title || `Screen ${idx + 1}`,
                  x: 60 + idx * (deviceSize.width + 60),
                  y: 60,
                  width: deviceSize.width,
                  height: deviceSize.height + 40,
                  platform,
                  createdAt: Date.now()
                }]);
              }
            } else if (data.event === 'screen_partial') {
              applyScreenPartial(data.index ?? 0, data.html);
            } else if (data.event === 'screen_done') {
              if (typeof data.html !== 'string' || !data.html.trim()) continue;
              const idx = data.index ?? 0;
              setScreens(prev => {
                const next = [...prev];
                while (next.length <= idx) next.push(null);
                next[idx] = { html: data.html, reactCode: null, title: data.title || `Screen ${idx + 1}`, index: idx, loading: false };
                return next;
              });
              const deviceSize = DEVICE_SIZES[platform] || DEVICE_SIZES.ios;
              const liveCardId = genCardsRef.current[idx];
              const newCard = {
                id: liveCardId || `card-${Date.now()}-${idx}`,
                html: data.html,
                initialHtml: data.html,
                reactCode: null,
                title: data.title || `Screen ${idx + 1}`,
                x: 60 + idx * (deviceSize.width + 60),
                y: 60,
                width: deviceSize.width,
                height: platform === 'web' ? getCalculatedPageHeight(data.html, deviceSize.height) : deviceSize.height + 40,
                platform,
                prompt,
                createdAt: Date.now()
              };
              if (liveCardId) {
                delete lastPartialHtmlRef.current[liveCardId];
                setCanvasItems(prev => prev.map(c => c.id === liveCardId ? { ...c, ...newCard, building: false } : c));
              } else {
                setCanvasItems(prev => [...prev, { ...newCard, initialHtml: newCard.html }]);
              }
              setSelectedCard(newCard.id);
              if (!currentHTML) { setCurrentHTML(data.html); setActiveScreen(idx); }
              saveScreen({
                prompt,
                platform,
                theme: selectedPalette?.theme || 'light',
                screenType: data.title,
                html: data.html,
                reactCode: null,
                title: data.title,
                designBrief: { prompt, platform, theme: selectedPalette?.theme || 'light' },
                canvasX: newCard.x, canvasY: newCard.y,
                canvasWidth: newCard.width, canvasHeight: newCard.height,
                sessionId: activeSessionId || undefined
              }).then(saved => {
                if (saved?.id) {
                  setCanvasItems(prev => prev.map(c => c.id === newCard.id ? { ...c, id: saved.id, dbId: saved.id, renderKey: c.renderKey || c.id } : c));
                  setSelectedCard(prev => prev === newCard.id ? saved.id : prev);
                  if (saved.sessionId) setCurrentSessionId(saved.sessionId);
                }
              }).catch(() => {});
            } else if (data.event === 'complete') {
              setUploadedImage(null);
              setDesignBrief(data.designBrief);
              if (data.designBrief?.dnaId) setSelectedDnaId(data.designBrief.dnaId);
              setReferences(data.references || []);
              setPendingIntent(null);
              setShowDesignBrief(false);
              setCachedScan(null);
              const failCount = (data.requestedScreenCount || 0) - (data.successfulScreenCount ?? 0);
              if (failCount > 0) addMessage('assistant', `${failCount} screen(s) failed to generate — you can retry them individually.`);
              fetchQuota();
            } else if (data.event === 'screen_error') {
              addMessage('assistant', `Screen ${(data?.index ?? 0) + 1} failed because it returned no valid preview.`);
            } else if (data.event === 'error') {
              if (data.code === 'generation_limit_reached') {
                if (data.quota) setAgenticQuota(data.quota);
                addMessage('assistant', `__QUOTA_REACHED__${data.message}`);
                setShowPricingModal(true);
              } else {
                addMessage('assistant', `Generation failed: ${data.message}`);
              }
            }
          } catch { }
        }
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
      setLiveBuilding(false);
      genCardsRef.current = {};
      lastPartialHtmlRef.current = {};
    }
  };

  const finishGeneration = (data, promptOverride, activeSessionId) => {
    const usedPrompt = promptOverride || originalPrompt || data.designBrief?.prompt || '';
    setPendingIntent(null);
    setOriginalPrompt('');
    setShowDesignBrief(false);
    setCachedScan(null);

    const responseScreens = Array.isArray(data.screens) ? data.screens : [];
    const fallbackScreen = typeof data.html === 'string' && data.html.trim()
      ? [{ html: data.html, reactCode: data.reactCode || null, title: 'Screen 1', index: 0 }]
      : [];

    const allScreens = [...responseScreens, ...fallbackScreen]
      .filter(Boolean)
      .filter(screen => typeof screen.html === 'string' && screen.html.trim().length > 0);

    if (allScreens.length === 0) {
      addMessage('assistant', 'Generation finished, but no valid screens were returned. Please try again.');
      setScreens([]);
      setCurrentHTML(null);
      setActiveScreen(0);
      return;
    }

    setScreens(allScreens);
    setActiveScreen(0);
    setCurrentHTML(allScreens[0]?.html || null);
    setDesignBrief(data.designBrief);
    setReferences(data.references || []);
    const refNames = (data.references || []).map(r => r.name).filter(Boolean).join(', ');

    // Add screens to canvas as cards in a grid
    const deviceSize = DEVICE_SIZES[data.designBrief?.device || platform] || DEVICE_SIZES.ios;
    const newItems = allScreens.map((s, i) => {
      const pos = getNextGridPosition([...canvasItems, ...allScreens.slice(0, i).map(() => ({}))]); // offset by existing items + current batch
      return {
        id: `card-${Date.now()}-${i}`,
        html: s.html,
        reactCode: s.reactCode || null,
        title: s.title || `Screen ${i + 1}`,
        x: pos.x,
        y: pos.y,
        width: deviceSize.width,
        height: (data.designBrief?.device || platform) === 'web' ? getCalculatedPageHeight(s.html, deviceSize.height) : deviceSize.height + 40,
        prompt: usedPrompt,
        createdAt: Date.now(),
      };
    });
    setCanvasItems(prev => [...prev, ...newItems]);
    setSelectedCard(newItems[0]?.id);

    // Save screens to Supabase
    allScreens.forEach((s, i) => {
      const newCardItem = newItems[i];
      if (!newCardItem) {
        console.warn(`Missing canvas item for screen ${i}`);
        return;
      }
      
      const sessionTextMsg = `Here's your ${data.designBrief?.theme} ${data.designBrief?.platform} screen${allScreens.length > 1 ? `s (${allScreens.length})` : ''}${refNames ? `. Inspired by ${refNames}` : ''}. Tell me what to change.`;
      const savedMessages = [
        ...messages,
        { role: 'user', content: usedPrompt },
        { role: 'assistant', content: sessionTextMsg }
      ];

      saveScreen({
        prompt: usedPrompt,
        platform: data.designBrief?.platform || platform,
        theme: data.designBrief?.theme || 'dark',
        screenType: s.title,
        html: s.html,
        reactCode: s.reactCode || null,
        title: s.title,
        designBrief: {
          ...data.designBrief,
          messages: savedMessages
        },
        canvasX: newCardItem.x,
        canvasY: newCardItem.y,
        canvasWidth: newCardItem.width,
        canvasHeight: newCardItem.height,
        sessionId: activeSessionId || currentSessionId || undefined
      }).then(saved => {
        if (saved?.id) {
          setCanvasItems(prev => prev.map(c => c.id === newCardItem.id ? { ...c, id: saved.id, dbId: saved.id, renderKey: c.renderKey || c.id } : c));
          setSelectedCard(prev => prev === newCardItem.id ? saved.id : prev);
          if (saved.sessionId) setCurrentSessionId(saved.sessionId);
        }
      });
    });

    addMessage('assistant', `Here's your ${data.designBrief?.theme} ${data.designBrief?.platform} screen${allScreens.length > 1 ? `s (${allScreens.length})` : ''}${refNames ? `. Inspired by ${refNames}` : ''}. Tell me what to change.`);
  };

  // SSE-based generation with design choices
  const handleGenerateWithBrief = async (overridePrompt, isClarification = false) => {
    setShowDesignBrief(false);
    setStructuredQuestions(null);
    setLoading(true);
    setLoadingStep('Generating screens...');

    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    const customIsDark = customBg.startsWith('#0') || customBg.startsWith('#1');
    const palette = useCustomColors
      ? { background: customBg, surface: customPrimary, primary: customPrimary, accent: customAccent, accent2: customAccent, textPrimary: customIsDark ? '#F5F5F7' : '#111827', theme: customIsDark ? 'dark' : 'light' }
      : selectedPalette;

    const designChoices = {
      palette: palette || undefined,
      headingFont: fontsCustomized ? headingFont : undefined,
      bodyFont: fontsCustomized ? bodyFont : undefined,
      iconStyle,
      designStyle: selectedStyle || undefined,
      dnaId: selectedDnaId || undefined
    };

    const finalPrompt = isClarification ? overridePrompt : (originalPrompt || overridePrompt);

    // Generate or locate the session ID for this generation cycle
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 11);
      setCurrentSessionId(activeSessionId);
    }

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/generate-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          prompt: finalPrompt,
          platform: pendingIntent?.platform || platform,
          theme: palette?.theme || null,
          isFollowUp: isClarification,
          previousContext: isClarification ? originalPrompt : '',
          designChoices,
          uploadedImagePath: sessionImagePath,
          preScannedDesign: cachedScan || undefined,
          visualAssetMode,
          useReasoner: thinkingMode,
          requestId: requestId,
          generationOutputMode: 'preview-component'
        })
      });

      genCardsRef.current = {};
      lastPartialHtmlRef.current = {};
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.event === 'status') {
              setLoadingStep(data.step);
            } else if (data.event === 'screen_start') {
              setScreens(prev => [...prev, { html: null, title: data.title, loading: true }]);
              // Live build: drop a placeholder frame on the canvas right away
              setLiveBuilding(true);
              const idx = data.index ?? 0;
              if (!genCardsRef.current[idx]) {
                const deviceSize = DEVICE_SIZES[pendingIntent?.platform || platform] || DEVICE_SIZES.ios;
                const phId = `gen-live-${Date.now()}-${idx}`;
                genCardsRef.current[idx] = phId;
                setCanvasItems(prev => [...prev, {
                  id: phId,
                  html: buildSkeletonDoc(pendingIntent?.platform || platform),
                  building: true,
                  reactCode: null,
                  title: data.title || `Screen ${idx + 1}`,
                  x: 60 + idx * (deviceSize.width + 60),
                  y: 60,
                  width: deviceSize.width,
                  height: deviceSize.height + 40,
                  platform: pendingIntent?.platform || platform,
                  createdAt: Date.now()
                }]);
              }
            } else if (data.event === 'screen_partial') {
              applyScreenPartial(data.index ?? 0, data.html);
            } else if (data.event === 'screen_done') {
              if (!data || typeof data.html !== 'string' || !data.html.trim()) {
                console.warn('Ignoring invalid screen_done event:', data);
                addMessage('assistant', `Screen ${(data?.index ?? 0) + 1} failed because it returned no valid preview.`);
                return;
              }

              setScreens(prev => {
                const next = [...prev];
                const index = Number.isInteger(data.index) ? data.index : next.length;
                while (next.length <= index) {
                  next.push(null);
                }
                next[index] = {
                  html: data.html,
                  reactCode: data.reactCode || null,
                  title: data.title || `Screen ${index + 1}`,
                  index,
                  loading: false
                };
                return next;
              });

              // Add to canvas as a draggable card (or finalize the live-build placeholder)
              const deviceSize = DEVICE_SIZES[pendingIntent?.platform || platform] || DEVICE_SIZES.ios;
              const liveCardId = genCardsRef.current[data.index ?? 0];
              const newCard = {
                id: liveCardId || `card-${Date.now()}-${data.index ?? 0}`,
                html: data.html,
                initialHtml: data.html,
                reactCode: typeof data.reactCode === 'string' ? data.reactCode : null,
                title: data.title || `Screen ${(data.index ?? 0) + 1}`,
                x: 60 + (data.index ?? 0) * (deviceSize.width + 60),
                y: 60,
                width: deviceSize.width,
                height: (pendingIntent?.platform || platform) === 'web' ? getCalculatedPageHeight(data.html, deviceSize.height) : deviceSize.height + 40,
                platform: pendingIntent?.platform || platform,
                prompt: originalPrompt,
                createdAt: Date.now(),
              };
              if (liveCardId) {
                delete lastPartialHtmlRef.current[liveCardId];
                setCanvasItems(prev => prev.map(c => c.id === liveCardId ? { ...c, ...newCard, building: false } : c));
              } else {
                setCanvasItems(prev => [...prev, newCard]);
              }
              setSelectedCard(newCard.id);

              const savedMessages = [
                ...messages,
                { role: 'user', content: finalPrompt },
                { role: 'assistant', content: `Generated "${data.title || 'screen'}".` }
              ];

              // Save to Supabase (fire-and-forget)
              saveScreen({
                prompt: originalPrompt || finalPrompt,
                platform,
                theme: palette?.theme || 'dark',
                screenType: data.title,
                html: data.html,
                reactCode: data.reactCode || null,
                title: data.title,
                designBrief: {
                  prompt: finalPrompt,
                  platform: pendingIntent?.platform || platform,
                  theme: palette?.theme || 'dark',
                  palette: palette || undefined,
                  headingFont,
                  bodyFont,
                  iconStyle,
                  designStyle: selectedStyle || undefined,
                  messages: savedMessages
                },
                canvasX: newCard.x,
                canvasY: newCard.y,
                canvasWidth: newCard.width,
                canvasHeight: newCard.height,
                sessionId: activeSessionId || currentSessionId || undefined
              }).then(saved => {
                if (saved?.id) {
                  // Update card ID to DB ID for position tracking
                  setCanvasItems(prev => prev.map(c => c.id === newCard.id ? { ...c, id: saved.id, dbId: saved.id, renderKey: c.renderKey || c.id } : c));
                  setSelectedCard(prev => prev === newCard.id ? saved.id : prev);
                  if (saved.sessionId) setCurrentSessionId(saved.sessionId);
                }
              });
              // Show first completed screen
              if (!currentHTML) {
                setCurrentHTML(data.html);
                setActiveScreen(data.index);
              }

              // Auto-pan to the newly generated screen
              setTimeout(() => {
                if (transformRef.current) {
                  transformRef.current.zoomToElement(newCard.id, 1, 400); // ElementId, Scale, AnimationDuration
                }
              }, 100);
            } else if (data.event === 'screen_error') {
              addMessage('assistant', `Screen ${(data?.index ?? 0) + 1} failed because it returned no valid preview.`);
            } else if (data.event === 'complete') {
              setUploadedImage(null);
              setDesignBrief(data.designBrief);
              // Session design memory: later add-screen/generations stay on this DNA
              if (data.designBrief?.dnaId) setSelectedDnaId(data.designBrief.dnaId);
              setReferences(data.references || []);
              setPendingIntent(null);
              setOriginalPrompt('');
              setShowDesignBrief(false);
              setCachedScan(null);
              // Screens on the canvas ARE the completion signal — no chat message needed
              const failCount = (data.requestedScreenCount || 0) - (data.successfulScreenCount ?? 0);
              if (failCount > 0) {
                addMessage('assistant', `${failCount} screen(s) failed to generate — you can retry them individually.`);
              }
            } else if (data.event === 'error') {
              if (data.code === 'generation_limit_reached') {
                if (data.quota) setAgenticQuota(data.quota);
                addMessage('assistant', `__QUOTA_REACHED__${data.message}`);
              } else {
                const stageContext = data.stage ? `during ${data.stage.replace('-', ' ')}` : '';
                addMessage('assistant', `Generation failed ${stageContext}: ${data.message}`);
              }
            }
          } catch { }
        }
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
      setLiveBuilding(false);
      genCardsRef.current = {};
      lastPartialHtmlRef.current = {};
      fetchQuota();
    }
  };

  const handleIterate = async (instruction) => {
    if (!instruction.trim() || loading || !currentHTML) return;

    const currentUploadedUrl = uploadedImage?.url;
    addMessage('user', instruction, currentUploadedUrl);
    setInput('');
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLoading(true);
    setLoadingStep('Modifying your screen...');

    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/iterate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentHTML, instruction, designBrief, useReasoner: thinkingMode })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCurrentHTML(data.html);
        // Update the canvas card that is currently selected
        if (selectedCard) {
          setCanvasItems(prev => prev.map(c => c.id === selectedCard ? { ...c, html: data.html, reactCode: data.reactCode || null } : c));
        } else {
          // No card selected — update the first card as fallback
          setCanvasItems(prev => {
            if (prev.length === 0) return prev;
            const updated = [...prev];
            updated[0] = { ...updated[0], html: data.html, reactCode: data.reactCode || null };
            return updated;
          });
        }
        addMessage('assistant', 'Updated. Check the preview.');
      } else {
        addMessage('assistant', `Error: ${data.error}`);
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  // Add a NEW screen to the canvas with the same design system
  const handleAddScreen = async (description) => {
    if (!description.trim() || loading) return;

    const currentUploadedUrl = uploadedImage?.url;
    addMessage('user', description, currentUploadedUrl);
    setInput('');
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setLoading(true);
    // Parse platform from prompt if explicitly requested, else use current platform state, else fallback to designBrief device
    let resolvedPlatform = null;
    const descLower = description.toLowerCase();
    if (descLower.includes('ios') || descLower.includes('iphone') || descLower.includes('mobile') || descLower.includes('phone') || descLower.includes('android')) {
      resolvedPlatform = 'ios';
    } else if (descLower.includes('tablet') || descLower.includes('ipad')) {
      resolvedPlatform = 'tablet';
    } else if (descLower.includes('web') || descLower.includes('desktop') || descLower.includes('website') || descLower.includes('computer')) {
      resolvedPlatform = 'web';
    } else {
      resolvedPlatform = platform || designBrief?.device || 'ios';
    }

    try {
      const token = await getToken();
      const deviceSize = DEVICE_SIZES[resolvedPlatform] || DEVICE_SIZES.ios;

      const res = await fetch(`${API_URL}/api/agentic-ui/add-screen`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          screenDescription: description,
          designBrief,
          existingHTML: currentHTML,
          platformOverride: resolvedPlatform,
          useReasoner: thinkingMode
        })
      });
      const data = await res.json();

      if (data.status === 'success') {
        // Add as a new canvas card, positioned next to existing cards
        const newCard = {
          id: `card-${Date.now()}`,
          html: data.html,
          reactCode: data.reactCode || null,
          title: data.title || description,
          x: 60 + canvasItems.length * (deviceSize.width + 60),
          y: 60,
          width: deviceSize.width,
          height: resolvedPlatform === 'web' ? getCalculatedPageHeight(data.html, deviceSize.height) : deviceSize.height + 40,
          platform: resolvedPlatform,
          prompt: description,
          createdAt: Date.now(),
        };
        setCanvasItems(prev => [...prev, newCard]);
        setSelectedCard(newCard.id);
        setCurrentHTML(data.html);
        addMessage('assistant', `Added "${data.title || description}" screen. ${data.meta?.duration ? `(${Math.round(data.meta.duration / 1000)}s)` : ''}`);
        // Save to Supabase
        saveScreen({
          prompt: description, platform: resolvedPlatform, theme: designBrief?.theme || 'dark',
          screenType: data.title || description, html: data.html, reactCode: data.reactCode || null, title: data.title || description,
          designBrief, canvasX: newCard.x, canvasY: newCard.y,
          canvasWidth: newCard.width, canvasHeight: newCard.height,
          sessionId: currentSessionId || undefined
        }).then(saved => {
          if (saved?.id) {
            setCanvasItems(prev => prev.map(c => c.id === newCard.id ? { ...c, id: saved.id, dbId: saved.id, renderKey: c.renderKey || c.id } : c));
            setSelectedCard(prev => prev === newCard.id ? saved.id : prev);
          }
        });
      } else {
        addMessage('assistant', `Error: ${data.error}`);
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleSubmit = () => {
    const text = input.trim();
    if (!text && !uploadedImage) return;

    const userRole = user?.role || effectiveQuota?.plan || 'free';
    const isFreeOrTrial = userRole === 'trial' || userRole === 'free';
    const hasRemaining = effectiveQuota?.isUnlimited || (effectiveQuota && (typeof effectiveQuota.remaining === 'number' ? effectiveQuota.remaining > 0 : (effectiveQuota.limit - (effectiveQuota.used || 0)) > 0));
    
    if (isFreeOrTrial && !hasRemaining) {
      setShowPricingModal(true);
      return;
    }

    if (uploadedImage) {
      // If a NEW image is uploaded, we MUST run a full new generation cycle to scan it
      handleGenerate(text || 'Extract layout and style from this screenshot and build a matching UI screen');
    } else if (pendingIntent || showDesignBrief) {
      // User answered clarification — auto-generate with their design brief picks
      const answer = text || 'Proceed with design choices';
      addMessage('user', answer, uploadedImage?.url);
      setInput('');
      const isClarification = Boolean(pendingIntent);
      if (isClarification) {
        setClarificationAnswer(answer);
      }
      setPendingIntent(null);
      // Auto-trigger generation with design choices
      setTimeout(() => handleGenerateWithBrief(answer, isClarification), 50);
    } else if (currentHTML && canvasItems.length > 0) {
      // Existing screens on canvas and NO new image — add a new screen with same design
      handleAddScreen(text || 'Create another screen matching this design');
    } else {
      handleGenerate(text || 'Extract layout and style from this screenshot and build a matching UI screen');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── v3: structured question dock ─────────────────────────────────────────
  const toggleQuestionAnswer = (q, opt) => {
    setQuestionAnswers(prev => {
      const cur = prev[q.id] || [];
      if (q.type === 'multi') {
        const next = cur.includes(opt.label) ? cur.filter(l => l !== opt.label) : [...cur, opt.label];
        return { ...prev, [q.id]: next };
      }
      return { ...prev, [q.id]: [opt.label] };
    });
    if (q.id === 'style') setSelectedDnaId(opt.dnaId || null);
    if (q.id === 'fonts') {
      if (opt.headingFont) {
        setHeadingFont(opt.headingFont);
        setBodyFont(opt.bodyFont || opt.headingFont);
        setFontsCustomized(true);
      } else {
        setFontsCustomized(false); // "AI decides" — let the DNA's pairing win
      }
    }
  };

  const finishQuestionDock = (skipped = false) => {
    const qs = structuredQuestions || [];
    const parts = [];
    for (const q of qs) {
      const ans = (questionAnswers[q.id] || []).filter(l => l !== 'AI decides');
      if (ans.length) parts.push(`${q.question} ${ans.join(', ')}.`);
    }
    const answerText = parts.length ? parts.join(' ') : 'Proceed — you decide the details.';
    setStructuredQuestions(null);
    setQuestionIdx(0);
    if (skipped && !parts.length) setSelectedDnaId(null);
    addMessage('user', skipped ? 'Skipped — you decide.' : answerText);
    setClarificationAnswer(answerText);
    setPendingIntent(null);
    setTimeout(() => handleGenerateWithBrief(answerText, true), 50);
  };

  // ── v3: download the whole project's code as one ZIP ────────────────────
  const [zippingCode, setZippingCode] = useState(false);
  const handleDownloadCodeZip = async () => {
    const cards = canvasItems.filter(c => typeof c.html === 'string' && c.html.trim());
    if (!cards.length || zippingCode) return;
    setZippingCode(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const product = (designBrief?.productName || 'inspoai-screens')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'inspoai-screens';
      const folder = zip.folder(product);
      const used = new Set();
      cards.forEach((c, i) => {
        let name = (c.title || `screen-${i + 1}`).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `screen-${i + 1}`;
        while (used.has(name)) name += `-${i + 1}`;
        used.add(name);
        folder.file(`${String(i + 1).padStart(2, '0')}-${name}.html`, c.html);
      });
      folder.file('README.md', `# ${designBrief?.productName || 'InspoAI screens'}\n\nGenerated with InspoAI Agentic UI.\n\nEach file is a self-contained HTML screen (Tailwind CDN + Alpine.js + Chart.js via CDN) — open directly in a browser, no build step required.\n\n| File | Screen |\n|---|---|\n${cards.map((c, i) => `| ${String(i + 1).padStart(2, '0')}-*.html | ${c.title || `Screen ${i + 1}`} |`).join('\n')}\n`);
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${product}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addMessage('assistant', `Code download failed: ${err.message}`);
    } finally {
      setZippingCode(false);
    }
  };

  // ── v3: one-click global retheme (no regeneration, ~ms fast) ────────────
  const handleRetheme = async (overrides) => {
    const targets = canvasItems.filter(c => typeof c.html === 'string' && c.html.includes('inspoai-v3'));
    if (!targets.length) {
      addMessage('assistant', 'Restyle works on screens generated by the new engine — generate a screen first.');
      return;
    }
    setRetheming(true);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/retheme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          screens: targets.map((c, i) => ({ index: i, html: c.html })),
          overrides
        })
      });
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.error || 'Retheme failed');
      const byIdx = new Map(data.screens.map(s => [s.index, s.html]));
      let i = 0;
      const idToNewHtml = new Map();
      for (const c of targets) { idToNewHtml.set(c.id, byIdx.get(i)); i++; }
      // Updating initialHtml swaps the iframe srcDoc — one clean reload per
      // screen with the new head, so every screen rethemes deterministically
      // (postMessage into live iframes could silently miss cards mid-load).
      setCanvasItems(prev => prev.map(c => idToNewHtml.has(c.id) && idToNewHtml.get(c.id)
        ? { ...c, html: idToNewHtml.get(c.id), initialHtml: idToNewHtml.get(c.id) }
        : c));

      setScreens(prev => prev.map((s, idx) => {
        const match = targets.findIndex(t => t.html === s.html);
        return match >= 0 ? { ...s, html: byIdx.get(match) || s.html } : s;
      }));
      if (currentHTML && idToNewHtml.size) {
        const first = targets.find(t => t.html === currentHTML);
        if (first) setCurrentHTML(idToNewHtml.get(first.id) || currentHTML);
      }
      setShowThemePopover(false);
      // Session design memory: future screens follow the rethemed DNA
      if (overrides.dnaId) {
        setSelectedDnaId(overrides.dnaId);
        setDesignBrief(prev => (prev ? { ...prev, dnaId: overrides.dnaId } : prev));
      }
      addMessage('assistant', `Restyled ${data.rethemedCount} screen(s) in ${data.durationMs}ms — no regeneration needed.`);
    } catch (err) {
      addMessage('assistant', `Restyle failed: ${err.message}`);
    } finally {
      setRetheming(false);
    }
  };

  const copyHTML = () => {
    if (currentHTML) {
      const match = currentHTML.match(/\/\/ LLM Generated Component Code:\s*([\s\S]*?)\s*\/\/ Dynamic Mount Execution/);
      const codeToCopy = match ? match[1].trim() : currentHTML;
      navigator.clipboard.writeText(codeToCopy);
      addMessage('assistant', match ? 'React JSX component code copied to clipboard!' : 'HTML copied.');
    }
  };

  const openFullScreen = () => {
    if (currentHTML) {
      const blob = new Blob([currentHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const downloadHTML = () => {
    if (currentHTML) {
      const blob = new Blob([currentHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentic-ui-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const startNew = () => {
    setMessages([]);
    setCurrentHTML(null);
    setScreens([]);
    setActiveScreen(0);
    setDesignBrief(null);
    setReferences([]);
    setPendingIntent(null);
    setShowDesignBrief(false);
    setSelectedPalette(null);
    setOriginalPrompt('');
    setStructuredQuestions(null);
    setQuestionAnswers({});
    setSelectedDnaId(null);
    // Don't clear canvas — user keeps previous cards
  };

  const clearCanvas = () => {
    setCanvasItems([]);
    setSelectedCard(null);
  };

  const getSelectedCardData = () => canvasItems.find(c => c.id === selectedCard);

  const copySelectedHTML = (cardId = null) => {
    const targetId = cardId || selectedCard;
    const card = canvasItems.find(c => c.id === targetId);
    if (card) {
      const match = card.html.match(/\/\/ LLM Generated Component Code:\s*([\s\S]*?)\s*\/\/ Dynamic Mount Execution/);
      const codeToCopy = match ? match[1].trim() : card.html;
      navigator.clipboard.writeText(codeToCopy);
      addMessage('assistant', match ? 'React JSX component code copied to clipboard!' : 'HTML copied.');
    }
  };

  const openSelectedFullScreen = (cardId = null) => {
    const targetId = cardId || selectedCard;
    const card = canvasItems.find(c => c.id === targetId);
    if (card) {
      const escapedHtml = JSON.stringify(card.html).replace(/</g, '\\u003c');
      
      const wrapperHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview: ${card.title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #F5F5F7;
      --control-bg: rgba(255, 255, 255, 0.9);
      --border: rgba(0, 0, 0, 0.08);
      --text: #1D1D1F;
      --text-muted: #86868B;
      --accent: #000000;
      --accent-hover: #111111;
    }
    
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: 'Inter', sans-serif;
      background-color: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    
    /* Workspace style */
    .workspace {
      flex: 1;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background: radial-gradient(circle, rgba(0,0,0,0.02) 1px, transparent 1px);
      background-size: 20px 20px;
      background-color: #F8F9FA;
      overflow: hidden;
      position: relative;
    }
    
    /* Device frame wrap */
    .frame-container {
      position: relative;
      transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
      background: #000000;
      box-sizing: border-box;
    }
    
    .frame-container.desktop {
      width: 100%;
      height: 100%;
      border-radius: 0px;
      border: none;
      box-shadow: none;
      transform: none;
      max-width: 100%;
      max-height: 100%;
    }
    
    .frame-container.tablet {
      width: 1024px;
      height: 768px;
      border-radius: 24px;
      border: 12px solid #000000;
      outline: 1px solid var(--border);
      transform: scale(0.75);
      transform-origin: center center;
      max-width: none;
      max-height: none;
    }
    
    .frame-container.mobile {
      width: 393px;
      height: 852px;
      border-radius: 48px;
      border: 12px solid #000000;
      outline: 1px solid var(--border);
      transform: scale(0.67);
      transform-origin: center center;
      max-width: none;
      max-height: none;
    }
    
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: #ffffff;
      display: block;
      transition: border-radius 0.3s;
    }
    
    .frame-container.desktop iframe {
      border-radius: 0px;
    }
    .frame-container.tablet iframe {
      border-radius: 12px; /* 24 - 12 = 12 */
    }
    .frame-container.mobile iframe {
      border-radius: 36px; /* 48 - 12 = 36 */
    }
    
    /* Floating Device Selector (bottom-right) */
    .floating-selector {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--control-bg);
      border: 1px solid var(--border);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      padding: 4px;
      border-radius: 10px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
      display: flex;
      gap: 4px;
      z-index: 1000;
      align-items: center;
    }
    
    .device-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      width: 36px;
      height: 36px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    
    .device-btn svg {
      width: 16px;
      height: 16px;
      stroke: currentColor;
    }
    
    .device-btn:hover {
      color: var(--text);
      background: rgba(0, 0, 0, 0.04);
    }
    
    .device-btn.active {
      color: #FFFFFF;
      background: var(--accent);
      box-shadow: 0 2px 8px rgba(108, 92, 231, 0.25);
    }

    .dimension-label {
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      padding: 0 8px 0 4px;
      font-family: monospace;
      user-select: none;
    }
  </style>
</head>
<body>
  <div class="workspace">
    <div class="frame-container mobile" id="frame-container">
      <iframe id="preview-iframe"></iframe>
    </div>
  </div>
  
  <div class="floating-selector">
    <button class="device-btn" id="btn-desktop" onclick="setDevice('desktop', '100%', '100%')" title="Desktop Web">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
    </button>
    <button class="device-btn" id="btn-tablet" onclick="setDevice('tablet', '1024px', '768px')" title="Tablet">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
    </button>
    <button class="device-btn active" id="btn-mobile" onclick="setDevice('mobile', '393px', '852px')" title="Mobile View">
      <svg fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
    </button>
    <div style="width: 1px; height: 16px; background: var(--border); margin: 0 4px;"></div>
    <span class="dimension-label" id="dimensions">393px × 852px</span>
  </div>
  
  <script>
    const cardHtml = ${escapedHtml};
    const iframe = document.getElementById('preview-iframe');
    iframe.srcdoc = cardHtml;

    iframe.onload = () => {
      try {
        const doc = iframe.contentWindow.document;
        if (doc) {
          doc.addEventListener('click', (event) => {
            const targetLink = event.target.closest('a');
            if (targetLink) {
              const href = targetLink.getAttribute('href');
              if (!href || href === '#' || href.startsWith('#') || href.startsWith('javascript:')) {
                event.preventDefault();
              } else {
                event.preventDefault();
                window.open(href, '_blank');
              }
            }
          });
          doc.addEventListener('submit', (event) => {
            event.preventDefault();
          });
        }
      } catch (e) {
        console.warn('Unable to attach event listeners:', e);
      }
    };

    function setDevice(deviceClass, w, h) {
      // Toggle active states
      document.querySelectorAll('.device-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('btn-' + deviceClass).classList.add('active');
      
      // Update container
      const container = document.getElementById('frame-container');
      container.className = 'frame-container ' + deviceClass;
      
      // Update dimensions
      const widthVal = deviceClass === 'desktop' ? window.innerWidth + 'px' : w;
      const heightVal = deviceClass === 'desktop' ? window.innerHeight + 'px' : h;
      document.getElementById('dimensions').innerText = widthVal + ' × ' + heightVal;
    }
    
    // Resize listener for Desktop mode
    window.addEventListener('resize', () => {
      if (document.getElementById('btn-desktop').classList.contains('active')) {
        document.getElementById('dimensions').innerText = window.innerWidth + 'px × ' + window.innerHeight + 'px';
      }
    });
  </script>
</body>
</html>`;
      
      const blob = new Blob([wrapperHtml], { type: 'text/html' });
      window.open(URL.createObjectURL(blob), '_blank');
    }
  };

  const downloadSelectedHTML = (cardId = null) => {
    const targetId = cardId || selectedCard;
    const card = canvasItems.find(c => c.id === targetId);
    if (card) {
      const blob = new Blob([card.html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${card.title}-${Date.now()}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };



  // Free error repair — never deducts credits
  const handleFixError = async (cardId) => {
    const card = canvasItems.find(c => c.id === cardId);
    if (!card || fixingCards[cardId]) return;
    setFixingCards(prev => ({ ...prev, [cardId]: true }));
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/fix-error`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          reactCode: card.reactCode || null,
          html: card.html,
          errorMessage: cardErrors[cardId] || '',
          designBrief
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setCanvasItems(prev => prev.map(c => c.id === cardId ? { ...c, html: data.html, reactCode: data.reactCode } : c));
        if (selectedCard === cardId) setCurrentHTML(data.html);
        setCardErrors(prev => { const next = { ...prev }; delete next[cardId]; return next; });
      } else {
        addMessage('assistant', `Fix attempt failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      addMessage('assistant', `Fix attempt failed: ${err.message}`);
    } finally {
      setFixingCards(prev => { const next = { ...prev }; delete next[cardId]; return next; });
    }
  };

  const handleCardChat = async (cardId) => {
    const card = canvasItems.find(c => c.id === cardId);
    const chatText = (cardChatInputs[cardId] || '').trim();
    if (!card || !chatText || loading) return;
    setCardChatInputs(prev => ({ ...prev, [cardId]: '' }));
    setLoading(true);
    setLoadingStep('Updating design...');
    addMessage('user', chatText);
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/api/agentic-ui/iterate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentHTML: card.html, instruction: chatText, designBrief })
      });
      const data = await res.json();
      if (data.status === 'success') {
        const pos = getNextGridPosition();
        const newCard = {
          id: `card-${Date.now()}`,
          html: data.html,
          reactCode: data.reactCode || null,
          title: `Updated ${card.title}`,
          x: pos.x,
          y: pos.y,
          width: card.width,
          height: card.height,
          platform: card.platform || getCardPlatform(card),
          prompt: chatText,
          createdAt: Date.now(),
        };
        setCanvasItems(prev => [...prev, newCard]);
        setSelectedCard(newCard.id);

        // Save to DB
        saveScreen({
          prompt: chatText,
          platform: designBrief?.platform || platform,
          theme: designBrief?.theme || 'dark',
          screenType: card.screenType || 'Updated',
          html: data.html,
          reactCode: data.reactCode || null,
          title: newCard.title,
          designBrief,
          canvasX: newCard.x,
          canvasY: newCard.y,
          canvasWidth: newCard.width,
          canvasHeight: newCard.height,
          sessionId: currentSessionId || undefined
        }).then(saved => {
          if (saved?.id) {
            setCanvasItems(prev => prev.map(c => c.id === newCard.id ? { ...c, id: saved.id, dbId: saved.id, renderKey: c.renderKey || c.id } : c));
            setSelectedCard(prev => prev === newCard.id ? saved.id : prev);
          }
        });

        addMessage('assistant', `Created a new version of "${card.title}" based on your feedback.`);
      }
    } catch (err) {
      addMessage('assistant', `Error: ${err.message}`);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleExportToFigma = async (cardId) => {
    if (exportingFigmaCardId) return;
    const card = canvasItems.find(c => c.id === cardId);
    if (!card?.html) return;
    
    setExportingFigmaCardId(cardId);
    setExportToastCardId(null);

    try {
      // 1. Lazy-load the Figma capture script in the PARENT window (exactly like BrandScanner)
      if (!window.figma?.silentCapture) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/figma-capture.min.js';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Failed to load Figma capture script'));
          document.head.appendChild(script);
        });
      }

      // 2. Create a temporary container in the main DOM to hold the HTML
      const tempId = `figma-temp-dom-${cardId}`;
      const tempEl = document.createElement('div');
      tempEl.id = tempId;
      tempEl.style.position = 'fixed';
      tempEl.style.top = '0';
      tempEl.style.left = '-9999px'; // offscreen but rendered
      
      const cardPlatform = getCardPlatform(card);
      const deviceSize = DEVICE_SIZES[cardPlatform] || DEVICE_SIZES.ios;
      tempEl.style.width = `${deviceSize.width}px`;
      // Web pages export at full content height; mobile/tablet at device height
      if (cardPlatform === 'web') {
        tempEl.style.height = 'auto';
        tempEl.style.minHeight = `${deviceSize.height}px`;
      } else {
        tempEl.style.height = `${deviceSize.height}px`;
        tempEl.style.overflow = 'hidden';
      }

      // CRITICAL: We must extract styles and DOM from the LOADED iframe, 
      // not the raw card.html string, because Tailwind generates CSS at runtime!
      const iframe = document.querySelector(`#figma-target-${cardId} iframe`);
      if (!iframe) throw new Error('Card iframe not found');

      // Wait for the iframe DOM to be ready
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
      
      // Extract all styles from the loaded iframe (including injected Tailwind)
      const styles = iframeDoc.querySelectorAll('head style, head link[rel="stylesheet"]');
      styles.forEach(s => tempEl.appendChild(s.cloneNode(true)));
      
      // Inject the fully rendered body content. CRITICAL: `body { ... }` CSS
      // rules don't apply to a <div>, so carry the body's computed background,
      // color, font and classes onto the wrapper — otherwise the background
      // layer is missing in Figma.
      const bodyContent = document.createElement('div');
      bodyContent.style.width = '100%';
      bodyContent.style.height = cardPlatform === 'web' ? 'auto' : '100%';
      const bodyEl = iframeDoc.body;
      const bodyCS = iframe.contentWindow?.getComputedStyle?.(bodyEl);
      if (bodyEl.className) bodyContent.className = bodyEl.className;
      if (bodyCS) {
        bodyContent.style.backgroundColor = bodyCS.backgroundColor;
        bodyContent.style.color = bodyCS.color;
        bodyContent.style.fontFamily = bodyCS.fontFamily;
        tempEl.style.backgroundColor = bodyCS.backgroundColor;
      }
      bodyContent.innerHTML = iframeDoc.body.innerHTML;
      tempEl.appendChild(bodyContent);
      
      document.body.appendChild(tempEl);
      
      // Wait for fonts/images to render in the main DOM
      await document.fonts.ready;
      const imgs = Array.from(tempEl.querySelectorAll('img'));
      await Promise.all(imgs.map(img => 
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));
      
      // 3. Silent capture: serializes DOM + copies to clipboard (exactly like BrandScanner)
      await window.figma.silentCapture(`#${tempId}`);
      
      // Clean up
      document.body.removeChild(tempEl);

      setExportToastCardId(cardId);
      setTimeout(() => setExportToastCardId(null), 4000);
    } catch (err) {
      console.error('Figma export failed:', err);
      alert(`Figma export failed: ${err.message}`);
      
      // Cleanup on failure
      const tempEl = document.getElementById(`figma-temp-dom-${cardId}`);
      if (tempEl) document.body.removeChild(tempEl);
    } finally {
      setExportingFigmaCardId(null);
    }
  };

  const handleExportAllToFigma = async () => {
    if (exportingAllFigma || canvasItems.length === 0) return;
    setExportingAllFigma(true);
    setExportAllToast(false);

    const tempId = `figma-temp-all-dom`;
    let tempEl = document.getElementById(tempId);
    if (tempEl) {
      document.body.removeChild(tempEl);
    }
    
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

      tempEl = document.createElement('div');
      tempEl.id = tempId;
      tempEl.style.position = 'fixed';
      tempEl.style.top = '0';
      tempEl.style.left = '-99999px';
      tempEl.style.display = 'flex';
      tempEl.style.flexDirection = 'row';
      tempEl.style.gap = '80px';
      tempEl.style.alignItems = 'flex-start';

      const clonedStylesheets = new Set();

      for (const card of canvasItems) {
        if (!card?.html) continue;

        const cardWrapper = document.createElement('div');
        cardWrapper.id = `figma-wrapper-${card.id}`;
        const cardPlatform = getCardPlatform(card);
        const deviceSize = DEVICE_SIZES[cardPlatform] || DEVICE_SIZES.ios;
        cardWrapper.style.width = `${deviceSize.width}px`;
        if (cardPlatform === 'web') {
          cardWrapper.style.height = 'auto';
          cardWrapper.style.minHeight = `${deviceSize.height}px`;
        } else {
          cardWrapper.style.height = `${deviceSize.height}px`;
          cardWrapper.style.overflow = 'hidden';
        }
        cardWrapper.style.flexShrink = '0';
        cardWrapper.style.position = 'relative';

        const iframe = document.querySelector(`#figma-target-${card.id} iframe`);
        if (!iframe) continue;

        const iframeDoc = iframe.contentDocument;
        if (!iframeDoc) continue;

        const styles = iframeDoc.querySelectorAll('head style, head link[rel="stylesheet"]');
        styles.forEach(s => {
          const contentStr = s.innerHTML || s.href;
          if (contentStr && !clonedStylesheets.has(contentStr)) {
            clonedStylesheets.add(contentStr);
            tempEl.appendChild(s.cloneNode(true));
          }
        });

        const bodyContent = document.createElement('div');
        bodyContent.style.width = '100%';
        bodyContent.style.height = cardPlatform === 'web' ? 'auto' : '100%';
        // Carry body-level background/color/font onto the wrapper (body CSS
        // rules don't apply to divs — this was the missing background layer)
        const bodyEl = iframeDoc.body;
        const bodyCS = iframe.contentWindow?.getComputedStyle?.(bodyEl);
        if (bodyEl.className) bodyContent.className = bodyEl.className;
        if (bodyCS) {
          bodyContent.style.backgroundColor = bodyCS.backgroundColor;
          bodyContent.style.color = bodyCS.color;
          bodyContent.style.fontFamily = bodyCS.fontFamily;
          cardWrapper.style.backgroundColor = bodyCS.backgroundColor;
        }
        bodyContent.innerHTML = iframeDoc.body.innerHTML;
        cardWrapper.appendChild(bodyContent);
        tempEl.appendChild(cardWrapper);
      }

      document.body.appendChild(tempEl);

      await document.fonts.ready;
      const imgs = Array.from(tempEl.querySelectorAll('img'));
      await Promise.all(imgs.map(img =>
        img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
      ));

      await window.figma.silentCapture(`#${tempId}`);

      document.body.removeChild(tempEl);

      setExportAllToast(true);
      setTimeout(() => setExportAllToast(false), 4000);
    } catch (err) {
      console.error('Figma export all failed:', err);
      alert(`Figma export all failed: ${err.message}`);
      const el = document.getElementById(tempId);
      if (el) document.body.removeChild(el);
    } finally {
      setExportingAllFigma(false);
    }
  };




  const fitToView = () => {
    if (transformRef.current && canvasItems.length > 0) {
      transformRef.current.resetTransform();
      setTimeout(() => {
        transformRef.current.zoomToElement('canvas-content', undefined, 200);
      }, 50);
    }
  };

  const autoResize = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
  };

  // Get scale factor to fit iframe in preview
  const deviceSize = DEVICE_SIZES[designBrief?.device || platform] || DEVICE_SIZES.ios;

  const dummyShowcase = [
    { title: 'SaaS Dashboard', desc: 'Clean data tables, analytical charts, dark mode.', img: '/mode-visual.jpeg', colors: ['#8B9A8B', '#D9C8B8', '#3E4E42', '#6C7A76'] },
    { title: 'E-commerce App', desc: 'Product grids, soft pastels, smooth checkout flow.', img: '/mode-ui-screens.jpeg', colors: ['#3A2E44', '#5C4A66', '#E6D3DC', '#E29A78'] },
    { title: 'Fintech Mobile', desc: 'Bold typography, warm accents, clear transactions.', img: '/mode-typefaces.jpeg', colors: ['#1F2A22', '#563B2B', '#D9C8B8', '#000000'] },
    { title: 'Landing Page', desc: 'High-converting hero, engaging layout, vibrant colors.', img: '/mode-websites.jpeg', colors: ['#4B5E4B', '#563B2B', '#000000', '#E29A78'] }
  ];

  const showcaseItems = [...savedSessions.slice(0, 4)];
  while (showcaseItems.length < 4) {
    showcaseItems.push({ isDummy: true, ...dummyShowcase[showcaseItems.length] });
  }

  return (
    <div 
      className="agentic-ui"
    >
      <style>{`
        .ai-badge {
          background: linear-gradient(135deg, #6366F1, #EC4899);
          color: white;
          font-size: 8px;
          padding: 2px 5px;
          border-radius: 4px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-left: 4px;
          display: inline-block;
        }
        .ai-regenerate-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 10px;
          padding: 2px;
          margin-left: auto;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        .ai-regenerate-btn:hover {
          opacity: 1;
        }
        .brief-palette-item.thinking {
          opacity: 0.5;
          pointer-events: none;
        }
        .brief-palette-item.ai-palette {
          border: 1px dashed rgba(99, 102, 241, 0.4);
          background: rgba(99, 102, 241, 0.05);
        }
        .brief-palette-item.ai-palette.selected {
          border: 2px solid #6366F1;
          background: rgba(99, 102, 241, 0.1);
        }
        .loading-pulse {
          animation: pulse 1.5s infinite;
          background: linear-gradient(90deg, #E5E7EB 25%, #F3F4F6 50%, #E5E7EB 75%);
          background-size: 200% 100%;
        }
        @keyframes pulse {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skill-thumb.ai-decides-thumb {
          background: #F3F4F6;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #000000;
          font-weight: bold;
          font-size: 12px;
        }
        .asset-mode-selector {
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid rgba(0,0,0,0.06);
        }
        .asset-mode-grid {
          display: grid;
          grid-template-cols: repeat(4, 1fr);
          gap: 8px;
          margin-top: 8px;
        }
        .asset-mode-card {
          padding: 10px;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 8px;
          background: #FFFFFF;
          cursor: pointer;
          text-align: center;
          transition: all 0.2s;
        }
        .asset-mode-card:hover {
          border-color: #000000;
        }
        .asset-mode-card.selected {
          background: #000000;
          color: #FFFFFF;
          border-color: #000000;
        }
        .asset-mode-title {
          font-size: 11px;
          font-weight: 600;
          display: block;
        }
        .asset-mode-desc {
          font-size: 9px;
          opacity: 0.8;
          display: block;
          margin-top: 2px;
        }
      `}</style>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageUpload}
        style={{ display: 'none' }}
        accept="image/*"
      />


      {isLandingView ? (
        <div className="agentic-landing-view premium">
          <div className="premium-bg-blobs">
            <div className="premium-blob blob-cyan"></div>
            <div className="premium-blob blob-purple"></div>
            <div className="premium-blob blob-rose"></div>
          </div>

          <div className="agentic-premium-hero">
            <div className="hero-top-section">
              <h1 className="agentic-premium-title">Turn your ideas into interfaces.</h1>
              <p className="agentic-premium-subtitle">Describe your vision, and we'll generate the UI instantly.</p>
            </div>

            <div className="hero-bottom-section">
              {/* Prompt suggestions single list view box - only shown on focus (rendered above input card) */}
              {isInputFocused && (
                <div className="agentic-prompt-suggestions-single-box">
                  <div className="prompt-suggestion-item" onClick={() => { setInput("Create a Plant AI iOS app screen from onboarding to settings screen. Minimum 8 screens."); setIsInputFocused(true); }}>
                    <div className="prompt-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" /></svg>
                    </div>
                    <span className="prompt-text">Create a Plant AI iOS app screen from onboarding to settings screen. Minimum 8 screens.</span>
                  </div>
                  <div className="prompt-suggestion-item" onClick={() => { setInput("A modern SaaS landing page for a time-tracking app."); setIsInputFocused(true); }}>
                    <div className="prompt-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                    </div>
                    <span className="prompt-text">A modern SaaS landing page for a time-tracking app.</span>
                  </div>
                  <div className="prompt-suggestion-item" onClick={() => { setInput("An e-commerce homepage for a skincare brand."); setIsInputFocused(true); }}>
                    <div className="prompt-icon">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 01-8 0" /></svg>
                    </div>
                    <span className="prompt-text">An e-commerce homepage for a skincare brand.</span>
                  </div>
                </div>
              )}

              <div className="agentic-premium-input-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
                {/* Interactive robot positioned on the input container */}
                <div
                  className={`inspo-robot-positioner side-${robotSide}`}
                  onClick={() => {
                    // click: dash along the bar to the other side
                    if (isRobotWalking) return;
                    setIsRobotWalking(true);
                    setRobotSide(prev => prev === 'right' ? 'left' : 'right');
                    setTimeout(() => setIsRobotWalking(false), 1200);
                  }}
                >
                  <NinjaBlob
                    value={input}
                    isFocused={isInputFocused}
                    isLoading={loading}
                    isWalking={isRobotWalking}
                    userName={(auth.currentUser?.displayName || '').split(' ')[0]}
                    side={robotSide}
                  />
                </div>

                {uploadedImage && (
                  <div className="agentic-upload-preview" style={{ alignSelf: 'flex-start', marginLeft: '16px', marginBottom: '8px' }}>
                    <img src={uploadedImage.url} alt="Uploaded UI screen" />
                    <button className="remove-upload-btn" onClick={handleRemoveImage} title="Remove image">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                  </div>
                )}

                {isUploading && (
                  <div className="agentic-upload-loading" style={{ alignSelf: 'flex-start', marginLeft: '16px', marginBottom: '8px' }}>
                    <div className="upload-spinner"></div>
                    <span>Uploading UI screen...</span>
                  </div>
                )}

                <div className="agentic-premium-input-wrapper-new">
                  <textarea
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { setShowSuggestionsDropdown(true); setIsInputFocused(true); }}
                    onBlur={() => { setTimeout(() => { setShowSuggestionsDropdown(false); setIsInputFocused(false); }, 200); }}
                    placeholder='What do you want to design?'
                    rows={1}
                    disabled={loading}
                  />

                  <div className="agentic-premium-input-bottom-row">
                    <div className="input-pills-left">
                      <button className="dropdown-pill" onClick={() => setShowAllModal(true)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        <span>Recently Generated</span>
                      </button>
                      {effectiveQuota && (
                        <div className="dropdown-pill quota-indicator-pill" style={{ background: '#f4f4f5', color: '#18181b', borderColor: 'rgba(0, 0, 0, 0.08)', fontWeight: '500' }} title="5 Free AI Credits daily (Resets at midnight UTC)">
                          <span>
                            {effectiveQuota?.isUnlimited 
                              ? 'Unlimited generations' 
                              : `${Math.max(0, Math.min(5, typeof effectiveQuota?.remaining === 'number' && effectiveQuota?.limit <= 5 ? effectiveQuota.remaining : Math.max(0, 5 - (effectiveQuota?.used || 0))))} / 5 Daily Free Credits`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="input-pills-right">
                      <button
                        className="dark-submit-btn"
                        onClick={handleSubmit}
                        disabled={(!input.trim() && !uploadedImage) || loading}
                        title="Generate Layout"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>


          <div className="agentic-main">
            {/* Chat Panel */}
            {false && (
              <div className={`agentic-chat-panel ${chatCollapsed ? 'collapsed' : ''}`}>
              <div className="agentic-chat-header-new">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="agentic-chat-title-new">Agent Chat</span>
                  <span className="agentic-chat-beta-badge">BETA</span>
                  {effectiveQuota && (
                    <span className="agentic-chat-quota-text">
                      <span>•</span>
                      <span>
                        {effectiveQuota.isUnlimited 
                          ? 'Unlimited' 
                          : `${typeof effectiveQuota.remaining === 'number' ? effectiveQuota.remaining : (effectiveQuota.limit - (effectiveQuota.used || 0))} / ${effectiveQuota.limit} left`}
                      </span>
                    </span>
                  )}
                </div>
                <button
                  className="chat-close-btn"
                  onClick={() => setChatCollapsed(!chatCollapsed)}
                  title={chatCollapsed ? "Expand Chat" : "Collapse Chat"}
                >
                  {chatCollapsed ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="13 17 18 12 13 7" />
                      <polyline points="6 17 11 12 6 7" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="11 17 6 12 11 7" />
                      <polyline points="18 17 13 12 18 7" />
                    </svg>
                  )}
                </button>
              </div>

              {showHistory && !chatCollapsed && (
                <div className="agentic-history-list">
                  {canvasItems.filter(Boolean).filter(card => card.html).map(card => (
                    <button
                      key={card.id}
                      className={`agentic-history-item ${selectedCard === card.id ? 'active' : ''}`}
                      onClick={() => setSelectedCard(card.id)}
                    >
                      <span className="history-title">{card.title}</span>
                      <span className="history-time">{new Date(card.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </button>
                  ))}
                  <button className="agentic-history-clear" onClick={() => { setCanvasItems([]); setSelectedCard(null); }}>
                    Clear all
                  </button>
                </div>
              )}

              {!chatCollapsed && (
                <>
                  <div className="agentic-messages" ref={messagesRef}>
                {messages.length === 0 && !loading && (
                  <div className="agentic-welcome">
                    <h3>Design any screen</h3>
                    <p>Describe what you want. We'll craft a pixel-perfect UI for you.</p>

                    {/* Platform selector */}
                    <div className="agentic-platform-selector">
                      {PLATFORMS.map(p => (
                        <button
                          key={p.id}
                          className={`agentic-platform-btn ${platform === p.id ? 'active' : ''}`}
                          onClick={() => setPlatform(p.id)}
                        >
                          <span className="label">{p.label}</span>
                          <span className="dims">{p.dims}</span>
                        </button>
                      ))}
                    </div>

                    {/* Suggestions */}
                    <div className="agentic-suggestions">
                      {SUGGESTIONS.map((s, i) => (
                        <button key={i} className="agentic-suggestion" onClick={() => setInput(s.text)}>
                          <span className="agentic-suggestion-icon" dangerouslySetInnerHTML={{ __html: s.icon }} />
                          <span>{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, i) => (
                  <div key={i} className={`agentic-msg ${msg.role}`}>
                    <div className={`agentic-msg-avatar ${msg.role}`}>
                      {msg.role === 'assistant'
                        ? <ThinkingCurve size={28} />
                        : auth.currentUser?.photoURL
                          ? <img src={auth.currentUser.photoURL} alt="" className="avatar-photo" />
                          : (auth.currentUser?.displayName?.[0] || 'U')
                      }
                    </div>
                    <div className="agentic-msg-content">
                      {msg.content.startsWith('__QUOTA_REACHED__') ? (
                        <div className="agentic-quota-error-card">
                          <div className="quota-icon"><Zap size={14} /></div>
                          <h4>Daily Limit Reached</h4>
                          <p>{msg.content.replace('__QUOTA_REACHED__', '')}</p>
                          <p style={{ fontSize: '12px', color: '#888', marginTop: '6px' }}>
                            Your 5 free AI credits reset daily at midnight UTC.
                          </p>
                        </div>
                      ) : (
                        <>
                          {msg.image && (
                            <div className="agentic-msg-attachment" style={{ marginBottom: '8px', maxWidth: '140px', maxHeight: '140px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                              <img src={msg.image} alt="Uploaded UI screen" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            </div>
                          )}
                          {msg.content.split('\n').map((line, j) => (
                            <span key={j}>{line}<br /></span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Interactive Design Brief Picker */}
                {showDesignBrief && !loading && !sessionHasImage && (
                  <div className="agentic-design-brief-v2">

                    {/* ── Inline Structured Questions (selectable cards) ── */}
                    {structuredQuestions && structuredQuestions.filter(sq => sq.id !== 'style').length > 0 && (
                      <>
                        {structuredQuestions.filter(sq => sq.id !== 'style').map((sq, sqIdx) => (
                          <div className="brief-block" key={sq.id}>
                            <div className="brief-block-header">
                              <span className="brief-step">{String(sqIdx + 1).padStart(2, '0')}</span>
                              <span className="brief-block-title">{sq.question}</span>
                              {sq.type === 'multi' && <span className="brief-tag-new">MULTI</span>}
                            </div>
                            <div className="inline-question-options">
                              {(sq.options || []).map(opt => (
                                <button
                                  key={opt.label}
                                  className={`inline-question-opt ${(questionAnswers[sq.id] || []).includes(opt.label) ? 'selected' : ''}`}
                                  onClick={() => toggleQuestionAnswer(sq, opt)}
                                >
                                  <span className="inline-question-check">
                                    {(questionAnswers[sq.id] || []).includes(opt.label) ? (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    ) : (
                                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>
                                    )}
                                  </span>
                                  <span className="inline-question-label">{opt.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}

                    {/* ── Step 1: Skill ── */}
                    {uiStyles.length > 0 && (
                      <div className="brief-block">
                        <div className="brief-block-header">
                          <span className="brief-step">01</span>
                          <span className="brief-block-title">Skill</span>
                          <span className="brief-tag-new">NEW</span>
                        </div>
                        <div className="skill-grid">
                          <div
                            className={`skill-card${selectedStyle === null ? ' selected' : ''}`}
                            onClick={() => setSelectedStyle(null)}
                            title="Let the AI decide the design style dynamically based on prompt analysis"
                          >
                            <div className="skill-thumb ai-decides-thumb">
                              DYNAMIC
                            </div>
                            <div className="skill-card-footer">
                              <span className="skill-name">AI Decides</span>
                            </div>
                          </div>
                          {uiStyles.map(skill => (
                            <div
                              key={skill.id}
                              className={`skill-card${selectedStyle === skill.id ? ' selected' : ''}`}
                              onClick={() => handleSkillChange(skill.id)}
                              title={skill.description}
                            >
                              <div className="skill-thumb" style={skillThumbStyle(skill)} />
                              <div className="skill-card-footer">
                                <span className="skill-name">{skill.name}</span>
                                <button
                                  className="skill-preview-btn"
                                  onClick={e => { e.stopPropagation(); setPreviewSkill(skill); }}
                                  title="Preview skill"
                                >
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── Step 2: Color Palette ── */}
                    <div className="brief-block">
                      <div className="brief-block-header">
                        <span className="brief-step">0{uiStyles.length > 0 ? 2 : 1}</span>
                        <span className="brief-block-title">Color Palette</span>
                        <label className="brief-custom-toggle">
                          <input type="checkbox" checked={useCustomColors} onChange={e => { setUseCustomColors(e.target.checked); if (e.target.checked) { setPaletteLocked(true); setPaletteSource('custom'); } }} />
                          <span>Custom</span>
                        </label>
                      </div>

                      {useCustomColors ? (
                        <div className="brief-custom-colors-row">
                          <label className="brief-color-swatch">
                            <input type="color" value={customPrimary} onChange={e => setCustomPrimary(e.target.value)} />
                            <span style={{ background: customPrimary }} className="swatch-circle" />
                            <span className="swatch-label">Primary</span>
                          </label>
                          <label className="brief-color-swatch">
                            <input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} />
                            <span style={{ background: customBg }} className="swatch-circle" />
                            <span className="swatch-label">Secondary</span>
                          </label>
                          <label className="brief-color-swatch">
                            <input type="color" value={customAccent} onChange={e => setCustomAccent(e.target.value)} />
                            <span style={{ background: customAccent }} className="swatch-circle" />
                            <span className="swatch-label">Accent</span>
                          </label>
                        </div>
                      ) : (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                          <button
                            type="button"
                            className="brief-scroll-arrow left"
                            onClick={(e) => { e.preventDefault(); scrollPalettes('left'); }}
                            title="Scroll left"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                          </button>
                          
                          <div className="brief-palette-strip" ref={paletteStripRef} style={{ width: '100%' }}>
                            {isThinkingPalette && (
                              <div className="brief-palette-item thinking">
                                <div className="brief-palette-swatch loading-pulse" />
                                <span className="brief-palette-name">Thinking...</span>
                              </div>
                            )}

                            {aiPalette && !isThinkingPalette && (
                              <button
                                type="button"
                                className={`brief-palette-item ai-palette ${selectedPalette?.name === aiPalette.name ? 'selected' : ''}`}
                                onClick={() => { setSelectedPalette(aiPalette); setUseCustomColors(false); setPaletteSource('ai'); setPaletteLocked(true); }}
                                title={aiPalette.reason}
                              >
                                <div className="brief-palette-swatch">
                                  <span style={{ background: aiPalette.background, flex: 2 }} />
                                  <span style={{ background: aiPalette.accent, flex: 1 }} />
                                  <span style={{ background: aiPalette.accent2, flex: 1 }} />
                                </div>
                                <span className="brief-palette-name" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {aiPalette.name}
                                  <span className="ai-badge">AI</span>
                                </span>
                                <span className={`brief-palette-mode ${aiPalette.theme}`}>{aiPalette.theme}</span>
                                <button 
                                  type="button" 
                                  className="ai-regenerate-btn" 
                                  onClick={(e) => { e.stopPropagation(); suggestPalette(originalPrompt || input); }}
                                  title="Regenerate AI Palette"
                                >
                                  <RotateCw size={12} />
                                </button>
                              </button>
                            )}

                            {COLOR_PALETTES.map((p, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`brief-palette-item ${selectedPalette?.name === p.name ? 'selected' : ''}`}
                                onClick={() => { setSelectedPalette(p); setUseCustomColors(false); setPaletteLocked(true); setPaletteSource('preset'); }}
                                title={p.name}
                              >
                                <div className="brief-palette-swatch">
                                  <span style={{ background: p.background, flex: 2 }} />
                                  <span style={{ background: p.accent, flex: 1 }} />
                                  <span style={{ background: p.accent2, flex: 1 }} />
                                </div>
                                <span className="brief-palette-name">{p.name}</span>
                                <span className={`brief-palette-mode ${p.theme}`}>{p.theme}</span>
                              </button>
                            ))}
                          </div>

                          <button
                            type="button"
                            className="brief-scroll-arrow right"
                            onClick={(e) => { e.preventDefault(); scrollPalettes('right'); }}
                            title="Scroll right"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* ── Step 3: Typography ── */}
                    <div className="brief-block">
                      <div className="brief-block-header">
                        <span className="brief-step">0{uiStyles.length > 0 ? 3 : 2}</span>
                        <span className="brief-block-title">Typography</span>
                      </div>
                      <div className="brief-type-grid">
                        <div className="brief-type-col">
                          <span className="brief-type-label">Heading</span>
                          <div className="brief-font-list">
                            {FONT_OPTIONS.map(f => (
                              <button
                                key={f.name}
                                className={`brief-font-row ${headingFont === f.name ? 'selected' : ''}`}
                                onClick={() => { setHeadingFont(f.name); setFontsCustomized(true); }}
                              >
                                <link rel="stylesheet" href={`https://fonts.googleapis.com/css2?family=${f.name.replace(/ /g, '+')}:wght@600&display=swap`} />
                                <span className="brief-font-sample" style={{ fontFamily: `'${f.name}', sans-serif`, fontWeight: 600 }}>Ag</span>
                                <span className="brief-font-name">{f.name}</span>
                                {headingFont === f.name && <span className="brief-font-check">✓</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="brief-type-divider" />
                        <div className="brief-type-col">
                          <span className="brief-type-label">Body</span>
                          <div className="brief-font-list">
                            {FONT_OPTIONS.map(f => (
                              <button
                                key={f.name}
                                className={`brief-font-row ${bodyFont === f.name ? 'selected' : ''}`}
                                onClick={() => { setBodyFont(f.name); setFontsCustomized(true); }}
                              >
                                <span className="brief-font-sample" style={{ fontFamily: `'${f.name}', sans-serif`, fontWeight: 400 }}>Ag</span>
                                <span className="brief-font-name">{f.name}</span>
                                {bodyFont === f.name && <span className="brief-font-check">✓</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Step 4: Icon Style ── */}
                    <div className="brief-block">
                      <div className="brief-block-header">
                        <span className="brief-step">0{uiStyles.length > 0 ? 4 : 3}</span>
                        <span className="brief-block-title">Icon Style</span>
                      </div>
                      <div className="brief-icon-grid">
                        {ICON_STYLES.map(s => (
                          <button
                            key={s.id}
                            className={`brief-icon-card ${iconStyle === s.id ? 'selected' : ''}`}
                            onClick={() => setIconStyle(s.id)}
                          >
                            <div className="brief-icon-previews" dangerouslySetInnerHTML={{ __html: s.icon }} />
                            <span className="brief-icon-label">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>



                    {/* ── Platform Selector ── */}
                    <div className="brief-platform-bar">
                      {PLATFORMS.map(p => (
                        <button
                          key={p.id}
                          className={`brief-platform-btn ${platform === p.id ? 'active' : ''}`}
                          onClick={() => setPlatform(p.id)}
                        >
                          <div className="brief-platform-icon" dangerouslySetInnerHTML={{ __html: p.icon }} />
                          <span className="brief-platform-label">{p.label}</span>
                          <span className="brief-platform-dims">{p.dims}</span>
                        </button>
                      ))}
                    </div>

                  </div>
                )}

                {/* Simplified Platform Picker for visual screenshot uploads */}
                {showDesignBrief && !loading && sessionHasImage && (
                  <div className="agentic-design-brief-v2" style={{ padding: '12px', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.02)', margin: '8px 0 16px 0' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Select target platform format:
                    </div>
                    <div className="brief-platform-bar" style={{ marginTop: 0 }}>
                      {PLATFORMS.map(p => (
                        <button
                          key={p.id}
                          className={`brief-platform-btn ${platform === p.id ? 'active' : ''}`}
                          onClick={() => setPlatform(p.id)}
                        >
                          <div className="brief-platform-icon" dangerouslySetInnerHTML={{ __html: p.icon }} />
                          <span className="brief-platform-label">{p.label}</span>
                          <span className="brief-platform-dims">{p.dims}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loading && (
                  <div className="agentic-msg assistant">
                    <div className="agentic-msg-avatar assistant"><ThinkingCurve size={28} /></div>
                    <div className="agentic-msg-content">
                      <div className="agentic-loading-container" style={{ background: '#F8F9FA', borderRadius: '12px', border: '1px solid #E9ECEF', padding: '12px 16px', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '16px' }} onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}>
                          <div className="agentic-loading" style={{ margin: 0, padding: 0 }}>
                            <span className="agentic-loading-text" style={{ fontWeight: '500', color: '#495057' }}>
                              {thinkingLogs[thinkingLogs.length - 1]?.text || 'Thinking...'}
                            </span>
                          </div>
                          <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', transition: 'transform 0.2s', transform: isThinkingExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6C757D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                          </button>
                        </div>
                        
                        {isThinkingExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid #E9ECEF', paddingTop: '8px', marginTop: '4px' }}>
                            {thinkingLogs.map((log, index) => (
                              <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: log.status === 'completed' ? '#6C757D' : '#111' }}>
                                {log.status === 'completed' ? (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><polyline points="20 6 9 17 4 12"></polyline></svg>
                                ) : (
                                  <div className="thought-spinner" style={{ width: '10px', height: '10px', borderRadius: '50%', border: '1.5px solid #000000', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                                )}
                                <span style={{ fontWeight: log.status === 'active' ? '600' : '400' }}>{log.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Input Area New */}
              <div className="agentic-input-area-new">
                <div className="agentic-input-container-new">

                  {uploadedImage && (
                    <div className="agentic-upload-preview">
                      <img src={uploadedImage.url} alt="Uploaded UI screen" />
                      <button className="remove-upload-btn" onClick={handleRemoveImage} title="Remove image">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                    </div>
                  )}

                  {isUploading && (
                    <div className="agentic-upload-loading">
                      <div className="upload-spinner"></div>
                      <span>Uploading UI screen...</span>
                    </div>
                  )}

                  <textarea
                    value={input}
                    onChange={(e) => { setInput(e.target.value); autoResize(e); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Message..."
                    rows={1}
                    disabled={loading}
                    className="agentic-main-textarea"
                  />

                  <div className="agentic-input-actions-row">
                    <div className="left-actions">
                      <button className="icon-btn plus-btn" onClick={handlePlusClick} disabled={loading || isUploading} title="Upload UI screenshot">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                      </button>
                      <button className="tools-btn" title="Coming soon" onClick={() => triggerComingSoonToast('Tools')}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        Tools
                      </button>
                      <button 
                        className={`tools-btn thinking-btn ${thinkingMode ? 'active' : ''}`}
                        title="Toggle Deep Reasoning (DeepSeek-R1)"
                        onClick={() => setThinkingMode(!thinkingMode)}
                        style={{
                          marginLeft: '8px',
                          borderColor: thinkingMode ? '#000000' : '#E2E8F0',
                          color: thinkingMode ? '#000000' : '#334155',
                          background: thinkingMode ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                          fontWeight: thinkingMode ? '600' : '500'
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1 0-3.12 3 3 0 0 1 0-3.88 2.5 2.5 0 0 1 0-3.12A2.5 2.5 0 0 1 9.5 2z"></path>
                          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 0-3.12 3 3 0 0 0 0-3.88 2.5 2.5 0 0 0 0-3.12A2.5 2.5 0 0 0 14.5 2z"></path>
                        </svg>
                        Thinking
                      </button>
                    </div>
                    <div className="right-actions">
                      <button className="icon-btn mic-btn" title="Coming soon" onClick={() => triggerComingSoonToast('Voice Input')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                      </button>
                      {loading ? (
                        <button className="icon-btn stop-btn" disabled>
                          <div className="stop-circle"></div>
                        </button>
                      ) : (
                        <button className="icon-btn stop-btn" onClick={handleSubmit} disabled={!input.trim() && !uploadedImage}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="19" x2="12" y2="5"></line>
                            <polyline points="5 12 12 5 19 12"></polyline>
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  {comingSoonToast && (
                    <div className="agentic-coming-soon-toast">
                      <span>{comingSoonToast} is coming soon!</span>
                    </div>
                  )}

                  {/* Quota badge is relocated to the top-level parent viewport corner */}

                </div>
              </div>
                </>
              )}
              </div>
            )}

            {/* Moodboard Canvas */}
            <div className="agentic-canvas" ref={canvasRef} data-tool={activeTool}>
              {loading && !liveBuilding && (
                <div className="canvas-status-pill">
                  <span className="center-composer-spinner" />
                  <span>{loadingStep || FUNNY_LOADING_PHRASES[funnyPhraseIndex]}</span>
                </div>
              )}
              <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={0.1}
                maxScale={2}
                limitToBounds={false}
                panning={{
                  disabled: activeTool !== 'hand',
                  velocityDisabled: false,
                  velocity: true,
                  // Hand tool pans from anywhere (cards ignore pointer input in
                  // hand mode) — only card toolbar controls opt out of pan-start.
                  excluded: ['canvas-card-chat', 'cct-btn', 'cct-drag-handle']
                }}
                wheel={{ step: 0.12 }} // slightly faster zoom too
                doubleClick={{ disabled: true }}
                onTransformed={(ref) => setZoomScale(ref.state.scale)}
              >
                {(utils) => {
                  const { zoomIn, zoomOut, resetTransform } = utils;
                  const state = utils.state;
                  return (
                    <>
                      <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }} contentStyle={{ width: '4000px', height: '4000px' }}>
                        <div id="canvas-content" onClick={() => setSelectedCard(null)}>

                          {canvasItems.filter(Boolean).filter(card => card.html).map(card => (
                            <Rnd
                              id={card.id}
                              key={card.renderKey || card.id}
                              scale={zoomScale}
                              position={{ x: card.x, y: card.y }}
                              size={{ width: card.width, height: card.height }}
                              minWidth={280}
                              minHeight={300}
                              lockAspectRatio={(designBrief?.device === 'ios' || platform === 'ios') && card.width <= 500}
                              disableDragging={false}
                              enableResizing={activeTool === 'cursor'}
                              onDragStart={(e, d) => {
                                e.stopPropagation();
                                setIsDragging(card.id);
                                setDragStartPos({ x: card.x, y: card.y });
                              }}

                              onDragStop={(e, d) => {
                                setIsDragging(null);
                                setCanvasItems(prev => prev.map(c => c.id === card.id ? { ...c, x: d.x, y: d.y } : c));
                                savePosition(card.id, d.x, d.y, card.width, card.height);
                              }}
                              onResizeStop={(e, dir, ref, delta, pos) => {
                                const w = parseInt(ref.style.width), h = parseInt(ref.style.height);
                                setCanvasItems(prev => prev.map(c => c.id === card.id ? {
                                  ...c, width: w, height: h, ...pos
                                } : c));
                                savePosition(card.id, pos.x, pos.y, w, h);
                              }}
                              className={`canvas-card ${selectedCard === card.id ? 'selected' : ''} ${(designBrief?.device === 'ios' || platform === 'ios') && card.width <= 500 ? 'ios-mockup' : ''}`}
                              cancel=".canvas-card-chat"
                              dragHandleClassName="cct-drag-handle"
                            >
                              <div className="canvas-card-toolbar" onClick={e => e.stopPropagation()}>
                                {/* Per-card code button removed — use the ZIP download in the canvas toolbar */}
                                {/* Responsive Selector */}
                                <div className="cct-tooltip-wrap">
                                  <button 
                                    className={`cct-btn ${activeResponsiveDropdownCardId === card.id ? 'active' : ''}`} 
                                    onClick={e => { 
                                      e.stopPropagation(); 
                                      setActiveResponsiveDropdownCardId(prev => prev === card.id ? null : card.id); 
                                    }}
                                    title=""
                                  >
                                    {getCardPlatform(card) === 'web' && (
                                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                        <line x1="8" y1="21" x2="16" y2="21" />
                                        <line x1="12" y1="17" x2="12" y2="21" />
                                      </svg>
                                    )}
                                    {getCardPlatform(card) === 'tablet' && (
                                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                                        <line x1="12" y1="18" x2="12.01" y2="18" />
                                      </svg>
                                    )}
                                    {getCardPlatform(card) === 'ios' && (
                                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                        <line x1="12" y1="18" x2="12.01" y2="18" />
                                      </svg>
                                    )}
                                  </button>
                                  
                                  {activeResponsiveDropdownCardId === card.id ? (
                                    <div className="cct-dropdown-menu" onClick={e => e.stopPropagation()}>
                                      <button 
                                        className={`cct-dropdown-item ${getCardPlatform(card) === 'web' ? 'active' : ''}`}
                                        onClick={() => handleCardPlatformChange(card.id, 'web')}
                                      >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                                          <line x1="8" y1="21" x2="16" y2="21" />
                                          <line x1="12" y1="17" x2="12" y2="21" />
                                        </svg>
                                        Desktop Web
                                      </button>
                                      <button 
                                        className={`cct-dropdown-item ${getCardPlatform(card) === 'tablet' ? 'active' : ''}`}
                                        onClick={() => handleCardPlatformChange(card.id, 'tablet')}
                                      >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                                          <line x1="12" y1="18" x2="12.01" y2="18" />
                                        </svg>
                                        Tablet
                                      </button>
                                      <button 
                                        className={`cct-dropdown-item ${getCardPlatform(card) === 'ios' ? 'active' : ''}`}
                                        onClick={() => handleCardPlatformChange(card.id, 'ios')}
                                      >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                                          <line x1="12" y1="18" x2="12.01" y2="18" />
                                        </svg>
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
                                    <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                                    <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                                    <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                                  </svg>
                                  <span className="cct-tooltip">Drag Screen</span>
                                </div>



                                <div className="cct-sep" />

                                {/* Preview */}
                                <div className="cct-tooltip-wrap">
                                  <button className="cct-btn" onClick={e => { e.stopPropagation(); setSelectedCard(card.id); openSelectedFullScreen && openSelectedFullScreen(card.id); }} title="">
                                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                  </button>
                                  <span className="cct-tooltip">Preview</span>
                                </div>
                              </div>

                              {/* ── Card frame (iframe only) ── */}
                              <div 
                                id={`figma-target-${card.id}`} 
                                className={`canvas-card-inner ${activeTool === 'hand' ? 'cct-drag-handle' : ''}`} 
                                onClick={(e) => { e.stopPropagation(); setSelectedCard(card.id); }}
                              >

                                {/* iframe preview — with iPhone mockup for iOS */}
                                {(designBrief?.device === 'ios' || platform === 'ios') && card.width <= 500 ? (
                                  <div className="canvas-card-mockup-wrapper" style={{
                                    position: 'relative',
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    background: 'transparent'
                                  }}>
                                      <div style={{
                                        position: 'relative',
                                        height: '98%',
                                        aspectRatio: '393/852',
                                        borderRadius: '44px',
                                        background: (designBrief?.theme || selectedPalette?.theme || 'dark') === 'dark' ? '#000000' : '#ffffff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        overflow: 'hidden',
                                        boxShadow: selectedCard === card.id ? '0 8px 24px rgba(74, 144, 217, 0.25)' : '0 8px 24px rgba(0, 0, 0, 0.15)',
                                        border: '6px solid #000000',
                                        boxSizing: 'border-box',
                                        outline: selectedCard === card.id ? '3px solid #4A90D9' : 'none',
                                        outlineOffset: '2px'
                                      }}>
                                        <div style={{
                                          position: 'relative',
                                          width: '100%',
                                          height: '100%',
                                          overflow: 'hidden',
                                          borderRadius: '38px',
                                          transform: 'translate3d(0, 0, 0)',
                                          WebkitMaskImage: '-webkit-radial-gradient(white, black)'
                                        }}>
                                          <iframe
                                            srcDoc={card.initialHtml || card.html}
                                            sandbox="allow-scripts allow-same-origin"
                                            title={card.title}
                                            className="canvas-card-iframe"
                                            style={{
                                              width: '100%',
                                              height: '100%',
                                              border: 'none',
                                              pointerEvents: activeTool === 'hand' ? 'none' : 'auto',
                                              borderRadius: '38px',
                                              transform: 'translate3d(0, 0, 0)'
                                            }}
                                            onLoad={(e) => handleIframeLoad(e, card.id)}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                ) : (
                                  <iframe
                                    srcDoc={card.initialHtml || card.html}
                                    sandbox="allow-scripts allow-same-origin"
                                    title={card.title}
                                    className="canvas-card-iframe"
                                    style={{
                                      width: '100%',
                                      height: '100%',
                                      border: 'none',
                                      pointerEvents: activeTool === 'hand' ? 'none' : 'auto'
                                    }}
                                    onLoad={(e) => handleIframeLoad(e, card.id)}
                                  />
                                )}

                                {/* Drag Overlay (Snappy Performance Fix) */}
                                {isDragging === card.id && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    zIndex: 100,
                                    cursor: 'grabbing',
                                    background: 'transparent'
                                  }} />
                                )}

                              </div>

                              {/* ── Error banner (shown when iframe posts a render error) ── */}
                              {cardErrors[card.id] && (
                                <div className="canvas-card-error-banner" onClick={e => e.stopPropagation()}>
                                  <span className="canvas-card-error-label">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                                    Component error
                                  </span>
                                  <button
                                    className={`canvas-card-fix-btn${fixingCards[card.id] ? ' fixing' : ''}`}
                                    onClick={() => handleFixError(card.id)}
                                    disabled={!!fixingCards[card.id]}
                                  >
                                    {fixingCards[card.id] ? (
                                      <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{animation:'spin 1s linear infinite',flexShrink:0}}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
                                        Fixing…
                                      </>
                                    ) : (
                                      <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
                                        Fix with AI · Free
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}


                            </Rnd>
                          ))}
                        </div>
                      </TransformComponent>

                      {canvasItems.length === 0 && !loading && (
                        <div className="agentic-canvas-empty" style={{ zIndex: 10 }}>
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.2">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <line x1="3" y1="9" x2="21" y2="9" />
                            <line x1="9" y1="21" x2="9" y2="9" />
                          </svg>
                          <p>Your generated screens will appear here</p>
                          <span className="canvas-hint">Ctrl+Scroll to zoom, Space+Drag to pan</span>
                        </div>
                      )}



                      {/* v3 Question Dock — grouped steps, bottom-center, above the toolbar */}
                      {structuredQuestions && structuredQuestions.length > 0 && (() => {
                        const COLOR_PRESETS = [
                          { name: 'Light & clean', theme: 'light', background: '#F9F9F8', surface: '#FFFFFF', primary: '#2563EB', accent: '#2563EB', accent2: '#0D9488', textPrimary: '#1C1C1A', textSecondary: '#71716C', border: '#E4E4E1' },
                          { name: 'Dark mode', theme: 'dark', background: '#0A0A0B', surface: '#131316', primary: '#A3E635', accent: '#A3E635', accent2: '#5EEAD4', textPrimary: '#F4F4F5', textSecondary: '#8E8E98', border: '#26262C' },
                          { name: 'Warm & earthy', theme: 'light', background: '#FBF7F0', surface: '#FFFFFF', primary: '#C4622D', accent: '#C4622D', accent2: '#5F7A5A', textPrimary: '#2D2A24', textSecondary: '#7A7264', border: '#E7DCC8' },
                          { name: 'Bold & vivid', theme: 'light', background: '#F2EFE9', surface: '#FFFFFF', primary: '#FF5941', accent: '#FF5941', accent2: '#2B6CFF', textPrimary: '#111110', textSecondary: '#55554F', border: '#111110' }
                        ];
                        const productQs = structuredQuestions.filter(sq => sq.id !== 'style');
                        const styleQ = structuredQuestions.find(sq => sq.id === 'style');
                        const groups = [
                          ...productQs.map(sq => ({ kind: 'q', title: sq.question, q: sq })),
                          ...(styleQ ? [{ kind: 'style', title: 'Design direction', q: styleQ }] : []),
                          { kind: 'colorsIcons', title: 'Colors & icons' },
                          { kind: 'fontsScreen', title: 'Fonts & screen' }
                        ];
                        const step = Math.min(questionIdx, groups.length - 1);
                        const g = groups[step];
                        const isLast = step >= groups.length - 1;
                        const colorActive = useCustomColors ? 'custom' : (paletteLocked && selectedPalette?.name ? selectedPalette.name : 'ai');
                        return (
                          <div className="question-dock" onClick={e => e.stopPropagation()}>
                            <div className="question-dock-head">
                              <span className="question-dock-title">{g.title}</span>
                              <span className="question-dock-step">
                                <button disabled={step === 0} onClick={() => setQuestionIdx(i => Math.max(0, i - 1))}>‹</button>
                                {step + 1}/{groups.length}
                                <button disabled={isLast} onClick={() => setQuestionIdx(i => Math.min(groups.length - 1, i + 1))}>›</button>
                              </span>
                            </div>

                            {g.kind === 'q' && (
                              <>
                                {g.q.type === 'multi' && <p className="question-dock-hint">Pick all that apply</p>}
                                <div className="question-dock-options">
                                  {(g.q.options || []).map((opt) => (
                                    <button
                                      key={opt.label}
                                      className={`question-dock-opt ${(questionAnswers[g.q.id] || []).includes(opt.label) ? 'selected' : ''}`}
                                      onClick={() => toggleQuestionAnswer(g.q, opt)}
                                    >
                                      <span className="question-dock-opt-label">{opt.label}</span>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}

                            {g.kind === 'style' && (
                              <div className="question-dock-options style-grid">
                                {(g.q.options || []).map((opt) => (
                                  <button
                                    key={opt.label}
                                    className={`question-dock-opt ${(questionAnswers[g.q.id] || []).includes(opt.label) ? 'selected' : ''}`}
                                    onClick={() => toggleQuestionAnswer(g.q, opt)}
                                  >
                                    {opt.thumbnail ? (
                                      <span className="dna-thumb" style={{ background: '#000', overflow: 'hidden', padding: 0 }}>
                                        <img src={opt.thumbnail} alt={opt.label} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
                                      </span>
                                    ) : opt.swatch ? (
                                      <span className="dna-thumb" style={{ background: opt.swatch.bg }}>
                                        <span className="dna-thumb-card" style={{ background: opt.swatch.surface, borderColor: (opt.swatch.ink || '#000') + '1F' }}>
                                          <i style={{ background: opt.swatch.accent, width: '36%' }} />
                                          <i style={{ background: opt.swatch.ink, width: '72%' }} />
                                          <i style={{ background: opt.swatch.ink, opacity: 0.35, width: '54%' }} />
                                        </span>
                                      </span>
                                    ) : null}
                                    <span className="question-dock-opt-label">
                                      {opt.label}
                                      {opt.fonts && <em>{opt.fonts.display} · {opt.fonts.body}</em>}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {g.kind === 'colorsIcons' && (
                              <div className="dock-group">
                                <p className="dock-group-label">Color palette</p>
                                <div className="dock-color-row">
                                  <button
                                    className={`dock-color-chip ${colorActive === 'ai' ? 'selected' : ''}`}
                                    onClick={() => { setUseCustomColors(false); setPaletteLocked(false); }}
                                  >AI decides</button>
                                  {COLOR_PRESETS.map(p => (
                                    <button
                                      key={p.name}
                                      className={`dock-color-chip ${colorActive === p.name ? 'selected' : ''}`}
                                      onClick={() => { setUseCustomColors(false); setSelectedPalette(p); setPaletteLocked(true); setPaletteSource('custom'); }}
                                      title={p.name}
                                    >
                                      <span className="dock-color-dots" style={{ background: p.background, borderColor: p.textPrimary + '22' }}>
                                        <i style={{ background: p.accent }} /><i style={{ background: p.textPrimary }} /><i style={{ background: p.accent2 }} />
                                      </span>
                                      {p.name}
                                    </button>
                                  ))}
                                  <button
                                    className={`dock-color-chip ${colorActive === 'custom' ? 'selected' : ''}`}
                                    onClick={() => { setUseCustomColors(true); setPaletteLocked(true); setPaletteSource('custom'); }}
                                  >Custom…</button>
                                </div>
                                {useCustomColors && (
                                  <div className="dock-custom-colors">
                                    {[['Background', customBg, setCustomBg], ['Primary', customPrimary, setCustomPrimary], ['Accent', customAccent, setCustomAccent]].map(([label, val, setter]) => (
                                      <label key={label} className="dock-custom-color">
                                        <input type="color" value={val} onChange={e => setter(e.target.value)} />
                                        <span className="dock-custom-swatch" style={{ background: val }} />
                                        {label}
                                      </label>
                                    ))}
                                  </div>
                                )}
                                <p className="dock-group-label" style={{ marginTop: 14 }}>Icon style</p>
                                <div className="dock-icon-row">
                                  {ICON_STYLES.map(s => (
                                    <button
                                      key={s.id}
                                      className={`dock-icon-chip ${iconStyle === s.id ? 'selected' : ''}`}
                                      onClick={() => setIconStyle(s.id)}
                                    >
                                      <span className="dock-icon-preview" dangerouslySetInnerHTML={{ __html: s.icon }} />
                                      {s.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {g.kind === 'fontsScreen' && (
                              <div className="dock-group">
                                <div className="dock-font-cols">
                                  <label className="dock-select">
                                    <span className="dock-group-label">Heading font</span>
                                    <select value={fontsCustomized ? headingFont : ''} onChange={e => { if (e.target.value) { setHeadingFont(e.target.value); setFontsCustomized(true); } else setFontsCustomized(false); }}>
                                      <option value="">AI decides</option>
                                      {FONT_OPTIONS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                                    </select>
                                  </label>
                                  <label className="dock-select">
                                    <span className="dock-group-label">Body font</span>
                                    <select value={fontsCustomized ? bodyFont : ''} onChange={e => { if (e.target.value) { setBodyFont(e.target.value); setFontsCustomized(true); } }}>
                                      <option value="">AI decides</option>
                                      {FONT_OPTIONS.map(f => <option key={f.name} value={f.name}>{f.name}</option>)}
                                    </select>
                                  </label>
                                </div>
                                <p className="dock-group-label" style={{ marginTop: 14 }}>Screen</p>
                                <div className="dock-icon-row">
                                  {PLATFORMS.map(p => (
                                    <button
                                      key={p.id}
                                      className={`dock-icon-chip ${platform === p.id ? 'selected' : ''}`}
                                      onClick={() => setPlatform(p.id)}
                                    >
                                      <span className="dock-icon-preview" dangerouslySetInnerHTML={{ __html: p.icon }} />
                                      {p.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="question-dock-actions">
                              <button className="question-dock-skip" onClick={() => finishQuestionDock(true)}>Skip all</button>
                              {isLast
                                ? <button className="question-dock-next" onClick={() => finishQuestionDock(false)}>Generate</button>
                                : <button className="question-dock-next" onClick={() => setQuestionIdx(i => i + 1)}>Next</button>}
                            </div>
                          </div>
                        );
                      })()}

                      {/* v3 Center Composer — primary input when the sidebar is collapsed */}
                      {chatCollapsed && !structuredQuestions && (() => {
                        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
                        // Bubble only while working or when the AI is waiting on an answer —
                        // it must never linger over the canvas after completion.
                        const bubbleText = loading
                          ? (loadingStep || 'Working on it…')
                          : (pendingIntent ? (lastAssistant?.content || '') : '');
                        return (
                          <div className="center-composer" onClick={e => e.stopPropagation()}>
                            {bubbleText && !bubbleText.startsWith('__QUOTA_REACHED__') && (
                              <div className={`center-composer-bubble ${loading ? 'loading' : ''}`}>
                                {loading && <span className="center-composer-spinner" />}
                                {bubbleText.length > 220 ? bubbleText.slice(0, 220) + '…' : bubbleText}
                              </div>
                            )}
                            <div className="center-composer-bar">
                              <input
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={canvasItems.length ? 'Describe another screen or a change…' : 'Describe the screen you want to create…'}
                                disabled={loading}
                              />
                              <button
                                className="center-composer-send"
                                onClick={handleSubmit}
                                disabled={loading || !input.trim()}
                                title="Generate"
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Bottom Combined Toolbar (Tools + Zoom) */}
                      <div className="canvas-toolbar">
                        <button className={`toolbar-btn ${activeTool === 'cursor' ? 'active' : ''}`} onClick={() => setActiveTool('cursor')} title="Select">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l7.07 17 2.51-7.39L21 11.07z" /></svg>
                        </button>
                        <button className={`toolbar-btn ${activeTool === 'hand' ? 'active' : ''}`} onClick={() => setActiveTool('hand')} title="Pan">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 11V6a2 2 0 00-4 0v1M14 10V4a2 2 0 00-4 0v6M10 10.5V5a2 2 0 00-4 0v9" /><path d="M18 11a2 2 0 014 0v3a8 8 0 01-8 8H9a8 8 0 01-3-1L2 17" /></svg>
                        </button>

                        {currentSessionId && (
                          <div style={{ position: 'relative' }}>
                            <button
                              className={`toolbar-btn ${showSharePopover ? 'active' : ''}`}
                              onClick={() => {
                                const userRole = user?.role || effectiveQuota?.plan || 'free';
                                if (userRole === 'trial' || userRole === 'free') {
                                  setShowPricingModal(true);
                                } else {
                                  setShowSharePopover(prev => !prev);
                                }
                              }}
                              title="Share"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                              </svg>
                            </button>
                            {showSharePopover && (
                              <div className="share-popover" onClick={e => e.stopPropagation()}>
                                <button className="share-popover-close" onClick={() => setShowSharePopover(false)}>
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                </button>
                                <p className="share-popover-label">Here's your link</p>
                                <div className="share-popover-url">
                                  <span>{`https://app.inspoai.io/agent-screen/${currentSessionId}`}</span>
                                </div>
                                <div className="share-popover-actions">
                                  <button
                                    className={`share-popover-btn ${shareCopied ? 'copied' : ''}`}
                                    title={shareCopied ? 'Copied!' : 'Copy link'}
                                    onClick={() => {
                                      navigator.clipboard.writeText(`https://app.inspoai.io/agent-screen/${currentSessionId}`);
                                      setShareCopied(true);
                                      setTimeout(() => setShareCopied(false), 2000);
                                    }}
                                  >
                                    {shareCopied ? (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    ) : (
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                                    )}
                                  </button>
                                  <button
                                    className="share-popover-btn share-popover-btn-secondary"
                                    title="Open in new tab"
                                    onClick={() => window.open(`https://app.inspoai.io/agent-screen/${currentSessionId}`, '_blank')}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {canvasItems.length > 0 && (
                          <button
                            className={`toolbar-btn figma-copy-all-btn ${exportAllToast ? 'success' : ''}`}
                            onClick={() => {
                              const userRole = user?.role || effectiveQuota?.plan || 'free';
                              if (userRole === 'trial' || userRole === 'free') {
                                setShowPricingModal(true);
                              } else {
                                handleExportAllToFigma();
                              }
                            }}
                            disabled={exportingAllFigma}
                            title={exportAllToast ? "Copied all to Figma!" : "Copy all to Figma"}
                            style={{ position: 'relative' }}
                          >
                            {exportAllToast ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0ACF83" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            ) : (
                              <svg width="14" height="18" viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: exportingAllFigma ? 0.5 : 1 }}>
                                <path d="M19 28.5C19 23.2533 14.7467 19 9.5 19C4.25329 19 0 23.2533 0 28.5C0 33.7467 4.25329 38 9.5 38H19V28.5Z" fill="#A259FF" />
                                <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38C14.7467 38 19 42.2533 19 47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
                                <path d="M19 0H9.5C4.25329 0 0 4.2533 0 9.5C0 14.7467 4.25329 19 9.5 19H19V0Z" fill="#F24E1E" />
                                <path d="M19 0H28.5C33.7467 0 38 4.2533 38 9.5C38 14.7467 33.7467 19 28.5 19C23.2533 19 19 14.7467 19 9.5V0Z" fill="#FF7262" />
                                <path d="M38 28.5C38 23.2533 33.7467 19 28.5 19C23.2533 19 19 23.2533 19 28.5C19 33.7467 23.2533 38 28.5 38C33.7467 38 38 33.7467 38 28.5Z" fill="#1ABCFE" />
                              </svg>
                            )}
                          </button>
                        )}

                        {canvasItems.length > 0 && (
                          <button
                            className="toolbar-btn"
                            onClick={() => {
                              const userRole = user?.role || effectiveQuota?.plan || 'free';
                              if (userRole === 'trial' || userRole === 'free') {
                                setShowPricingModal(true);
                              } else {
                                handleDownloadCodeZip();
                              }
                            }}
                            disabled={zippingCode}
                            title="Download all code (ZIP)"
                          >
                            {zippingCode ? (
                              <span className="center-composer-spinner" />
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
                              </svg>
                            )}
                          </button>
                        )}

                        {canvasItems.length > 0 && (
                          <div style={{ position: 'relative' }}>
                            <button
                              className={`toolbar-btn ${showThemePopover ? 'active' : ''}`}
                              onClick={() => {
                                const userRole = user?.role || effectiveQuota?.plan || 'free';
                                if (userRole === 'trial' || userRole === 'free') {
                                  setShowPricingModal(true);
                                } else {
                                  setShowThemePopover(p => !p);
                                }
                              }}
                              title="Restyle all screens"
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2.7c-4.8 4.9-7.2 8.5-7.2 11.2a7.2 7.2 0 0 0 14.4 0c0-2.7-2.4-6.3-7.2-11.2z" />
                                <path d="M8.5 14a3.5 3.5 0 0 0 3.5 3.5" />
                              </svg>
                            </button>
                            {showThemePopover && (
                              <div className="theme-popover" onClick={e => e.stopPropagation()}>
                                <div className="theme-popover-head">
                                  <span>Restyle all screens</span>
                                  <button onClick={() => setShowThemePopover(false)}>
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                  </button>
                                </div>
                                <p className="theme-popover-sub">Instant — no regeneration, content stays identical.</p>
                                <div className="theme-popover-grid">
                                  {dnaCatalog.map(d => (
                                    <button
                                      key={d.id}
                                      className={`theme-dna-card ${themeDraft.dnaId === d.id ? 'selected' : ''}`}
                                      onClick={() => setThemeDraft(t => ({ ...t, dnaId: t.dnaId === d.id ? null : d.id }))}
                                      title={d.bestFor?.slice(0, 3).join(', ')}
                                    >
                                      <span className="theme-dna-preview" style={{ background: d.tokens.base }}>
                                        <span style={{ background: d.tokens.surface, borderColor: d.tokens.line }}>
                                          <i style={{ background: d.tokens.accent }} />
                                          <i style={{ background: d.tokens.ink, width: '60%' }} />
                                          <i style={{ background: d.tokens.muted, width: '40%' }} />
                                        </span>
                                      </span>
                                      <span className="theme-dna-name">{d.name}</span>
                                      <span className="theme-dna-fonts">{d.fonts.display}</span>
                                    </button>
                                  ))}
                                </div>
                                <div className="theme-popover-row">
                                  <label>Icons</label>
                                  <div className="theme-popover-seg">
                                    {['lucide', 'tabler'].map(s => (
                                      <button key={s} className={(themeDraft.iconSet || 'lucide') === s ? 'active' : ''} onClick={() => setThemeDraft(t => ({ ...t, iconSet: s }))}>{s}</button>
                                    ))}
                                  </div>
                                </div>
                                <button
                                  className="theme-popover-apply"
                                  disabled={retheming || (!themeDraft.dnaId && !themeDraft.iconSet)}
                                  onClick={() => handleRetheme({
                                    dnaId: themeDraft.dnaId || undefined,
                                    iconSet: themeDraft.iconSet || undefined
                                  })}
                                >
                                  {retheming ? 'Restyling…' : 'Apply to all screens'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="toolbar-divider" />

                        <button className="toolbar-btn" onClick={() => zoomIn()} title="Zoom in">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>
                        <span className="zoom-level">{Math.round(zoomScale * 100)}%</span>
                        <button className="toolbar-btn" onClick={() => zoomOut()} title="Zoom out">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                        </button>

                        <div className="toolbar-divider" />

                        <button onClick={() => resetTransform()} title="Reset zoom" className="toolbar-btn zoom-fit-btn">Fit</button>
                      </div>
                    </>
                  );
                }}
              </TransformWrapper>
            </div>
          </div>
        </>
      )}
      {showAllModal && (
        <div className="agentic-showall-overlay" onClick={() => setShowAllModal(false)}>
          <div className="agentic-showall-modal" onClick={e => e.stopPropagation()}>
            <div className="agentic-showall-header">
              <h2>All Generations <span>({savedSessions.length})</span></h2>
              <button className="agentic-showall-close" onClick={() => setShowAllModal(false)} title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="agentic-showall-body">
              <div className="agentic-showall-grid">
                {savedSessions.map((item, index) => {
                  const title = item.screens?.[0]?.prompt || item.designBrief?.screenType || item.screens?.[0]?.title || 'Untitled Project';
                  const desc = formatRelativeTime(item.updatedAt || item.createdAt);
                  const html = item.screens?.[0]?.html;
                  const platformLabel = item.designBrief?.platform || item.designBrief?.device || item.platform || item.screens?.[0]?.platform || 'ios';

                  return (
                    <div
                      key={item.sessionId || index}
                      className="agentic-showall-card"
                      onClick={() => {
                        loadSession(item);
                        setShowAllModal(false);
                      }}
                    >
                      <div className="agentic-showall-img-wrapper">
                        {html ? (
                          <PremiumGenerationPreview
                            html={html}
                            platform={platformLabel}
                            theme={item.designBrief?.theme}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', background: '#1a1a24', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <ThinkingCurve size={24} />
                          </div>
                        )}
                      </div>
                      <div className="agentic-showall-info">
                        <h4 title={title}>{title}</h4>
                        <div className="agentic-showall-meta">
                          <span className="agentic-showall-time">{desc}</span>
                          <span className="agentic-showall-platform-badge">{platformLabel}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
      {showUpgradePrompt && (
        <div className="agentic-upgrade-modal-overlay" onClick={() => setShowUpgradePrompt(false)}>
          <div className="agentic-upgrade-modal" onClick={e => e.stopPropagation()}>
            <button className="agentic-upgrade-modal-close" onClick={() => setShowUpgradePrompt(false)} title="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <h3>Upgrade to Pro</h3>
            <p>Reference screenshot scans and UI cloning are only available on premium plans. Upgrade to unlock pixel-perfect uploads.</p>
            <div className="agentic-upgrade-modal-actions">
              <button className="agentic-upgrade-modal-btn secondary" onClick={() => setShowUpgradePrompt(false)}>
                Cancel
              </button>
              <button className="agentic-upgrade-modal-btn primary" onClick={() => { setShowUpgradePrompt(false); setShowPricingModal(true); }}>
                Upgrade Plan ✦
              </button>
            </div>
          </div>
        </div>
      )}
      <PricingModal
        isOpen={showPricingModal}
        onClose={() => setShowPricingModal(false)}
        currentPlan={effectiveQuota?.plan || 'free'}
      />

      {/* ── Skill Preview Modal ── */}
      {previewSkill && (
        <div className="skill-preview-overlay" onClick={() => setPreviewSkill(null)}>
          <div className="skill-preview-modal" onClick={e => e.stopPropagation()}>
            <button className="skill-preview-close" onClick={() => setPreviewSkill(null)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            <div className="skill-preview-thumb-lg" style={skillThumbStyle(previewSkill)} />
            <div className="skill-preview-body">
              <div className="skill-preview-meta">
                <span className="skill-preview-category">{previewSkill.category}</span>
                <h3 className="skill-preview-title">{previewSkill.name}</h3>
                <p className="skill-preview-desc">{previewSkill.description}</p>
              </div>
              <button
                className="skill-apply-btn"
                onClick={() => { handleSkillChange(previewSkill.id); setPreviewSkill(null); }}
              >
                Apply Skill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
