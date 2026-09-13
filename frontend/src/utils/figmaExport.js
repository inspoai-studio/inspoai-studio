/**
 * figmaExport.js — Generate SVG for Figma copy-paste
 *
 * Creates an SVG string with screens as base64 <image> elements,
 * flow arrows as <line>/<polygon>, and step labels as <text>.
 * Images are fetched via backend proxy to avoid CORS.
 * Each image's real dimensions are detected so frames match the original aspect ratio.
 */

import { auth } from '../firebase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Layout constants
const TARGET_WIDTH = 240;     // Target display width for each screen
const GAP_X = 60;
const GAP_Y = 24;
const ARROW_WIDTH = 40;
const LABEL_HEIGHT = 30;
const PADDING = 40;

/**
 * Fetch image as base64 via backend proxy AND detect its real pixel dimensions
 * by loading it into an HTML Image element.
 * Returns { base64, width, height }
 */
async function fetchImageWithDimensions(url) {
  let base64;
  try {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${API_BASE}/api/image-proxy?url=${encodeURIComponent(url)}`, { headers });
    const data = await res.json();
    if (!data.base64) throw new Error('No base64 returned');
    base64 = data.base64;
  } catch {
    // Grey placeholder
    const canvas = document.createElement('canvas');
    canvas.width = TARGET_WIDTH;
    canvas.height = Math.round(TARGET_WIDTH * 1.78);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Image', canvas.width / 2, canvas.height / 2);
    base64 = canvas.toDataURL('image/png');
    return { base64, width: canvas.width, height: canvas.height };
  }

  // Load the base64 into an Image to read its real pixel dimensions
  const dims = await new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve({ width: TARGET_WIDTH, height: Math.round(TARGET_WIDTH * 1.78) });
    img.src = base64;
  });

  return { base64, width: dims.width, height: dims.height };
}

/**
 * Scale real image dimensions to a target display width, preserving aspect ratio.
 */
function scaleToWidth(realW, realH, targetW) {
  if (realW <= 0 || realH <= 0) return { width: targetW, height: Math.round(targetW * 1.78) };
  const aspect = realW / realH;
  return { width: targetW, height: Math.round(targetW / aspect) };
}

function escapeXml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Generate SVG string from a curated flow (async — fetches images first via proxy).
 */
export async function generateFlowSVG(curation) {
  if (curation.type === 'flow') {
    return generateFlowTypeSVG(curation);
  } else {
    return generateCollectionSVG(curation);
  }
}

async function generateFlowTypeSVG(curation) {
  const { steps, title } = curation;

  // Pre-fetch all images and detect their real dimensions
  const allScreens = steps.flatMap(s => s.screens);
  const imageDataMap = new Map();
  await Promise.all(allScreens.map(async (screen) => {
    const url = screen.fullImage || screen.image;
    if (url && !imageDataMap.has(url)) {
      imageDataMap.set(url, await fetchImageWithDimensions(url));
    }
  }));

  // Calculate display sizes from real image dimensions
  const stepSizes = steps.map(step =>
    step.screens.map(screen => {
      const url = screen.fullImage || screen.image;
      const imgData = imageDataMap.get(url);
      return imgData
        ? scaleToWidth(imgData.width, imgData.height, TARGET_WIDTH)
        : { width: TARGET_WIDTH, height: Math.round(TARGET_WIDTH * 1.78) };
    })
  );

  // Find the tallest column to set SVG height
  const maxStepHeight = Math.max(...stepSizes.map(sizes =>
    sizes.reduce((sum, s) => sum + s.height + GAP_Y + 20, 0)
  ), 400);

  const totalWidth = PADDING * 2 + steps.length * (TARGET_WIDTH + ARROW_WIDTH) - ARROW_WIDTH;
  const totalHeight = PADDING * 2 + LABEL_HEIGHT + maxStepHeight + 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`;
  svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="#fafafa" rx="8"/>`;
  svg += `<text x="${PADDING}" y="${PADDING + 20}" font-family="Geist, sans-serif" font-size="18" font-weight="600" fill="#111">${escapeXml(title)}</text>`;

  let x = PADDING;
  const startY = PADDING + 50;

  steps.forEach((step, stepIndex) => {
    svg += `<rect x="${x}" y="${startY}" width="${TARGET_WIDTH}" height="${LABEL_HEIGHT}" rx="6" fill="#f3f4f6" stroke="#e5e7eb"/>`;
    svg += `<text x="${x + TARGET_WIDTH / 2}" y="${startY + LABEL_HEIGHT / 2 + 4}" font-family="Geist, sans-serif" font-size="11" font-weight="600" fill="#555" text-anchor="middle">${escapeXml(step.label.toUpperCase())}</text>`;

    let screenY = startY + LABEL_HEIGHT + 12;
    step.screens.forEach((screen, screenIndex) => {
      const imgUrl = screen.fullImage || screen.image;
      const imgData = imageDataMap.get(imgUrl);
      const dataUri = imgData?.base64 || '';
      const size = stepSizes[stepIndex][screenIndex];

      // Frame matches exact image proportions — no stretching
      svg += `<rect x="${x}" y="${screenY}" width="${size.width}" height="${size.height}" rx="10" fill="#fff" stroke="#e5e7eb"/>`;
      svg += `<image href="${dataUri}" x="${x}" y="${screenY}" width="${size.width}" height="${size.height}" preserveAspectRatio="none" clip-path="inset(0 round 10px)"/>`;
      svg += `<text x="${x + size.width / 2}" y="${screenY + size.height + 14}" font-family="Geist, sans-serif" font-size="10" fill="#888" text-anchor="middle">${escapeXml((screen.title || '').substring(0, 25))}</text>`;

      screenY += size.height + GAP_Y + 20;
    });

    if (stepIndex < steps.length - 1) {
      const arrowX1 = x + TARGET_WIDTH + 8;
      const arrowX2 = arrowX1 + ARROW_WIDTH - 16;
      const firstSize = stepSizes[stepIndex][0] || { height: 400 };
      const arrowY = startY + LABEL_HEIGHT + firstSize.height / 2 + 12;
      svg += `<line x1="${arrowX1}" y1="${arrowY}" x2="${arrowX2}" y2="${arrowY}" stroke="#bbb" stroke-width="1.5"/>`;
      svg += `<polygon points="${arrowX2},${arrowY - 4} ${arrowX2 + 8},${arrowY} ${arrowX2},${arrowY + 4}" fill="#bbb"/>`;
    }

    x += TARGET_WIDTH + ARROW_WIDTH;
  });

  svg += '</svg>';
  return svg;
}

async function generateCollectionSVG(curation) {
  const { screens, title } = curation;

  const imageDataMap = new Map();
  await Promise.all(screens.map(async (screen) => {
    const url = screen.fullImage || screen.image;
    if (url && !imageDataMap.has(url)) {
      imageDataMap.set(url, await fetchImageWithDimensions(url));
    }
  }));

  // Calculate per-screen dimensions from real image data
  const screenSizes = screens.map(screen => {
    const url = screen.fullImage || screen.image;
    const imgData = imageDataMap.get(url);
    return imgData
      ? scaleToWidth(imgData.width, imgData.height, TARGET_WIDTH)
      : { width: TARGET_WIDTH, height: Math.round(TARGET_WIDTH * 1.78) };
  });

  const COLS = 4;
  const rows = Math.ceil(screens.length / COLS);
  const maxRowHeight = Math.max(...screenSizes.map(s => s.height), 300);
  const totalWidth = PADDING * 2 + COLS * (TARGET_WIDTH + GAP_X) - GAP_X;
  const totalHeight = PADDING * 2 + rows * (maxRowHeight + GAP_Y) + 60;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`;
  svg += `<rect width="${totalWidth}" height="${totalHeight}" fill="#fafafa" rx="8"/>`;
  svg += `<text x="${PADDING}" y="${PADDING + 20}" font-family="Geist, sans-serif" font-size="18" font-weight="600" fill="#111">${escapeXml(title)}</text>`;

  screens.forEach((screen, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const size = screenSizes[i];
    const imgUrl = screen.fullImage || screen.image;
    const imgData = imageDataMap.get(imgUrl);
    const dataUri = imgData?.base64 || '';
    const x = PADDING + col * (TARGET_WIDTH + GAP_X);
    const y = PADDING + 50 + row * (maxRowHeight + GAP_Y);

    svg += `<rect x="${x}" y="${y}" width="${size.width}" height="${size.height}" rx="10" fill="#fff" stroke="#e5e7eb"/>`;
    svg += `<image href="${dataUri}" x="${x}" y="${y}" width="${size.width}" height="${size.height}" preserveAspectRatio="none" clip-path="inset(0 round 10px)"/>`;
  });

  svg += '</svg>';
  return svg;
}

/**
 * Copy SVG to clipboard for Figma paste.
 */
export async function copyToClipboard(svgString) {
  try {
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    const textBlob = new Blob([svgString], { type: 'text/plain' });
    const clipboardItem = new ClipboardItem({
      'image/svg+xml': svgBlob,
      'text/plain': textBlob,
    });
    await navigator.clipboard.write([clipboardItem]);
    return true;
  } catch (err) {
    console.warn('ClipboardItem failed, falling back to writeText:', err);
    try {
      await navigator.clipboard.writeText(svgString);
      return true;
    } catch (err2) {
      const textarea = document.createElement('textarea');
      textarea.value = svgString;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    }
  }
}
