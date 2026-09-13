/**
 * agentic-v3/pipeline.js
 *
 * The v3 agentic UI engine: 4 stages instead of 13.
 *
 *   1. BRIEF   — one call: product identity, screen list, Design DNA choice
 *   2. COPY    — one call: real copywriting for every screen (slop killer #1)
 *   3. COMPOSE — one call per screen (parallel): HTML fragment under a locked DNA
 *   4. QA      — deterministic lint (free) + at most 2 targeted LLM repairs
 *
 * Output: standalone HTML documents (Tailwind CDN + Alpine + iconify + Chart.js).
 * No Babel, no JSX, no compile step — nothing that can white-screen.
 *
 * Callback contract matches runV2Pipeline so the existing routes plug in as-is.
 */

import { chat, chatJSON, chatStream, cleanHtmlResponse } from './llm.js';
import { getDNA, dnaCatalogForPrompt, selectDNAFallback, dnaPromptBlock, DESIGN_DNA } from './dna.js';
import { getSignature, signatureStyleOptions, buildSignatureImages } from './signatures.js';
import { matchPatterns } from './patterns.js';
import { wrapScreen } from './runtime.js';
import { lintAndFix, needsRepair } from './lint.js';


const BANNED_COPY = 'unlock, unleash, empower, supercharge, seamless, effortless, revolutionize, elevate, next-level, game-changing, cutting-edge, "Welcome to the future"';

const BYPASS_KEYWORDS = [
  'you decide', 'you deceide', 'you decied', 'you deiced',
  'decide everything', 'deceide everything', 'choose the colors', 'choose the font',
  'use your judgment', 'use your judgement', 'create it directly', 'surprise me',
  'up to you', 'go ahead', 'decide the color', 'deceide the color'
];

// ── Helpers ──────────────────────────────────────────────────────────────

function dnaToLegacyPalette(dna) {
  return {
    name: dna.name,
    theme: dna.theme,
    background: dna.tokens.base,
    surface: dna.tokens.surface,
    primary: dna.tokens.accent,
    accent: dna.tokens.accent,
    accent2: dna.tokens.accent2,
    supporting: dna.tokens.accent2,
    textPrimary: dna.tokens.ink,
    textSecondary: dna.tokens.muted,
    border: dna.tokens.line
  };
}

function buildGoogleFontsUrl(families) {
  const parts = families
    .filter(Boolean)
    .map(f => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;500;600;700`);
  return `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
}

/** Honor user-locked palette/fonts from the frontend without breaking DNA discipline. */
function applyUserOverrides(dna, designChoices = {}) {
  let d = dna;
  if (designChoices?.paletteLocked && designChoices?.palette) {
    const p = designChoices.palette;
    d = {
      ...d,
      name: `${d.name} (custom palette)`,
      tokens: {
        base: p.background || d.tokens.base,
        surface: p.surface || d.tokens.surface,
        raised: p.surface || d.tokens.raised,
        line: p.border || d.tokens.line,
        ink: p.textPrimary || d.tokens.ink,
        muted: p.textSecondary || d.tokens.muted,
        accent: p.primary || p.accent || d.tokens.accent,
        accentInk: p.background || '#FFFFFF',
        accent2: p.accent2 || d.tokens.accent2
      }
    };
  }
  if (designChoices?.headingFont) {
    const display = designChoices.headingFont;
    const body = designChoices.bodyFont || designChoices.headingFont;
    d = {
      ...d,
      fonts: {
        display, body, mono: dna.fonts.mono,
        googleUrl: buildGoogleFontsUrl([...new Set([display, body, dna.fonts.mono])])
      }
    };
  }
  return d;
}

async function fetchUnsplashImages(queries = [], perQuery = 3) {
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!apiKey || !queries.length) return [];
  const all = [];
  await Promise.all(queries.slice(0, 4).map(async (q) => {
    try {
      const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=${perQuery}&orientation=landscape&content_filter=high`;
      const res = await fetch(url, {
        headers: { Authorization: `Client-ID ${apiKey}` },
        signal: AbortSignal.timeout(6000)
      });
      if (!res.ok) return;
      const data = await res.json();
      for (const r of data.results || []) {
        all.push({ url: `${r.urls.raw}&w=1200&q=80&fm=jpg&fit=crop`, alt: r.alt_description || q });
      }
    } catch (e) {
      console.warn(`  [Warning] [v3] Unsplash "${q}" failed: ${e.message}`);
    }
  }));
  return all.slice(0, 10);
}

// ── Stage 0: Clarify (kept compatible with the old first-message flow) ───

/** Only trust an explicit platform/theme mention in the user's own words —
 *  a model guess here would override the platform button in the UI. */
function explicitPlatform(text = '') {
  const t = String(text).toLowerCase();
  if (/\b(ios|iphone|mobile app|mobile screen|android|phone app)\b/.test(t)) return 'ios';
  if (/\b(ipad|tablet)\b/.test(t)) return 'tablet';
  if (/\b(web|website|desktop|landing page|webapp|web app|dashboard)\b/.test(t)) return 'web';
  return null;
}
function explicitTheme(text = '') {
  const t = String(text).toLowerCase();
  if (/\bdark\b/.test(t)) return 'dark';
  if (/\blight\b/.test(t)) return 'light';
  return null;
}

async function stageClarify(prompt) {
  const dnaGuess = selectDNAFallback(prompt);
  const systemPrompt = `You are a senior product designer taking a UI brief. The user just described what they want.
Ask 2-3 sharp clarifying questions a real designer would ask. Plain English, no emojis.
Use line breaks with arrow markers (→). Do NOT ask about things the user already specified.

Also produce the same questions as STRUCTURED multiple-choice cards. 2-3 questions max:
- One about key sections/features (type "multi", 4-5 concrete options for THIS product).
- One about product feel/reference apps if relevant (type "single").
- Never ask about platform, theme, colors or fonts (the UI has dedicated pickers for those).
Every option label must be short (2-6 words) and specific to the user's product.

Output ONLY valid JSON:
{
  "clarificationQuestion": string,
  "structuredQuestions": [
    { "id": string, "type": "single" | "multi", "question": string, "options": [{ "label": string }] }
  ],
  "platform": "web" | "ios" | "tablet" | null,
  "theme": "dark" | "light" | null,
  "industry": string,
  "screenType": string,
  "sections": string[],
  "searchQuery": string,
  "mentionedBrands": string[]
}`;
  let parsed;
  try {
    parsed = await chatJSON(systemPrompt, prompt, { maxTokens: 700 });
  } catch {
    parsed = {
      clarificationQuestion: 'Got it. A few things to lock down:\n\n→ What key sections or features do you need?\n→ Any products you want it to feel like?\n→ How many screens?',
      platform: null, theme: null, industry: 'general', screenType: 'app screen',
      sections: [], searchQuery: prompt, mentionedBrands: []
    };
  }
  // Deterministic style question: options ARE the Design DNA presets (with
  // swatch data), ordered by fit — the answer locks the DNA with zero drift.
  const ranked = [...DESIGN_DNA].sort((a, b) => dnaFitScore(b, prompt) - dnaFitScore(a, prompt));
  // Signature templates (full locked page architectures) lead the list —
  // ALL of them, ranked by prompt fit; web-only, hidden when the prompt asks
  // mobile. Regular DNA presets follow.
  const sigOptions = explicitPlatform(prompt) === 'ios' ? [] : signatureStyleOptions(prompt, 99);
  const styleQuestion = {
    id: 'style',
    type: 'single',
    question: 'Which design direction fits best?',
    options: [
      { label: 'AI decides', dnaId: null },
      ...sigOptions,
      ...ranked.slice(0, 5).map(d => ({
        label: d.name,
        dnaId: d.id,
        theme: d.theme,
        thumbnail: d.thumbnail || null,
        swatch: { bg: d.tokens.base, surface: d.tokens.surface, ink: d.tokens.ink, accent: d.tokens.accent },
        fonts: { display: d.fonts.display, body: d.fonts.body }
      }))
    ]
  };
  // Colors, icons, fonts and platform are handled by the frontend's own
  // pickers inside the dock — only product questions + style come from here.
  const structuredQuestions = [
    ...(Array.isArray(parsed.structuredQuestions) ? parsed.structuredQuestions.slice(0, 2) : []),
    styleQuestion
  ];

  return {
    needsClarification: true,
    ...parsed,
    structuredQuestions,
    platform: explicitPlatform(prompt),
    theme: explicitTheme(prompt),
    specificRef: parsed.specificRef || null,
    suggestedDesignStyle: 'none',
    suggestedPalette: dnaToLegacyPalette(parsed.theme === 'dark' ? selectDNAFallback(prompt, 'dark') : dnaGuess)
  };
}

function dnaFitScore(dna, text = '') {
  const t = String(text).toLowerCase();
  let score = 0;
  for (const kw of dna.bestFor) {
    const words = kw.split(/\s+/);
    if (words.some(w => w.length > 3 && t.includes(w))) score++;
  }
  return score;
}

// ── Stage 1: Brief ────────────────────────────────────────────────────────

async function stageBrief({ prompt, previousContext, platform, theme, designChoices }) {
  const systemPrompt = `You are the head of product + design planning one set of UI screens.
Turn the user's request into a tight brief. Be decisive and specific — no hedging.

DESIGN DNA CATALOG (you MUST pick exactly one id from this list):
${dnaCatalogForPrompt()}

Rules:
- Pick the DNA whose bestFor and theme genuinely fit the product and any requested theme. If the user asked for dark mode, pick a dark DNA.
- If the user names a screen count, honor it exactly (max 12). Otherwise choose what the product needs (landing page = 1, app = 3-6).
- Every screen gets 3-6 concrete sections (e.g. "sticky nav", "hero with product screenshot", "4 KPI cards", "transactions table") — never vague ("content area").
- productName: short, brandable, matches the domain (invent one if the user didn't name it).
- imageQueries: 2-4 short stock-photo searches ONLY for lifestyle/people/places/food/physical-product imagery that belongs in this UI. NEVER queries for screenshots, dashboards, apps, or "technology" — software is mocked in HTML, not photographed. Pure SaaS/dev tools usually get [].
- brandDomains: 4-6 invented-but-plausible customer company NAMES (not domains) for a social-proof strip, ONLY for web landing/marketing pages; else []. They will render as text wordmarks.

Output ONLY valid JSON:
{
  "productName": string,
  "tagline": string,
  "audience": string,
  "industry": string,
  "platform": "web" | "ios" | "tablet",
  "theme": "dark" | "light",
  "dnaId": string,
  "screenCount": number,
  "screens": [{ "name": string, "purpose": string, "sections": string[], "activeNav": string | null }],
  "appChrome": { "navItems": [{ "label": string, "icon": "lucide icon name" }], "userName": string, "avatarSeed": string } | null,
  "imageQueries": string[],
  "brandDomains": string[]
}

appChrome rules:
- REQUIRED for ANY app-type UI (dashboard, admin, console, CRM, tool, mobile app) — even a single screen: 5-7 navItems (the current screen plus the sections this product would obviously have), one consistent sample user.
- Each screen's activeNav must be one of the navItems labels (or null for full-screen flows like onboarding/player).
- null ONLY for marketing/landing/auth pages that have no app shell.`;

  const userParts = [`REQUEST: ${prompt}`];
  if (previousContext) userParts.push(`CONVERSATION CONTEXT: ${typeof previousContext === 'string' ? previousContext : JSON.stringify(previousContext)}`);
  if (platform) userParts.push(`USER-LOCKED PLATFORM: ${platform}`);
  if (theme) userParts.push(`USER-LOCKED THEME: ${theme}`);
  if (designChoices && Object.keys(designChoices).length) userParts.push(`USER DESIGN CHOICES: ${JSON.stringify(designChoices)}`);

  const brief = await chatJSON(systemPrompt, userParts.join('\n\n'), { maxTokens: 2500, temperature: 0.6 });

  // Harden the result
  brief.platform = platform || brief.platform || 'web';
  brief.theme = theme || brief.theme || 'light';
  brief.screens = Array.isArray(brief.screens) && brief.screens.length ? brief.screens.slice(0, 12) : [{ name: 'Main screen', purpose: prompt, sections: [] }];
  brief.screenCount = brief.screens.length;

  // A DNA picked in the question cards is a hard lock
  if (designChoices?.dnaId && getDNA(designChoices.dnaId)) brief.dnaId = designChoices.dnaId;

  let dna = getDNA(brief.dnaId);
  if (designChoices?.dnaId && dna) {
    brief.dna = applyUserOverrides(dna, designChoices);
    return brief;
  }
  if (!dna || (brief.theme && dna.theme !== brief.theme && !designChoices?.paletteLocked)) {
    dna = DESIGN_DNA.find(d => d.id === brief.dnaId && d.theme === brief.theme) || selectDNAFallback(`${prompt} ${brief.industry}`, brief.theme);
  }
  brief.dna = applyUserOverrides(dna, designChoices);
  return brief;
}

// ── Stage 2: Copy ─────────────────────────────────────────────────────────

async function stageCopy(brief, prompt) {
  const systemPrompt = `You are a senior product copywriter. Write ALL the real text content for these UI screens.
The designer will use your copy VERBATIM — write finished copy, not descriptions of copy.

Hard rules:
- Banned words: ${BANNED_COPY}. No exclamation marks. No emoji.
- Headlines: concrete and specific to THIS product. State outcomes or facts, not vibes.
- Every number must be believable and precise ($48,290 not $50,000; 38% not 50%; 4.9/5 not 5/5).
- People: realistic diverse full names with plausible roles/companies.
- Dates: use late June / early July 2026.
- Microcopy included: button labels, empty states, input placeholders, nav items, badge labels.
- For data-heavy screens, include 5-8 rows of sample data (names, amounts, dates, statuses).

Output ONLY valid JSON:
{ "screens": [ { "name": string, "copy": { <named strings and small arrays/objects — your structure, but complete> } } ] }`;

  const userPrompt = `PRODUCT: ${brief.productName} — ${brief.tagline}
AUDIENCE: ${brief.audience} | INDUSTRY: ${brief.industry}
ORIGINAL REQUEST: ${prompt}
SCREENS:
${brief.screens.map((s, i) => `${i + 1}. ${s.name} — ${s.purpose} — sections: ${(s.sections || []).join(', ')}`).join('\n')}`;

  try {
    const result = await chatJSON(systemPrompt, userPrompt, { maxTokens: 8000, temperature: 0.8 });
    return result.screens || [];
  } catch (e) {
    console.warn(`  [Warning] [v3] Copy stage failed (${e.message}) — composer will write its own copy`);
    return [];
  }
}

// ── Stage 3: Compose ──────────────────────────────────────────────────────

function composerSystemPrompt(dna, platform, patternsBlock) {
  const sizing = platform === 'ios'
    ? `PLATFORM: iOS mobile. The document renders in a phone-sized viewport (390px wide). Design a full mobile screen: status bar, large title or app bar, thumb-reachable controls, bottom tab bar when the screen belongs to a tabbed app. No hover-dependent UI. Text ≥ 13px.
STATUS BAR (hard rule): the FIRST element of the screen is ALWAYS the iOS status bar (9:41 on the left; signal/wifi/battery lucide icons on the right, px-6 pt-3). Content must never start in the notch/rounded-corner zone. On full-bleed hero screens the status bar overlays the image (absolute, white text).
EDGE PADDING (hard rule): every content block sits inside px-4 (16px) minimum horizontal padding — cards, lists, progress bars and headers must NEVER touch the device edges. Only full-bleed hero imagery, the status bar and the bottom tab bar may span edge-to-edge.
VIEWPORT WIDTH (hard rule): nothing may be wider than the 390px viewport — no fixed widths ≥ 380px, no multi-column grids that force overflow. Horizontal card carousels live inside their own overflow-x-auto container with pl-4 leading padding and snap-x; the page itself NEVER scrolls horizontally.`
    : platform === 'tablet'
      ? `PLATFORM: Tablet (1024px viewport). Comfortable two-column layouts, larger touch targets.`
      : `PLATFORM: Desktop web (1440px viewport). Use the full width intelligently: max-w-7xl containers for marketing pages, full-bleed shells for apps. Include realistic hover states (hover:).`;

  return `You are a world-class UI designer who writes production-grade HTML. You design at the level of Linear, Stripe, Vercel and Airbnb marketing/product teams. Your output is judged by senior design directors.

${dnaPromptBlock(dna)}

${sizing}

OUTPUT CONTRACT (violations = rejection):
- Output ONLY an HTML fragment for the <body> interior. No <!DOCTYPE>, <html>, <head>, <body>, <link>, <meta>, or markdown fences.
- Tailwind classes only (CDN build is loaded). The DNA token classes (bg-base, bg-surface, bg-raised, border-line, text-ink, text-muted, bg-accent, text-accentInk, bg-accent2, rounded-card, font-display, font-body, font-mono) are pre-configured — color and font choices MUST go through them.
- Icons: <iconify-icon icon="lucide:NAME"></iconify-icon> only (any lucide name works). NEVER emoji, never hand-drawn <svg> icons. Feature/list icons get a confident tinted container (e.g. grid h-10 w-10 place-items-center rounded-card bg-accent/10 text-accent, icon at text-lg) — no timid gray 16px icons.
- Interactivity with Alpine.js (loaded): x-data, x-show, x-transition, @click, :class. Add real behavior: working tabs, toggles, accordion, active nav states. Alpine only — no addEventListener soup.
- Charts: <canvas> + inline <script> with Chart.js (loaded). Every <canvas> MUST sit inside a wrapper div with an explicit height (h-56/h-64/h-72) and options MUST include maintainAspectRatio:false — otherwise doughnuts collapse. Chart craft: bars get borderRadius: 8, borderSkipped: false, barPercentage ≤ 0.6 (chunky rounded bars, never thin flat ones); doughnuts get cutout '72%'+ with a bold HTML number centered on top (absolute overlay); lines stay thin with pointRadius 0 and a soft vertical-gradient fill; hide legends and use HTML colored-dot legends instead; muted small ticks, y-grid only (or no axes for mini charts).
- Micro-interactions: cards that act as links/buttons get hover:-translate-y-0.5 hover:shadow-md transition; the shell already animates sections in on scroll — do NOT write your own scroll/entrance animation scripts.
- No floating action buttons or fixed-position overlays on desktop web — actions live in headers and cards.
- Photos: ONLY the URLs provided in the request (plus https://api.dicebear.com/9.x/notionists/svg?seed=NAME for avatars). Never invent other image URLs.
- Company/brand logos are always TEXT WORDMARKS styled with the DNA fonts (image logo URLs break). Vary the treatment: weight, small caps, mono, italic.
- NEVER represent a software product with a stock photo of a screen/laptop. Build the product visual as a real mini-interface in HTML (a small dashboard card, invoice, chat window, table — 15-30 lines, populated with plausible data). Photos are ONLY for lifestyle, people, food, places, physical products.
- Use the provided COPY verbatim — it is final copy, not suggestions.

CRAFT RULES (this is what separates you from AI slop):
1. Hierarchy: exactly ONE dominant element per screen (a headline, a number, a photo). Everything else steps down clearly. If everything is bold, nothing is.
2. Spacing rhythm: pick a rhythm and repeat it. Section padding consistent across the screen. Related items close, unrelated far (proximity = meaning).
3. Alignment: everything sits on the grid. No centered-body-text with left-headers mixing. Numbers right-aligned in tables.
4. Restraint: the accent color appears in ≤ 10% of the screen. One display-font moment. Decoration only where the DNA rules invite it.
5. Realism: this must look like a screenshot of a real shipped product on its best day — populated states, plausible data, consistent user identity across the screen (same avatar seed = same person). All dates/times fall in late June – early July 2026 unless the copy says otherwise.
6. Detail density where it matters: real timestamps, precise amounts, status badges, keyboard hints (⌘K), version numbers, favicons/logos. Empty corners are fine; empty content is not.
7. Depth follows the DNA shadow policy exactly. When in doubt: border, not shadow.
8. Every interactive element has hover/active/focus treatment (desktop) or active/pressed (mobile).

STRUCTURAL REFERENCES (adapt structure and quality bar to this product + DNA; do not copy content):
${patternsBlock}`;
}

async function composeScreen({ brief, screen, screenCopy, images, index, onPartial }) {
  const dna = brief.dna;
  // Signature template replaces the generic pattern references with its
  // locked page architecture (landing-type screens only; other screens in
  // the set still compose normally under the signature's DNA).
  const signature = brief.signature && brief.signatureImages
    && (index === 0 || brief.screenCount === 1 || /landing|home|hero|main/i.test(screen.name || ''))
    ? brief.signature : null;
  const patternsBlock = signature
    ? signature.specBlock(brief.signatureImages, { productName: brief.productName, industry: brief.industry })
    : matchPatterns(screen.sections || [], `${screen.name} ${screen.purpose}`, brief.platform, 4);

  const userParts = [
    `PRODUCT: ${brief.productName} — ${brief.tagline} (${brief.industry}, for ${brief.audience})`,
    `SCREEN ${index + 1} of ${brief.screenCount}: "${screen.name}"`,
    `PURPOSE: ${screen.purpose}`,
    `REQUIRED SECTIONS (all must appear, in a sensible order): ${(screen.sections || []).join('; ') || 'designer’s choice'}`
  ];
  if (brief.appChrome?.navItems?.length) {
    userParts.push(`APP CHROME (must be IDENTICAL on every screen of this app — same labels, same lucide icons, same order):
NAV ITEMS: ${JSON.stringify(brief.appChrome.navItems)}
${brief.platform === 'ios' ? 'Render as the bottom tab bar.' : 'Render as a fixed left sidebar (~w-60) with icon + label for EVERY item — never an icon-only rail — plus the product wordmark at top and the app user at the bottom. Page title goes inside the main column header, never over the sidebar.'}
ACTIVE ON THIS SCREEN: ${screen.activeNav || 'none (full-screen flow — still keep chrome consistent if shown)'}
APP USER (same person everywhere): ${brief.appChrome.userName}, avatar https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(brief.appChrome.avatarSeed || brief.appChrome.userName || 'user')}`);
  }
  if (screenCopy) userParts.push(`COPY (use verbatim):\n${JSON.stringify(screenCopy, null, 1)}`);
  if (!signature && images.length) userParts.push(`AVAILABLE PHOTOS (use only these, crop with object-cover):\n${images.map(i => `- ${i.url} (${i.alt})`).join('\n')}
If a section needs imagery these don't cover (product shots, gallery tiles, portraits), generate it: https://image.pollinations.ai/prompt/{URL-encoded photographic description naming the actual product}?width=800&height=800&nologo=true&seed={a different number per image} — NEVER an empty gray placeholder box where a photo belongs.`);
  if (brief.brandDomains?.length) userParts.push(`CUSTOMER NAMES for social-proof wordmarks: ${brief.brandDomains.join(', ')}`);
  userParts.push('Return the complete polished HTML fragment now.');

  const sys = composerSystemPrompt(dna, brief.platform, patternsBlock);
  let raw = onPartial
    ? await chatStream(sys, userParts.join('\n\n'), { maxTokens: 8192, temperature: 0.7, onDelta: onPartial })
    : await chat(sys, userParts.join('\n\n'), { maxTokens: 8192, temperature: 0.7 });
  let body = cleanHtmlResponse(raw);

  if (body.length < 600) {
    raw = await chat(sys, userParts.join('\n\n'), { maxTokens: 8192, temperature: 0.5, attempt: 2 });
    body = cleanHtmlResponse(raw);
  }
  return body;
}

async function repairScreen({ dna, body, violations, platform }) {
  const sys = `You are a meticulous UI engineer fixing specific defects in an HTML fragment. Preserve the design and content; change ONLY what the defect list requires.
${dnaPromptBlock(dna)}
Output ONLY the corrected HTML fragment. No fences, no commentary.`;
  const usr = `DEFECTS TO FIX:\n${violations.map(v => `- ${v}`).join('\n')}\n\nFRAGMENT:\n${body}`;
  const fixed = cleanHtmlResponse(await chat(sys, usr, { maxTokens: 8192, temperature: 0.3 }));
  return fixed.length > body.length * 0.5 ? fixed : body;
}

// ── Main pipeline ─────────────────────────────────────────────────────────

export async function runV3Pipeline(input, cb) {
  const {
    prompt, platform, theme, isFollowUp, previousContext, designChoices,
    visualAssetModeInput, requestId
  } = input;
  const started = Date.now();

  try {
    const lower = String(prompt || '').toLowerCase();
    const bypass = BYPASS_KEYWORDS.some(k => lower.includes(k));

    // ── Clarify on first contact (unchanged product behavior) ──
    if (!isFollowUp && !bypass) {
      cb.sendStatus('Reading your brief...');
      const clar = await stageClarify(prompt);
      cb.sendClarification(clar.clarificationQuestion, clar, null, null);
      return;
    }

    // ── Stage 1: Brief ──
    cb.sendStatus('Planning product and choosing a design system...');
    const brief = await stageBrief({ prompt, previousContext, platform, theme, designChoices });
    console.log(`[v3] Brief: ${brief.productName} · ${brief.screenCount} screen(s) · DNA=${brief.dna.id} · ${brief.platform}/${brief.theme}`);

    // Signature template: a locked page architecture rides the dnaId rails.
    // Image slots resolve to per-generation AI images (same seed base across
    // slots so the set stays cohesive).
    brief.signature = brief.platform === 'web' ? getSignature(brief.dna?.id || brief.dnaId) : null;
    if (brief.signature) {
      brief.signatureImages = buildSignatureImages(brief.signature, `${brief.productName || 'the product'}${brief.industry ? `, ${brief.industry}` : ''}`);
      console.log(` [v3] Signature template active: ${brief.signature.name}`);
    }

    // ── Stage 2 + images in parallel ──
    cb.sendStatus('Writing real copy and gathering assets...');
    const wantPhotos = visualAssetModeInput !== 'illustration' && (brief.imageQueries?.length > 0);
    const [copyScreens, images] = await Promise.all([
      stageCopy(brief, prompt),
      wantPhotos ? fetchUnsplashImages(brief.imageQueries) : Promise.resolve([])
    ]);
    const copyByName = new Map(copyScreens.map(s => [String(s.name || '').toLowerCase(), s.copy]));

    // ── Stage 3: Compose in batches of 4 ──
    const screens = [];
    let repairBudget = 2;
    const BATCH = 4;
    for (let b = 0; b < brief.screens.length; b += BATCH) {
      const batch = brief.screens.slice(b, b + BATCH);
      await Promise.all(batch.map(async (screen, j) => {
        const index = b + j;
        cb.sendScreenStart(index, screen.name);
        cb.sendStatus(`Designing "${screen.name}" (${index + 1}/${brief.screenCount})...`);
        try {
          const screenCopy = copyByName.get(String(screen.name || '').toLowerCase()) || copyScreens[index]?.copy || null;

          // Live build preview: forward partial HTML every ~1.2s while composing
          let lastPartialAt = 0;
          const onPartial = cb.sendScreenPartial
            ? (fullText) => {
                const now = Date.now();
                if (now - lastPartialAt < 800) return;
                lastPartialAt = now;
                const partialBody = cleanHtmlResponse(fullText);
                if (partialBody.length < 200) return;
                cb.sendScreenPartial(index, wrapScreen(brief.dna, partialBody, {
                  title: `${brief.productName} — ${screen.name}`,
                  platform: brief.platform
                }), screen.name);
              }
            : null;

          let body = await composeScreen({ brief, screen, screenCopy, images, index, onPartial });

          let { html: linted, violations } = lintAndFix(body, {
            dna: brief.dna,
            allowStars: brief.dna.id === 'brutalist-pop',
            fallbackImageSeed: `${requestId || 'v3'}-${index}`,
            platform: brief.platform
          });

          if (needsRepair(violations) && repairBudget > 0) {
            repairBudget--;
            cb.sendStatus(`Polishing "${screen.name}"...`);
            console.log(`[v3] Repairing screen ${index}: ${violations.join(' | ')}`);
            const repaired = await repairScreen({ dna: brief.dna, body: linted, violations, platform: brief.platform });
            const second = lintAndFix(repaired, { dna: brief.dna, allowStars: brief.dna.id === 'brutalist-pop', fallbackImageSeed: `${requestId || 'v3'}-${index}r`, platform: brief.platform });
            linted = second.html;
            violations = second.violations;
          }

          const html = wrapScreen(brief.dna, linted, { title: `${brief.productName} — ${screen.name}`, platform: brief.platform });
          screens[index] = { index, html, reactCode: null, title: screen.name, violations };
          cb.sendScreenComplete(index, html, null, screen.name);
        } catch (err) {
          console.error(`[Error] [v3] Screen ${index} failed:`, err.message);
          screens[index] = null;
        }
      }));
    }

    const okScreens = screens.filter(Boolean);
    if (!okScreens.length) {
      cb.sendError({ stage: 'compose', message: 'All screens failed to generate. Please try again.' });
      return;
    }

    // ── Complete ──
    const totalViolations = okScreens.reduce((n, s) => n + (s.violations?.length || 0), 0);
    const qaScore = Math.max(60, 100 - totalViolations * 4);
    const legacyPalette = dnaToLegacyPalette(brief.dna);
    const meta = {
      requestedScreenCount: brief.screenCount,
      successfulScreenCount: okScreens.length,
      productName: brief.productName,
      creativeConcept: brief.tagline,
      visualAssetMode: images.length ? 'photography' : 'minimal',
      paletteName: brief.dna.name,
      selectedSkillName: brief.dna.id,
      sharedComponentsGenerated: 0,
      illustrationsGenerated: 0,
      qaScore,
      duration: Math.round((Date.now() - started) / 1000),
      engine: 'v3',
      dnaId: brief.dna.id,
      appChrome: brief.appChrome || null
    };
    console.log(`[Success] [v3] Done: ${okScreens.length}/${brief.screenCount} screens in ${meta.duration}s, QA ${qaScore}`);
    cb.sendComplete(
      meta,
      okScreens.map(({ violations, ...s }) => s),
      legacyPalette,
      { heading: brief.dna.fonts.display, body: brief.dna.fonts.body },
      [],
      null
    );
  } catch (err) {
    console.error('[Error] [v3] Pipeline error:', err);
    cb.sendError({ stage: 'pipeline', message: err.message || 'Generation failed' });
  }
}

// ── Iterate (patch-based, for v3 documents) ──────────────────────────────

export async function iterateV3({ currentHTML, instruction }) {
  const { extractBody, isV3Document, dnaIdFromDocument, wrapScreen: wrap } = await import('./runtime.js');
  if (!isV3Document(currentHTML)) return null; // caller falls back to legacy path

  const dna = getDNA(dnaIdFromDocument(currentHTML)) || selectDNAFallback(instruction);
  const platformMatch = currentHTML.match(/name="inspoai-platform" content="(\w+)"/);
  const platform = platformMatch ? platformMatch[1] : 'web';
  const titleMatch = currentHTML.match(/<title>([^<]*)<\/title>/);
  const body = extractBody(currentHTML);

  const sys = `You are a senior UI engineer editing an existing screen. Apply the user's instruction with surgical precision — keep everything else pixel-identical.
${dnaPromptBlock(dna)}
Output ONLY the full updated HTML fragment (body interior). No fences, no commentary, no <html>/<head>/<body> tags.`;
  const raw = await chat(sys, `CURRENT FRAGMENT:\n${body}\n\nINSTRUCTION: ${instruction}`, { maxTokens: 8192, temperature: 0.4 });
  const updated = cleanHtmlResponse(raw);
  const { html: linted } = lintAndFix(updated, { dna, allowStars: dna.id === 'brutalist-pop', platform });
  const html = wrap(dna, linted, { title: titleMatch ? titleMatch[1] : 'Screen', platform });
  return { html, reactCode: null };
}

// ── Add screen (session design memory) ───────────────────────────────────
// Composes ONE new screen locked to the design of an existing v3 document.
// The DNA is read from the document itself, so a retheme carries forward;
// app chrome and product identity come from the saved design brief.

export async function addScreenV3({ screenDescription, existingHTML, designBrief = {}, platformOverride }) {
  const { isV3Document, dnaIdFromDocument } = await import('./runtime.js');
  if (!existingHTML || !isV3Document(existingHTML)) return null; // caller falls back to legacy

  const dna = getDNA(dnaIdFromDocument(existingHTML)) || getDNA(designBrief.dnaId);
  if (!dna) return null;
  const platformMatch = existingHTML.match(/name="inspoai-platform" content="(\w+)"/);
  const platform = platformOverride || (platformMatch ? platformMatch[1] : 'web');
  const productName = designBrief.productName || (existingHTML.match(/<title>([^—<]*)—?/)?.[1] || 'App').trim();

  const miniBrief = {
    productName,
    tagline: designBrief.creativeConcept || '',
    audience: '',
    industry: '',
    platform,
    theme: dna.theme,
    screenCount: 1,
    dna,
    appChrome: designBrief.appChrome || null,
    brandDomains: []
  };
  const screen = {
    name: screenDescription.slice(0, 60),
    purpose: screenDescription,
    sections: [],
    activeNav: designBrief.appChrome?.navItems?.find(n =>
      screenDescription.toLowerCase().includes(String(n.label || '').toLowerCase()))?.label || null
  };

  const body = await composeScreen({ brief: miniBrief, screen, screenCopy: null, images: [], index: 0 });
  const { html: linted } = lintAndFix(body, { dna, allowStars: dna.id === 'brutalist-pop', platform });
  const html = wrapScreen(dna, linted, { title: `${productName} — ${screen.name}`, platform });
  return { html, reactCode: null, title: screen.name };
}
