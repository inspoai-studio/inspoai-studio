/**
 * agentic-v3/retheme.js
 *
 * One-click global restyle with ZERO LLM calls.
 *
 * Works because v3 screens keep all styling in the deterministic <head>
 * (design-token Tailwind config + font links) while the model-written body
 * only uses semantic classes (bg-base, text-ink, bg-accent, font-display...).
 * Rethene = re-wrap the same body with a new head, plus a hex-map pass for
 * literal colors inside Chart.js configs, and an optional icon-set swap.
 */

import { getDNA } from './dna.js';
import { wrapScreen, extractBody, isV3Document, dnaIdFromDocument } from './runtime.js';

// Icon sets whose names are broadly compatible with lucide's
const ICON_SETS = ['lucide', 'tabler'];

function buildGoogleFontsUrl(families) {
  const parts = [...new Set(families.filter(Boolean))]
    .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** Build the effective DNA from base + overrides (palette / fonts). */
export function resolveThemedDNA(baseDna, overrides = {}) {
  let dna = { ...baseDna, tokens: { ...baseDna.tokens }, fonts: { ...baseDna.fonts } };

  if (overrides.palette && typeof overrides.palette === 'object') {
    const p = overrides.palette;
    dna.tokens = {
      base: p.background || dna.tokens.base,
      surface: p.surface || dna.tokens.surface,
      raised: p.raised || p.surface || dna.tokens.raised,
      line: p.border || dna.tokens.line,
      ink: p.textPrimary || dna.tokens.ink,
      muted: p.textSecondary || dna.tokens.muted,
      accent: p.primary || p.accent || dna.tokens.accent,
      accentInk: p.accentInk || dna.tokens.accentInk,
      accent2: p.accent2 || dna.tokens.accent2
    };
    if (p.name) dna.name = p.name;
  }

  if (overrides.headingFont || overrides.bodyFont) {
    const display = overrides.headingFont || dna.fonts.display;
    const body = overrides.bodyFont || dna.fonts.body;
    dna.fonts = {
      display, body, mono: dna.fonts.mono,
      googleUrl: buildGoogleFontsUrl([display, body, dna.fonts.mono])
    };
  }
  return dna;
}

/**
 * Restyle one v3 screen document. Returns the new document, or null if the
 * input is not a v3 document (caller should surface that).
 */
export function rethemeScreen(html, overrides = {}) {
  if (!isV3Document(html)) return null;

  const currentDnaId = dnaIdFromDocument(html);
  const baseDna = getDNA(overrides.dnaId) || getDNA(currentDnaId);
  if (!baseDna) return null;

  const oldDna = getDNA(currentDnaId) || baseDna;
  const newDna = resolveThemedDNA(baseDna, overrides);

  let body = extractBody(html);

  // Literal hex values (Chart.js configs, inline styles) — map old token hexes
  // to their new counterparts, longest-first to avoid partial matches.
  const pairs = Object.keys(oldDna.tokens)
    .map(k => [oldDna.tokens[k], newDna.tokens[k]])
    .filter(([a, b]) => a && b && a.toLowerCase() !== b.toLowerCase())
    .sort((a, b) => b[0].length - a[0].length);
  for (const [oldHex, newHex] of pairs) {
    body = body.replace(new RegExp(oldHex.replace('#', '#?'), 'gi'), (m) =>
      m.startsWith('#') ? newHex : newHex.slice(1));
  }

  // Optional icon-set swap on iconify prefixes
  if (overrides.iconSet && ICON_SETS.includes(overrides.iconSet)) {
    body = body.replace(/icon="(?:lucide|tabler):/g, `icon="${overrides.iconSet}:`);
  }

  const platformMatch = html.match(/name="inspoai-platform" content="(\w+)"/);
  const titleMatch = html.match(/<title>([^<]*)<\/title>/);

  return wrapScreen(newDna, body, {
    title: titleMatch ? titleMatch[1].replace(/&amp;/g, '&') : 'Screen',
    platform: platformMatch ? platformMatch[1] : 'web'
  });
}

/** Restyle a batch of screens. Non-v3 screens pass through unchanged (flagged). */
export function rethemeScreens(screens = [], overrides = {}) {
  return screens.map((s) => {
    const html = typeof s === 'string' ? s : s?.html;
    const out = rethemeScreen(html, overrides);
    return {
      index: s?.index,
      title: s?.title,
      html: out || html,
      rethemed: Boolean(out)
    };
  });
}
