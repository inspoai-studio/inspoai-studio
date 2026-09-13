/**
 * agentic-v3/dna.js
 *
 * Design DNA library — hand-curated design systems the model MUST use.
 * The model never invents hex codes or font pairings; it picks a DNA
 * and assembles within it. This is the anti-slop core of the v3 engine.
 *
 * Each DNA: tokens (colors/fonts/radius/shadow), hard rules (do/don't),
 * and concrete component recipes so every screen in a set looks related.
 */

import { SIGNATURES } from './signatures.js';

export const DESIGN_DNA = [
  {
    id: 'soft-pastel-studio',
    name: 'Soft Pastel Studio',
    theme: 'light',
    thumbnail: '/skills/soft-pastel-studio.png',
    bestFor: ['analytics dashboard', 'admin panel', 'saas dashboard', 'ecommerce dashboard', 'crm', 'finance app', 'inventory', 'metrics', 'reporting', 'startup app'],
    tokens: {
      base: '#EDF0EF', surface: '#FFFFFF', raised: '#F5F7F6', line: '#E4E9E7',
      ink: '#161D1A', muted: '#7C8781', accent: '#3B82F6', accentInk: '#FFFFFF',
      accent2: '#F4C542'
    },
    fonts: {
      display: 'Inter Tight', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '1.125rem',
    shadow: 'shadow-[0_1px_2px_rgba(22,29,26,0.04)] on cards; deeper shadow only on popovers',
    rules: [
      'The Dribbble-dashboard look: soft mint/gray base, generous white rounded-card cards with visible breathing room (gap-5, p-6).',
      'Nested card depth: big cards contain smaller bg-raised inner cards/wells — never flat single-level layouts.',
      'Fixed data palette, used consistently: blue #3B82F6, green #34C08B, yellow #F4C542, pink #F16BA9, violet #8B5CF6. Legends use colored dots (h-2 w-2 rounded-full) + muted labels.',
      'Big numbers are heroes: font-display font-bold text-3xl/4xl tracking-tight tabular-nums, with a small tinted delta chip next to them (bg-green-50 text-green-600 rounded-full px-2 py-0.5 text-xs, ↗/↘ arrows).',
      'Charts are chunky and friendly: bar charts with borderRadius 8+ and thick rounded bars; doughnuts with cutout ≥ 72% and a bold centered number; gauges as half-doughnuts. Never dense gridlines.',
      'Icon chips everywhere: h-9 w-9 grid place-items-center rounded-xl with soft tints (bg-blue-50 text-blue-500, bg-pink-50 text-pink-500...).',
      'Sidebar: white, icon + label rows, section labels, keyboard hints (⌘N), user card pinned at bottom with avatar + email.',
      'ONE hero moment allowed per screen: a single card with a soft mesh-gradient or duotone image background for the headline metric.',
      'NEVER use: dark sections, hard borders on cards (shadow + bg contrast instead, border-line only for dividers), cramped spacing, more than 5 data colors, emoji.'
    ]
  },
  {
    id: 'editorial-luxe',
    name: 'Editorial Luxe',
    theme: 'light',
    thumbnail: '/skills/editorial-luxe.png',
    bestFor: ['fashion', 'beauty', 'luxury', 'magazine', 'portfolio', 'travel', 'hospitality', 'real estate', 'architecture', 'brand landing'],
    tokens: {
      base: '#F7F4EF', surface: '#FFFFFF', raised: '#EFEAE2', line: '#E2DCD2',
      ink: '#191714', muted: '#6E675C', accent: '#8A5A2B', accentInk: '#FFFFFF',
      accent2: '#3F3A33'
    },
    fonts: {
      display: 'Fraunces', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '0.25rem',
    shadow: 'none — use 1px lines and tone shifts for separation, never drop shadows',
    rules: [
      'Headlines in Fraunces at font-light or font-normal, tracking-tight, very large (text-5xl to text-7xl on web hero). Never bold display type.',
      'Use italic Fraunces for one or two emphasized words inside headlines.',
      'Whitespace is the luxury: sections get py-24 or more on web, generous max-w-6xl mx-auto.',
      'Thin horizontal rules (border-t border-line) to divide sections, like a magazine.',
      'Small uppercase labels: text-xs uppercase tracking-[0.2em] text-muted, used above headlines.',
      'Photography-forward: large images, muted tone, no rounded corners beyond rounded-sm.',
      'Buttons: rectangular, px-8 py-3.5, bg-ink text-base-token or outlined border-ink; uppercase text-xs tracking-widest.',
      'NEVER use: gradients, glassmorphism, colored cards, drop shadows, emoji, more than one accent color per screen.'
    ]
  },
  {
    id: 'swiss-mono',
    name: 'Swiss Mono Grid',
    theme: 'light',
    thumbnail: '/skills/swiss-mono.png',
    bestFor: ['agency', 'studio', 'developer portfolio', 'design tool', 'consultancy', 'architecture firm', 'documentation'],
    tokens: {
      base: '#FAFAF8', surface: '#FFFFFF', raised: '#F0F0EC', line: '#D9D9D2',
      ink: '#111110', muted: '#6B6B64', accent: '#FF4D00', accentInk: '#FFFFFF',
      accent2: '#111110'
    },
    fonts: {
      display: 'Space Grotesk', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '0px',
    shadow: 'none — flat planes separated by 1px borders',
    rules: [
      'Strict grid: visible 1px borders between cells (divide-x divide-y divide-line, border border-line). Cells are the design.',
      'Index numbers everywhere: 01, 02, 03 in mono font text-xs text-muted before section titles.',
      'Display type: Space Grotesk font-medium, tight leading, sentence case.',
      'Meta info in IBM Plex Mono text-xs uppercase (dates, tags, coordinates, file sizes).',
      'One loud accent (orange #FF4D00) used surgically: one word, one button, one hover state per screen.',
      'Hover states invert: black cell → accent or white→black. Use transition-colors.',
      'Buttons: square corners, border border-ink, hover:bg-ink hover:text-white, mono uppercase text-xs.',
      'NEVER use: rounded corners, shadows, gradients, pastel colors, center-aligned body text, emoji.'
    ]
  },
  {
    id: 'midnight-terminal',
    name: 'Midnight Terminal',
    theme: 'dark',
    thumbnail: '/skills/midnight-terminal.png',
    bestFor: ['developer tool', 'API', 'infrastructure', 'analytics', 'security', 'CLI product', 'devops', 'database', 'AI infra'],
    tokens: {
      base: '#0A0A0B', surface: '#131316', raised: '#1C1C21', line: '#26262C',
      ink: '#F4F4F5', muted: '#8E8E98', accent: '#A3E635', accentInk: '#0A0A0B',
      accent2: '#5EEAD4'
    },
    fonts: {
      display: 'Inter', body: 'Inter', mono: 'JetBrains Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
    },
    radius: '0.5rem',
    shadow: 'subtle: shadow-[0_0_0_1px_rgba(255,255,255,0.04)] — rely on borders, not glow',
    rules: [
      'Terminal aesthetic: code blocks, mono labels, status dots (h-1.5 w-1.5 rounded-full bg-accent).',
      'Display type: Inter font-semibold tracking-tight; technical strings in JetBrains Mono.',
      'Lime accent (#A3E635) is for signal only: live states, primary CTA, key metrics. Never backgrounds of large areas.',
      'Cards: bg-surface border border-line rounded-lg; nested wells use bg-raised.',
      'Show realistic technical content: latency numbers, commit hashes, log lines, uptime percentages.',
      'Tables and data: mono font for numbers, tabular-nums, right-aligned numeric columns.',
      'Buttons: primary bg-accent text-accentInk font-medium rounded-md; secondary border border-line hover:bg-raised.',
      'NEVER use: purple/blue gradients, glassmorphism blur cards, glow shadows, emoji, stock photos of people.'
    ]
  },
  {
    id: 'soft-productivity',
    name: 'Soft Productivity',
    theme: 'light',
    thumbnail: '/skills/soft-productivity.png',
    bestFor: ['SaaS dashboard', 'project management', 'CRM', 'notes', 'calendar', 'HR tool', 'admin panel', 'b2b app'],
    tokens: {
      base: '#F9F9F8', surface: '#FFFFFF', raised: '#F1F1EF', line: '#E4E4E1',
      ink: '#1C1C1A', muted: '#71716C', accent: '#2563EB', accentInk: '#FFFFFF',
      accent2: '#0D9488'
    },
    fonts: {
      display: 'Inter Tight', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '0.625rem',
    shadow: 'shadow-[0_1px_2px_rgba(0,0,0,0.04)] on cards; shadow-[0_8px_24px_rgba(0,0,0,0.08)] only for popovers/modals',
    rules: [
      'Calm neutral surfaces; color appears only in data (charts, status badges, avatars) and the primary button.',
      'Density done right: 13-14px body text in app shells, 8px grid, row heights ~44px.',
      'Status badges: soft tinted pills — bg-blue-50 text-blue-700, bg-teal-50 text-teal-700, bg-amber-50 text-amber-700, with text-xs font-medium.',
      'Sidebar: bg-base with active item bg-raised text-ink font-medium rounded-md; inactive text-muted.',
      'Realistic workspace data: person names, project titles, dates, percentages. No "Item 1".',
      'Charts: single accent color plus gray; thin lines; no chart junk.',
      'Buttons: primary bg-accent, secondary bg-surface border border-line, both rounded-lg text-sm font-medium.',
      'NEVER use: dark hero sections, gradients, big rounded-3xl cards, oversized type in app UI, emoji.'
    ]
  },
  {
    id: 'warm-organic',
    name: 'Warm Organic',
    theme: 'light',
    thumbnail: '/skills/warm-organic.png',
    bestFor: ['wellness', 'food', 'health', 'meditation', 'fitness', 'kids', 'education', 'community', 'sustainability', 'coaching'],
    tokens: {
      base: '#FBF7F0', surface: '#FFFFFF', raised: '#F3EBDD', line: '#E7DCC8',
      ink: '#2D2A24', muted: '#7A7264', accent: '#C4622D', accentInk: '#FFFFFF',
      accent2: '#5F7A5A'
    },
    fonts: {
      display: 'Fraunces', body: 'DM Sans', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400&display=swap'
    },
    radius: '1rem',
    shadow: 'shadow-[0_2px_12px_rgba(45,42,36,0.06)] — soft and warm, never harsh',
    rules: [
      'Cream base with terracotta + sage accents; feels like paper and clay, not plastic.',
      'Display type: Fraunces font-medium; friendly but not childish. Body: DM Sans.',
      'Generous rounded corners (rounded-2xl cards, rounded-full buttons and pills).',
      'Organic details: rounded-full image masks, arch shapes (rounded-t-full), soft blob background circles in raised tone.',
      'Both accents get used: terracotta for primary actions, sage for secondary highlights/success.',
      'Photography: warm, natural light, food/people/nature. Duotone-feel is welcome.',
      'Buttons: rounded-full px-6 py-3 bg-accent text-accentInk font-medium (DM Sans).',
      'NEVER use: pure white base, cold grays, sharp corners, neon colors, dark mode, emoji as icons.'
    ]
  },
  {
    id: 'brutalist-pop',
    name: 'Brutalist Pop',
    theme: 'light',
    thumbnail: '/skills/brutalist-pop.png',
    bestFor: ['e-commerce', 'streetwear', 'creator tool', 'music', 'events', 'gen-z brand', 'newsletter', 'marketplace', 'ticketing'],
    tokens: {
      base: '#F2EFE9', surface: '#FFFFFF', raised: '#FFD02F', line: '#111110',
      ink: '#111110', muted: '#55554F', accent: '#FF5941', accentInk: '#111110',
      accent2: '#2B6CFF'
    },
    fonts: {
      display: 'Archivo', body: 'Space Grotesk', mono: 'Space Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Space+Grotesk:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap'
    },
    radius: '0px',
    shadow: 'hard offset: shadow-[4px_4px_0_#111110] — solid black, no blur, ever',
    rules: [
      'Everything has a 2px black border: border-2 border-ink. Cards, buttons, images, inputs.',
      'Hard shadows shadow-[4px_4px_0_#111110]; on hover translate -translate-x-0.5 -translate-y-0.5 with bigger shadow.',
      'Display type: Archivo font-black uppercase, huge and tight (tracking-tight leading-[0.95]).',
      'Color blocking: whole sections in raised yellow or accent red/blue; text stays black.',
      'Marquee strips, star shapes (★ as text is allowed here), price tags, sticker-like rotated badges (rotate-2).',
      'Buttons: border-2 border-ink bg-accent or bg-raised, uppercase font-bold, hard shadow.',
      'Playful but precise: chaos in color, discipline in the grid.',
      'NEVER use: rounded corners except rounded-full pills, soft shadows, gradients, thin gray text, pastels.'
    ]
  },
  {
    id: 'aurora-fintech',
    name: 'Aurora Fintech Dark',
    theme: 'dark',
    thumbnail: '/skills/aurora-fintech.png',
    bestFor: ['fintech', 'crypto', 'banking app', 'trading', 'AI product landing', 'web3', 'payments', 'investing'],
    tokens: {
      base: '#07090D', surface: '#0E1117', raised: '#161B24', line: '#232B38',
      ink: '#EDF1F7', muted: '#7D8794', accent: '#4ADE80', accentInk: '#07090D',
      accent2: '#38BDF8'
    },
    fonts: {
      display: 'Sora', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '0.75rem',
    shadow: 'none on cards (border-based); ONE ambient glow allowed per screen behind hero/balance number',
    rules: [
      'Deep blue-black base, not pure black. Cards separated by border border-line, not shadows.',
      'Money numbers are the heroes: Sora font-semibold text-4xl+ with tabular-nums, e.g. $24,590.30.',
      'Green accent = positive/CTA, sky accent2 = informational. Red only for negative deltas (text-red-400).',
      'ONE radial glow max per screen: absolute rounded-full bg-accent/20 blur-[100px] behind the key number or hero — never page-wide gradients.',
      'Mono font for addresses, card numbers, transaction ids.',
      'Sparklines and charts: thin accent lines, no fills heavier than /10 opacity, no gridlines.',
      'Buttons: primary bg-accent text-accentInk font-semibold rounded-xl; secondary bg-raised border border-line.',
      'NEVER use: purple-pink gradients, glass blur everywhere, neon borders, more than one glow, emoji.'
    ]
  },
  {
    id: 'paper-ledger',
    name: 'Paper Ledger',
    theme: 'light',
    thumbnail: '/skills/paper-technical.png',
    bestFor: ['accounting', 'invoicing', 'b2b fintech', 'legal', 'insurance', 'enterprise', 'reports', 'tax', 'procurement'],
    tokens: {
      base: '#F6F5F1', surface: '#FFFFFF', raised: '#ECEBE4', line: '#DBD9CF',
      ink: '#1B211D', muted: '#67706A', accent: '#1E5A3C', accentInk: '#FFFFFF',
      accent2: '#8A5A2B'
    },
    fonts: {
      display: 'IBM Plex Sans', body: 'IBM Plex Sans', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap'
    },
    radius: '0.375rem',
    shadow: 'none — ledger lines and tone. Paper does not glow.',
    rules: [
      'Feels like beautifully typeset financial paper: forest green ink on warm off-white.',
      'ALL numbers in IBM Plex Mono with tabular-nums, right-aligned in tables, two decimals.',
      'Tables are first-class: header row text-xs uppercase tracking-wider text-muted border-b-2 border-ink/10; rows border-b border-line.',
      'Document details: reference numbers (INV-2024-0847), stamps, dotted leader lines (border-dotted), totals rows with border-t-2 border-ink.',
      'Accent green for confirmed/paid states and primary buttons only. Amber accent2 for pending.',
      'Display type: IBM Plex Sans font-semibold, modest sizes; this DNA whispers.',
      'Buttons: rounded-md bg-accent text-accentInk text-sm font-medium; secondary border border-line bg-surface.',
      'NEVER use: bright colors, big rounded cards, shadows, hero sections with images, emoji, decorative icons.'
    ]
  },
  {
    id: 'ios-glass-native',
    name: 'iOS Native Soft',
    theme: 'light',
    thumbnail: '/skills/glass-clock.png',
    bestFor: ['ios app', 'mobile consumer', 'social', 'habit tracker', 'utility app', 'messaging', 'photos', 'lifestyle mobile'],
    tokens: {
      base: '#F2F2F7', surface: '#FFFFFF', raised: '#E9E9EF', line: '#E2E2E8',
      ink: '#0B0B0F', muted: '#8A8A93', accent: '#0A84FF', accentInk: '#FFFFFF',
      accent2: '#FF9F0A'
    },
    fonts: {
      display: 'Inter Tight', body: 'Inter', mono: 'IBM Plex Mono',
      googleUrl: 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap'
    },
    radius: '1.25rem',
    shadow: 'shadow-[0_1px_3px_rgba(0,0,0,0.05)] on cards; the system-gray base does the separation',
    rules: [
      'Native iOS feel: grouped rounded-[1.25rem] white cards on system gray base, 17px-ish body, 34px bold large titles.',
      'Large title header: text-3xl font-bold (Inter Tight) with a small subtitle date/label above in text-muted.',
      'List rows: h-12+, icon in tinted rounded-lg square (h-8 w-8 grid place-items-center), chevron-right in text-muted at row end.',
      'Segmented controls, pill filters, and bottom tab bar (5 items max, active in accent).',
      'System colors for semantics: green #30D158 success, red #FF453A destructive, orange accent2 warnings.',
      'Realistic status bar content (9:41, signal/wifi/battery) when a full phone screen is composed.',
      'Buttons: full-width rounded-2xl h-12 bg-accent text-white font-semibold; text buttons in accent.',
      'NEVER use: desktop layouts, hover-dependent UI, dense tables, sharp corners, emoji as icons.'
    ]
  }
];

export function getDNA(id) {
  return DESIGN_DNA.find(d => d.id === id) || SIGNATURES.find(s => s.id === id)?.dna || null;
}

/** Compact catalog string used inside the brief prompt so the model can choose. */
export function dnaCatalogForPrompt() {
  return DESIGN_DNA.map(d =>
    `- "${d.id}" (${d.theme}): ${d.name} — best for: ${d.bestFor.join(', ')}`
  ).join('\n');
}

/** Keyword fallback selection if the model picks an invalid id. */
export function selectDNAFallback(text = '', theme = null) {
  const t = String(text).toLowerCase();
  let best = null, bestScore = 0;
  for (const d of DESIGN_DNA) {
    let score = 0;
    for (const kw of d.bestFor) {
      const words = kw.split(/\s+/);
      if (words.some(w => w.length > 3 && t.includes(w))) score++;
    }
    if (theme && d.theme === theme) score += 0.5;
    if (score > bestScore) { bestScore = score; best = d; }
  }
  if (best) return best;
  return getDNA(theme === 'dark' ? 'midnight-terminal' : 'soft-productivity');
}

/** Serialize a DNA into the system-prompt block the composer must obey. */
export function dnaPromptBlock(dna) {
  return `DESIGN DNA: "${dna.name}" (locked — you may not deviate)
COLOR TOKENS (already wired into Tailwind — use ONLY these class names for color):
  bg-base (${dna.tokens.base})  bg-surface (${dna.tokens.surface})  bg-raised (${dna.tokens.raised})
  border-line (${dna.tokens.line})  text-ink (${dna.tokens.ink})  text-muted (${dna.tokens.muted})
  accent: bg-accent / text-accent / border-accent (${dna.tokens.accent}), text on accent = text-accentInk (${dna.tokens.accentInk})
  secondary accent: bg-accent2 / text-accent2 (${dna.tokens.accent2})
  Opacity variants allowed: e.g. bg-accent/10, border-ink/10.
  Semantic exceptions allowed ONLY for status: text-red-*, text-green-*, bg-*-50 badge tints where the DNA rules mention them.
FONTS (already loaded): font-display = ${dna.fonts.display}, font-body = ${dna.fonts.body} (default), font-mono = ${dna.fonts.mono}.
RADIUS: default card radius is ${dna.radius} (class: rounded-card).
SHADOW POLICY: ${dna.shadow}
DNA RULES (hard constraints):
${dna.rules.map(r => `- ${r}`).join('\n')}`;
}
