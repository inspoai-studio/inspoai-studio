/**
 * agenticUIRoutes.js
 * 
 * Agentic UI Generation — Brain Agent orchestration with DeepSeek Flash.
 * Uses 90K real-world screenshot database as design context.
 */

import express from 'express';
import fs, { readFileSync } from 'fs';
import crypto from 'crypto';
import vm from 'vm';
import { fileURLToPath } from 'url';
import path, { dirname, join } from 'path';
import multer from 'multer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { semanticSearch, isSemanticSearchReady } from '../services/pineconeService.js';
import { supabase, supabaseAdmin } from '../config/supabaseClient.js';
import UserService from '../services/userService.js';
import CREDIT_LIMITS from '../config/creditLimits.js';
import { checkPromptSafety } from '../services/contentModerationService.js';
import { VALID_LUCIDE_ICONS, LUCIDE_REPLACEMENTS } from '../utils/lucideIcons.js';
import { AsyncLocalStorage } from 'async_hooks';
import { runV3Pipeline, iterateV3, addScreenV3 } from '../agentic-v3/pipeline.js';
import { rethemeScreens } from '../agentic-v3/retheme.js';
import { DESIGN_DNA } from '../agentic-v3/dna.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load design rules at startup
let DESIGN_RULES = '';
try {
  DESIGN_RULES = readFileSync(join(__dirname, 'design-rules.md'), 'utf-8');
  console.log(`Loaded design rules (${DESIGN_RULES.length} chars)`);
} catch { DESIGN_RULES = ''; }

// ── In-Memory Babel Standalone Compiler for Backend Validation ─────────
let BabelInstance = null;

async function initBabel() {
  try {
    console.log('Fetching Babel Standalone for backend compiler checks...');
    const res = await fetch('https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js', { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const babelJs = await res.text();
    
    const context = { console, process };
    vm.createContext(context);
    vm.runInContext(babelJs, context);
    BabelInstance = context.Babel || context.window?.Babel;
    console.log('[Success] Babel Standalone loaded successfully. Backend compiler checks active.');
  } catch (err) {
    console.warn('[Warning] Failed to load Babel Standalone for backend compiler checks:', err.message);
  }
}

// Call async init
initBabel().catch(() => {});

function fixInvalidLucideIcons(code) {
  if (!code) return code;
  
  const bannedIcons = ['Activity', 'Sparkles', 'Sparkle', 'CircleCheckBig', 'CircleCheck', 'CheckCircle', 'CheckCircle2', 'Heart', 'Star', 'Bolt', 'Zap', 'Flame', 'WandSparkles', 'WandSparkle'];
  const isBanned = (name) => bannedIcons.includes(name);

  // 1. Find destructured names
  const destructureRegex = /(?:const|let|var)\s*\{\s*([a-zA-Z0-9_\s,]+)\s*\}\s*=\s*(?:window\.)?Lucide\b/g;
  let match;
  const invalidIcons = new Set();

  while ((match = destructureRegex.exec(code)) !== null) {
    const names = match[1].split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!VALID_LUCIDE_ICONS.has(name) || isBanned(name)) {
        invalidIcons.add(name);
      }
    }
  }

  // 2. Find direct Lucide.IconName properties
  const directRegex = /\bLucide\.([a-zA-Z0-9_]+)\b/g;
  while ((match = directRegex.exec(code)) !== null) {
    const name = match[1];
    if (!VALID_LUCIDE_ICONS.has(name) || isBanned(name)) {
      invalidIcons.add(name);
    }
  }

  // 3. Replace all occurrences of each invalid icon
  for (const name of invalidIcons) {
    let replacement = LUCIDE_REPLACEMENTS[name];
    if (!replacement) {
      // Try case-insensitive lookup in the whitelist
      const lowerName = name.toLowerCase();
      for (const valid of VALID_LUCIDE_ICONS) {
        if (valid.toLowerCase() === lowerName && !isBanned(valid)) {
          replacement = valid;
          break;
        }
      }
    }
    if (!replacement) {
      replacement = 'Circle'; // Safe fallback
    }

    // Replace all usages of the icon name (with word boundary)
    const regex = new RegExp(`\\b${name}\\b`, 'g');
    code = code.replace(regex, replacement);
    console.log(`Icon Validation: Replaced invalid/banned icon "${name}" with "${replacement}"`);
  }

  // 4. Clean up any duplicate variables inside Lucide destructuring
  code = code.replace(/(const|let|var)\s*\{\s*([a-zA-Z0-9_\s,]+)\s*\}\s*=\s*(?:window\.)?Lucide\b;?/g, (m, decl, list) => {
    const uniq = Array.from(new Set(list.split(',').map(x => x.trim()).filter(Boolean)));
    return `${decl} { ${uniq.join(', ')} } = Lucide;`;
  });

  return code;
}

// ── Deterministic Post-Processing Mini-Tools ─────────────────────────────────

// Maps an arbitrary px value to the nearest Tailwind spacing scale number
function _pxToTailwindSpacing(px) {
  const map = [[2,0.5],[4,1],[6,1.5],[8,2],[10,2.5],[12,3],[14,3.5],[16,4],[20,5],[24,6],[28,7],[32,8],[36,9],[40,10],[44,11],[48,12],[56,14],[64,16],[80,20],[96,24],[112,28],[128,32]];
  let closest = map[0];
  for (const entry of map) {
    if (Math.abs(entry[0] - px) < Math.abs(closest[0] - px)) closest = entry;
  }
  return String(closest[1]);
}

// Replace arbitrary Tailwind spacing values (p-[13px]) with nearest grid class
function normalizeSpacing(code) {
  return code.replace(
    /\b(p|m|pt|pb|pl|pr|px|py|mt|mb|ml|mr|mx|my|gap|space-x|space-y)-\[(\d+(?:\.\d+)?)(px|rem)\]/g,
    (_m, prefix, val, unit) => {
      const px = unit === 'rem' ? parseFloat(val) * 16 : parseFloat(val);
      if (px > 160) return _m; // leave intentionally large values alone
      return `${prefix}-${_pxToTailwindSpacing(px)}`;
    }
  );
}

// Replace arbitrary Tailwind text sizes (text-[17px]) with nearest scale class
function enforceTypeScale(code) {
  const pxToText = (px) => {
    const map = [[12,'xs'],[14,'sm'],[16,'base'],[18,'lg'],[20,'xl'],[24,'2xl'],[30,'3xl'],[36,'4xl'],[48,'5xl'],[60,'6xl'],[72,'7xl']];
    let best = map[1];
    for (const e of map) if (Math.abs(e[0]-px) < Math.abs(best[0]-px)) best = e;
    return best[1];
  };
  return code.replace(/\btext-\[(\d+(?:\.\d+)?)(px|rem)\]/g, (_m, val, unit) => {
    const px = unit === 'rem' ? parseFloat(val) * 16 : parseFloat(val);
    return `text-${pxToText(px)}`;
  });
}

// Replace suspiciously round numbers in JSX text content with realistic-looking values
function realistifyNumbers(code) {
  const swaps = [
    [/>(\s*)10,000(\s*)</g,   (_, a, b) => `>${a}9,847${b}<`],
    [/>(\s*)1,000(\s*)</g,    (_, a, b) => `>${a}1,247${b}<`],
    [/>(\s*)5,000(\s*)</g,    (_, a, b) => `>${a}4,831${b}<`],
    [/>(\s*)100,000(\s*)</g,  (_, a, b) => `>${a}94,312${b}<`],
    [/>(\s*)\$100\b(\s*)</g,  (_, a, b) => `>${a}$97${b}<`],
    [/>(\s*)\$50\b(\s*)</g,   (_, a, b) => `>${a}$47${b}<`],
    [/>(\s*)\$200\b(\s*)</g,  (_, a, b) => `>${a}$187${b}<`],
    [/>(\s*)100%(\s*)</g,     (_, a, b) => `>${a}97%${b}<`],
    [/>(\s*)50%(\s*)</g,      (_, a, b) => `>${a}48%${b}<`],
    [/>(\s*)25%(\s*)</g,      (_, a, b) => `>${a}23%${b}<`],
  ];
  for (const [pattern, fn] of swaps) {
    code = code.replace(pattern, fn);
  }
  return code;
}

// Deterministic fixes for common AI code generation bugs — run BEFORE LLM repair
function deterministicPreFix(code) {
  // 1. Remove dynamic Tailwind bracket interpolations — they never resolve in CDN Tailwind
  //    e.g. className={`bg-[${color}] text-[${size}px]`} — strip the interpolated bracket class
  code = code.replace(/\b(text|bg|border|ring|from|to|via|shadow|fill|stroke)-\[\$\{[^}]+\}\]/g, '');

  // 2. Remove TypeScript generic type parameters that survived Babel stripping
  //    e.g. useState<boolean>(false) → useState(false)
  code = code.replace(/\b(useState|useRef|useCallback|useMemo|useContext|useReducer|useTransition)\s*<[^>()]+>\s*\(/g, '$1(');

  // 3. Replace HTML comments inside JSX (invalid) with JSX comments
  code = code.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');

  // 4. Fix broken lucide wildcard import syntax: `import *'lucide-react'` (missing "as Lucide from")
  code = code.replace(/^\s*import\s+\*\s*['"]lucide-react['"]\s*;?\s*$/gm, '');

  // 5. Strip TypeScript array type annotations that regex TS-stripper misses
  //    e.g.  : string[] → (nothing),  : number[] → (nothing)
  code = code.replace(/:\s*(string|number|boolean|object|any|void|null|undefined)\[\]\s*(?=[,;)={])/g, '');

  // 6. Fix non-null assertions on JSX attribute values: value={x!} → value={x}
  code = code.replace(/=\{([^}]+)!\}/g, (_, inner) => `={${inner.trim()}}`);

  // 7. Ensure Recharts imports are destructured from global Recharts object, not ES imports
  //    (already handled by sanitizeReactCode, this catches any that slipped through)
  code = code.replace(/import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*['"]recharts['"]\s*;?/g, (_, imports) =>
    `const { ${imports.replace(/\s+/g, ' ').trim()} } = Recharts;`
  );

  return code;
}

function detectGenerationTarget(prompt, selectedPlatform) {
  const text = String(prompt || '').toLowerCase();

  const explicitWeb =
    /\b(landing page|website|web page|homepage|marketing site|desktop website|web application)\b/.test(text);

  const explicitMobileApp =
    /\b(ios app|iphone app|android app|mobile app|app screens|mobile screens)\b/.test(text);

  const explicitTablet =
    /\b(tablet app|ipad app|tablet screens)\b/.test(text);

  if (explicitWeb) return 'web-page';
  if (explicitMobileApp) return 'mobile-flow';
  if (explicitTablet) return 'tablet-flow';

  if (selectedPlatform === 'web') return 'web-page';
  if (selectedPlatform === 'tablet') return 'tablet-flow';
  if (selectedPlatform === 'ios') return 'mobile-flow';

  return 'auto';
}

function extractUrls(text) {
  return String(text || '').match(/https?:\/\/[^\s<>"')]+/g) || [];
}

async function fetchExactReference(url) {
  try {
    if (url.match(/\.(mp4|mov|webm|avi|mkv|mp3|wav|png|jpg|jpeg|gif|webp|svg|pdf)($|\?)/i)) {
      console.log(`ℹ [fetchExactReference] Skipping scrape for media asset: ${url}`);
      return {
        url,
        title: 'Media Asset',
        headings: [],
        layoutAnalysis: 'This is a media asset reference (image/video/document).',
        visualAnalysis: 'This is a media asset reference.',
        screenshotUrl: url
      };
    }
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const $ = cheerio.load(html);

    const title = $('title').text().trim() || 'Untitled Reference';
    const headings = [];
    $('h1, h2, h3').each((i, el) => {
      headings.push($(el).text().trim());
    });

    const textStructure = [];
    $('p, section, article').each((i, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 20 && textStructure.length < 15) {
        textStructure.push(text.substring(0, 200));
      }
    });

    const description = $('meta[name="description"]').attr('content') || '';
    const ogImage = $('meta[property="og:image"]').attr('content') || '';

    const systemPrompt = `You are a design analysis assistant. Analyze this webpage content (extracted title, headings, and description) and generate a structured visual layout and design analysis. 
Return a JSON object with:
{
  "layoutAnalysis": "Detailed description of the page layout structure, e.g., grid system, card layouts, sidebar, headers.",
  "visualAnalysis": "Detailed description of visual characteristics, e.g., themes, fonts, spacings, contrast levels, aesthetic choices.",
  "screenshotUrl": "Any image URL detected, or empty."
}`;

    const analysisInput = `URL: ${url}
Title: ${title}
Description: ${description}
Headings: ${headings.slice(0, 10).join(' | ')}
Text Structure snippet: ${textStructure.slice(0, 5).join('\n')}`;

    let parsedAnalysis = {
      layoutAnalysis: 'Standard layout analysis based on parsed HTML structure.',
      visualAnalysis: 'Default visual styling and theme based on parsed HTML structure.',
      screenshotUrl: ogImage || ''
    };

    try {
      const llmResult = await callDeepSeek(systemPrompt, analysisInput, 1200);
      const cleaned = llmResult.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      parsedAnalysis.layoutAnalysis = parsed.layoutAnalysis || parsedAnalysis.layoutAnalysis;
      parsedAnalysis.visualAnalysis = parsed.visualAnalysis || parsedAnalysis.visualAnalysis;
      if (parsed.screenshotUrl) parsedAnalysis.screenshotUrl = parsed.screenshotUrl;
    } catch (e) {
      console.warn('AI analysis of exact reference failed, using defaults:', e.message);
    }

    return {
      url,
      title,
      headings: headings.slice(0, 15),
      layoutAnalysis: parsedAnalysis.layoutAnalysis,
      visualAnalysis: parsedAnalysis.visualAnalysis,
      screenshotUrl: parsedAnalysis.screenshotUrl || ogImage || ''
    };
  } catch (err) {
    console.error(`Error fetching exact reference: ${url}`, err.message);
    return {
      url,
      title: 'Failed to load reference',
      headings: [],
      layoutAnalysis: 'The exact reference could not be loaded.',
      visualAnalysis: 'The exact reference could not be loaded.',
      screenshotUrl: ''
    };
  }
}

async function brainExtractRequirements({
  rawPrompt,
  generationTarget,
  uploadedReference,
  exactSources
}) {
  const systemPrompt = `You are a strict, detail-oriented systems analyst. Your job is to extract explicit user requirements from their prompt and references into a structured requirements ledger.

Return ONLY a valid JSON object matching this schema:
{
  "generationTarget": "web-page" | "mobile-flow" | "tablet-flow" | "auto",
  "hardRequirements": string[],
  "mustIncludeSections": string[],
  "mustAvoid": string[],
  "contentRequirements": {
    "headline": string,
    "primaryCTA": string,
    "additionalContent": string
  },
  "visualRequirements": {
    "theme": "dark" | "light" | "auto",
    "accent": string,
    "accentHex": string,
    "headingFont": string,
    "bodyFont": string,
    "exactColors": { "background": string, "surface": string, "accent": string },
    "userMediaAssets": string[],
    "style": string[]
  },
  "technicalRequirements": {
    "framework": "React",
    "styling": "Tailwind CSS",
    "responsive": boolean
  },
  "userDelegatedDecisions": string[],
  "exactSourceUrls": string[],
  "clarificationRequired": boolean
}

RULES:
- Do NOT omit any sections or functional requests from rawPrompt.
- If the user specifies any exact page sections (e.g., hero, api docs, security section, footer), list them in "mustIncludeSections" and "hardRequirements".
- If visual styles (e.g. dark, blue accents) are requested, extract them.
- Preserve exact URLs in "exactSourceUrls".
- If the user mentions a specific font name (e.g., "Inter", "Geist", "Satoshi", "Playfair Display"), extract it into "visualRequirements.headingFont" and "visualRequirements.bodyFont".
- If the user mentions exact hex color values (e.g., #FF5733), extract them into "visualRequirements.exactColors" and "visualRequirements.accentHex".
- If the user provides any image or video URLs (.mp4, .mov, .png, .jpg, .webp, .gif, .svg), extract them into "visualRequirements.userMediaAssets". These are assets the user wants used verbatim in the generated UI.`;

  const input = `Raw Prompt: "${rawPrompt}"
Generation Target: ${generationTarget}
Uploaded Reference: ${uploadedReference ? JSON.stringify(uploadedReference) : 'none'}
Exact Sources: ${exactSources ? JSON.stringify(exactSources) : 'none'}`;

  try {
    const raw = await callDeepSeek(systemPrompt, input, 2500);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.technicalRequirements = parsed.technicalRequirements || {};
    parsed.technicalRequirements.framework = "React";
    parsed.technicalRequirements.styling = "Tailwind CSS";
    parsed.technicalRequirements.responsive = true;
    return parsed;
  } catch (err) {
    console.warn('[Warning] [Extract Requirements] Failed, returning parsed defaults:', err.message);
    return {
      generationTarget: generationTarget || 'auto',
      hardRequirements: ['Use React', 'Use Tailwind CSS'],
      mustIncludeSections: ['header', 'hero', 'features', 'footer'],
      mustAvoid: [],
      contentRequirements: {},
      visualRequirements: { theme: 'dark', accent: 'blue', style: [] },
      technicalRequirements: { framework: 'React', styling: 'Tailwind CSS', responsive: true },
      userDelegatedDecisions: [],
      exactSourceUrls: [],
      clarificationRequired: false
    };
  }
}

function calculatePromptCompleteness(requirementsLedger) {
  let score = 0;
  if (!requirementsLedger) return 0;
  
  if (requirementsLedger.generationTarget && requirementsLedger.generationTarget !== 'auto') score += 20;
  
  if (requirementsLedger.hardRequirements && requirementsLedger.hardRequirements.length > 0) {
    score += Math.min(25, requirementsLedger.hardRequirements.length * 5);
  }
  
  if (requirementsLedger.mustIncludeSections && requirementsLedger.mustIncludeSections.length > 0) {
    score += Math.min(25, requirementsLedger.mustIncludeSections.length * 5);
  }
  
  if (requirementsLedger.visualRequirements) {
    if (requirementsLedger.visualRequirements.theme && requirementsLedger.visualRequirements.theme !== 'auto') score += 10;
    if (requirementsLedger.visualRequirements.accent) score += 10;
    if (requirementsLedger.visualRequirements.style && requirementsLedger.visualRequirements.style.length > 0) score += 10;
  }

  if (requirementsLedger.contentRequirements && Object.keys(requirementsLedger.contentRequirements).length > 0) {
    score += 10;
  }

  return Math.min(100, score);
}

function codeContainsSection(code, section) {
  const cleanCode = String(code || '').toLowerCase();
  const cleanSection = String(section || '').toLowerCase().trim();
  if (cleanCode.includes(cleanSection)) return true;
  const words = cleanSection.split(/\s+/);
  return words.every(word => cleanCode.includes(word));
}

function validateRequirementCoverage(code, requirementsLedger) {
  const missing = [];
  for (const section of requirementsLedger.mustIncludeSections || []) {
    if (!codeContainsSection(code, section)) {
      missing.push(section);
    }
  }
  return {
    success: missing.length === 0,
    missing
  };
}

function isValidGeneratedScreen(screen) {
  return Boolean(
    screen &&
    typeof screen === 'object' &&
    typeof screen.html === 'string' &&
    screen.html.trim().length > 0
  );
}

function normalizeGeneratedScreens(input) {
  if (!Array.isArray(input)) return [];

  return input
    .filter(Boolean)
    .filter(isValidGeneratedScreen)
    .map((screen, index) => ({
      ...screen,
      index: Number.isInteger(screen.index) ? screen.index : index,
      title: screen.title || `Screen ${index + 1}`,
      reactCode: typeof screen.reactCode === 'string' ? screen.reactCode : null
    }));
}

function logPipelineTelemetry(telemetry) {
  console.log('\n [PIPELINE DEBUG TELEMETRY]');
  console.log(JSON.stringify(telemetry, null, 2));
  console.log('═'.repeat(60) + '\n');
}

function compileCheck(code) {
  // Check for banned generic Lucide icons
  const bannedIcons = ['Activity', 'Sparkles', 'Sparkle', 'CircleCheckBig', 'CircleCheck', 'CheckCircle', 'CheckCircle2', 'Heart', 'Star', 'Bolt', 'Zap', 'Flame', 'WandSparkles', 'WandSparkle'];
  const foundBanned = [];
  for (const icon of bannedIcons) {
    const directRegex = new RegExp(`\\bLucide\\.${icon}\\b`);
    const destructureRegex = new RegExp(`const\\s*\\{[^}]*\\b${icon}\\b[^}]*\\}\\s*=\\s*(?:window\\.)?Lucide\\b`);
    if (directRegex.test(code) || destructureRegex.test(code)) {
      foundBanned.push(icon);
    }
  }
  if (foundBanned.length > 0) {
    return { 
      success: false, 
      error: `Banned Lucide icons detected: [${foundBanned.join(', ')}]. You must replace them with precise contextual icons (e.g. use Check or BadgeCheck instead of CircleCheckBig/CheckCircle; use TrendingUp/LineChart instead of Activity; use Wand2/Cpu instead of Sparkles or WandSparkles).` 
    };
  }

  // Check for non-existent Lucide icons
  const foundInvalid = [];
  const directRegex = /\bLucide\.([a-zA-Z0-9_]+)\b/g;
  let match;
  while ((match = directRegex.exec(code)) !== null) {
    const name = match[1];
    if (!VALID_LUCIDE_ICONS.has(name)) {
      foundInvalid.push(name);
    }
  }
  const destructureRegex = /(?:const|let|var)\s*\{\s*([a-zA-Z0-9_\s,]+)\s*\}\s*=\s*(?:window\.)?Lucide\b/g;
  while ((match = destructureRegex.exec(code)) !== null) {
    const names = match[1].split(',').map(n => n.trim()).filter(Boolean);
    for (const name of names) {
      if (!VALID_LUCIDE_ICONS.has(name)) {
        foundInvalid.push(name);
      }
    }
  }
  if (foundInvalid.length > 0) {
    return {
      success: false,
      error: `Non-existent Lucide icons detected: [${Array.from(new Set(foundInvalid)).join(', ')}]. These do not exist in lucide-react v0.300.0. Please check spelling or use a valid icon.`
    };
  }

  // Check for dynamic Tailwind classes (bg-[${...}], etc.)
  const dynamicTailwindRegex = /\b(bg|text|border|from|to|via|shadow|outline)-\[\$\{[^}]+\}\]/;
  if (dynamicTailwindRegex.test(code)) {
    return {
      success: false,
      error: "Dynamic Tailwind class interpolation detected (e.g. bg-[${color}]). Tailwind JIT cannot compile dynamic classes from variable interpolation. You must write inline styles instead: style={{ backgroundColor: color }} instead of className=\"bg-[${color}]\"."
    };
  }

  // Check for JSX in data object/array properties
  const jsxPropertyRegex = /\b(icon|image|graphic|avatar|badge|illustration)\s*:\s*<[A-Z\w\.]+/i;
  if (jsxPropertyRegex.test(code)) {
    return {
      success: false,
      error: "JSX elements detected inside a data object or array property (e.g. icon: <Lucide.Home />). This is fragile and breaks browser compilation. Instead, store the icon/image name as a string (e.g. icon: 'Home') and render it dynamically inside the component (e.g. const IconComponent = Lucide[item.icon]; return <IconComponent />)."
    };
  }

  // Check for TypeScript 'satisfies' keyword (only valid in TS, not in JS/Babel)
  if (/\)\s+satisfies\s+\w|\}\s+satisfies\s+\w|\]\s+satisfies\s+\w/.test(code)) {
    return {
      success: false,
      error: "TypeScript 'satisfies' operator detected. Remove it — pure JavaScript only."
    };
  }

  // Check for 'as const' type assertion
  if (/\bas\s+const\b/.test(code)) {
    return {
      success: false,
      error: "TypeScript 'as const' assertion detected. Remove it."
    };
  }

  // Check for 'import type' statements (TypeScript-only syntax)
  if (/^\s*import\s+type\s+/m.test(code)) {
    return {
      success: false,
      error: "TypeScript 'import type' statement detected. Remove type-only imports."
    };
  }

  // Check for TypeScript enum declarations
  if (/\benum\s+[A-Z]\w*\s*\{/.test(code)) {
    return {
      success: false,
      error: "TypeScript enum detected. Convert to a plain JavaScript object instead."
    };
  }

  if (!BabelInstance) {
    if (/\b(interface|type)\s+[A-Z]\w*/.test(code)) {
      return {
        success: false,
        error: "TypeScript interfaces/types detected (e.g. 'interface' or 'type' keyword). Please remove all TypeScript annotations and use pure JavaScript only."
      };
    }
    // Regex check for common TS parameter annotations when Babel not available
    if (/\w+\s*:\s*(?:string|number|boolean|any|void|never|unknown|null|undefined)\b/.test(code)) {
      return {
        success: false,
        error: "TypeScript parameter/variable type annotations detected (e.g. 'x: string'). Remove all type annotations and use pure JavaScript only."
      };
    }
    return { success: true, error: null };
  }
  try {
    BabelInstance.transform(code, {
      presets: ['react', 'typescript'],
      filename: 'App.tsx'
    });
    return { success: true, error: null };
  } catch (err) {
    return { success: false, error: err.message || err.toString() };
  }
}



// ── UI Style Catalog ──────────────────────────────────────────────────
const UI_STYLES_CATALOG = [
  {
    id: 'taste-skill', name: 'Anti-Slop Design Taste', category: 'Style',
    description: 'Advanced design principles: brief inference, three dial tuning, and strict anti-slop rules.',
    accentColor: '#000000', font: 'Geist Display',
    thumbnail: '/skills/taste-skill.png'
  },
  // ── Prompt Skills (inline promptContent) ──────────────────────────
  {
    id: 'beige-minimal', name: 'Clean Minimal Beige', category: 'Style',
    description: 'Warm beige neutrals, calm premium process-oriented UI',
    accentColor: '#C4A882', font: 'Inter',
    thumbnail: '/skills/beige-minimal.png',
    promptContent: `DESIGN SKILL: Clean Minimal Beige Light Mode

SCOPE: Apply as full design-system direction across page background, hero, shell, grid modules, cards, buttons, and motion. Use when the interface should feel light, calm, premium, and process-oriented, with warm beige neutrals instead of cold white enterprise UI. Not generic bright SaaS and not ornate paper system — clean, minimal, quietly operational.

VISUAL TARGET:
- Page built on layered beige, stone, cream, and off-white surfaces with very low-contrast borders and subtle tonal separation
- Centered master container or framed application shell that holds the experience together
- Simple centered hero + modular lower information grid of evenly divided blocks
- Accent color sparse and purposeful: key badges, active indicators, progress, primary action states only
- Highly organized and premium without strong shadows, loud gradients, or heavy decorative effects

IMPLEMENTATION:
- Warm neutral backgrounds with gentle radial or painted wash behind the main UI rather than flat plain white
- Thin borders, soft dividers, restrained panel contrast to create hierarchy
- Rigid modular grid with equal columns, calm labels, short descriptions, simple functional mock components
- Buttons and pills: light, refined, understated — soft fills, tiny or low-radius corners, subtle border treatment
- Typography: clean sans-serif, modest weight contrast, quiet tracking, balanced spacing
- Motion: subtle — masked text reveals, mild fade-ins, gentle background drift

PATTERNS:
- Large warm neutral hero with centered heading, small badge, minimal CTA stack
- Framed app shell using light beige backgrounds and thin internal dividers
- Process columns or modular info panels with consistent heights and restrained content
- Small dark or tinted inset cards sparingly as contrast moments within mostly light composition
- Tiny status dots, low-key progress bars, minimal approval or routing cards

COLORS: bg #F5F0E8, surface #EDE5D8, border #D4C5B0, text #2C2420, accent #C4A882
AVOID: Stark white SaaS, cold gray borders, overdecorated paper textures, heavy shadows, high-saturation accents.`
  },

  {
    id: 'agency-grid', name: 'Agency Grid Minimal', category: 'Style',
    description: 'Disciplined editorial grid, oversized headlines, architectural photography',
    accentColor: '#2563EB', font: 'Inter',
    thumbnail: '/skills/agency-grid.png',
    promptContent: `DESIGN SKILL: Agency Grid Layout Minimal
OVERRIDE RULES: Disable noise-gradient-bg, glassmorphism, dark section bands, and 3-tone warm rhythm. This is a pure white/light minimal layout.

PAGE SHELL:
- Background: bg-white, full max-w-screen-2xl mx-auto px-4 sm:px-8 md:px-16 — wide breathing room on desktop, tight on mobile
- NO dark sections, NO gradients, NO blur effects, NO glass cards
- Section dividers: single h-px bg-black/10 lines only — no decorative elements

NAVIGATION BAR (MOBILE-SAFE):
- flex items-center justify-between px-4 sm:px-8 h-14 border-b border-black/10 — single row
- Logo: left side, text-sm font-bold tracking-[0.12em] uppercase
- Nav links: hidden md:flex gap-8 text-[11px] uppercase tracking-[0.12em] — HIDE on mobile, never let them overflow
- Mobile menu: md:hidden — show a Lucide.Menu icon on mobile that toggles a dropdown; NEVER show all nav links inline on small screens
- CTA button: text-[11px] uppercase tracking-[0.08em] border border-black px-3 py-1.5 rounded-none

HERO LAYOUT (MANDATORY — RESPONSIVE):
- Mobile (default): flex flex-col gap-4 pt-8 pb-10 — single column stack
- Desktop: md:grid md:grid-cols-12 md:gap-0 md:min-h-[80vh] md:items-end md:pb-16
- Headline: col-span-full md:col-span-8 — text-[clamp(2.8rem,8vw,9rem)] font-black tracking-[-0.04em] leading-[0.9] text-black
- Small metadata column: col-span-full md:col-span-4 — text-[11px] uppercase tracking-[0.15em] text-neutral-500 md:self-end md:pb-2 — on mobile appears BELOW headline as a single line
- NO centered hero. Always left-aligned, grid-anchored

TYPOGRAPHY SYSTEM:
- Display headings: font-black or font-bold, tracking-[-0.04em]
  • Desktop: text-7xl to text-9xl
  • Mobile: text-4xl to text-5xl (NEVER clamp to more than 3rem on mobile — it causes overflow)
- Section labels: text-[11px] uppercase tracking-[0.2em] text-neutral-400 — left-aligned, single line
- Body copy: text-sm md:text-base font-normal text-neutral-600 — no max-w on mobile
- NO mixed font weights in the same text block

IMAGE TREATMENT:
- Full-width images: w-full aspect-[16/9] md:aspect-[3/2], object-cover, overflow-hidden, rounded-none
- Images have NO border-radius — architectural sharp crop
- On mobile, images take full width and stack vertically

SERVICE / CONTENT ROWS (RESPONSIVE GRID):
- Mobile: grid grid-cols-1 divide-y divide-black/10
- Desktop: md:grid-cols-3 md:divide-y-0 md:gap-px md:bg-black/10
- Each cell: bg-white p-5 md:p-8 — headline in font-bold text-lg, descriptor in text-sm text-neutral-500
- Hover: md:hover:bg-neutral-50 transition-colors

TAB / FILTER BARS:
- flex flex-wrap gap-x-4 gap-y-2 — MUST wrap on mobile, NEVER overflow in a single row
- Each tab: text-[11px] uppercase tracking-[0.12em] whitespace-nowrap pb-1 border-b-2 — active: border-black text-black, inactive: border-transparent text-neutral-400

BUTTONS / CTAs:
- Primary: border border-black text-black text-[11px] md:text-[13px] uppercase tracking-[0.12em] px-4 md:px-6 py-2.5 md:py-3 hover:bg-black hover:text-white transition-colors rounded-none
- Secondary: text-[11px] md:text-[13px] uppercase tracking-[0.12em] underline underline-offset-4

COLORS: bg #FFFFFF, surface #F7F7F7, text #0A0A0A, muted #6B6B6B, accent #2563EB (blue for active states only)
AVOID: rounded-full pills, glassmorphism, dark backgrounds, gradient fills, shadow-xl, noise textures, fixed multi-column grids without mobile fallbacks, overflowing nav links on small screens.`
  },

  {
    id: 'glass-clock', name: 'Glass Dark Mode Clock', category: 'Style',
    description: 'Dark instrument panel aesthetic with glassy surfaces and clock dial centerpiece',
    accentColor: '#E8E8E8', font: 'Inter',
    thumbnail: '/skills/glass-clock.png',
    promptContent: `DESIGN SKILL: Glass Dark Mode Clock

SCOPE: Full design-system direction across background, shells, navigation, hero layout, controls, circular focal components, and motion. Use when the interface should feel like a premium dark instrument panel with glassy surfaces and a clock, dial, or calibration-device centerpiece.

VISUAL TARGET:
- Black or near-black base with subtle grid lines, vertical and horizontal beam guides, faint structural crosshairs
- Dark glass or frosted-black surfaces for nav bars, pills, and controls — blur, thin white edge gradients, restrained reflection
- Dominant circular focal element: clock, calibration dial, or resonance instrument with rings, ticks, degrees, or rotating text paths
- Palette mostly monochrome: black, white, zinc, smoky gray — accent brightness from glass highlights and soft white glow, not saturated color
- Precise, scientific, slightly cinematic — circular dial anchors the page like a timekeeping or calibration device

IMPLEMENTATION:
- Frosted shells with thin gradient borders, low-opacity fills, soft backdrop blur for navigation/pills/controls
- Circular centerpiece supported by crosshair lines, calibration marks, mono labels, radial rings, small interface cues
- Clock/dial layered: outer ring, tick marks, rotating labels or text, central core, optional hex or geometric inner frame
- Hero copy clean and sparse — placed beside dial within split layout or balanced two-column composition
- Motion: slow rotating rings, drifting beams, subtle wisps, gentle reveal sequences — continuous and meditative, not flashy
- Glass treatment: dark and premium — controlled smoky fills with crisp highlights, avoid translucent white blobs

PATTERNS:
- Fixed dark nav with backdrop blur and thin bottom border floating above low-contrast grid field
- Eyebrow pills and buttons as glass-dark capsules with 1px highlight wrappers and clean inner dark fill
- Circular hero dial with outer text path, degree labels, rotating tick groups, minimal center emblem
- Background beam lines and crosshairs aligning with circular module and typography
- Soft white wisps, fog, or radial highlight inside dial zone

COLORS: bg #050505, surface rgba(255,255,255,0.04), border rgba(255,255,255,0.1), text #FFFFFF, support #888888
AVOID: Generic pastel glassmorphism, treating clock as decorative afterthought, overloading dial with noise, strong accent colors.`
  },

  {
    id: 'editorial-tech', name: 'Editorial Tech', category: 'Style',
    description: 'Asymmetric editorial compositions with cinematic media bands and precise technical detailing',
    accentColor: '#E8C547', font: 'Inter',
    thumbnail: '/skills/editorial-tech.png',
    promptContent: `DESIGN SKILL: Editorial Tech
OVERRIDE RULES: Disable 3-tone warm rhythm (no #faf8f4 backgrounds). This is a dark editorial layout. Disable rounded-full pills, standard card grids, glassmorphism blobs. All surfaces are dark with precise structural lines.

PAGE SHELL:
- Root: bg-[#0C0C10] text-[#F0F0F0] min-h-screen
- Max width: max-w-[1400px] mx-auto px-6 md:px-12
- Horizontal rule dividers: w-full h-px bg-[#2A2A32] — use between ALL sections, no other decorators

NAVIGATION:
- Fixed top bar: bg-[#0C0C10]/90 backdrop-blur-sm border-b border-[#2A2A32] px-12 py-4 flex justify-between items-center
- Logo area: text-sm uppercase tracking-[0.15em] font-medium
- Nav links: text-[13px] text-[#888] hover:text-white tracking-[0.05em] transition-colors — wide gap-10 between links
- CTA: border border-[#E8C547] text-[#E8C547] text-[12px] uppercase tracking-[0.12em] px-5 py-2 hover:bg-[#E8C547] hover:text-black transition-colors

HERO (MANDATORY ASYMMETRIC LAYOUT):
- grid grid-cols-12 gap-6 items-start pt-32 pb-20
- Headline column: col-span-7 — text-[clamp(3.5rem,8vw,8rem)] font-black leading-[0.92] tracking-[-0.03em] text-white
- Accent word/phrase: text-[#E8C547] (one or two words max)
- Media column: col-span-5 — aspect-[4/5] overflow-hidden relative. Image with object-cover, no border-radius
- Small label above headline: text-[11px] uppercase tracking-[0.2em] text-[#E8C547] mb-6 border-l-2 border-[#E8C547] pl-3

CINEMATIC MEDIA BANDS:
- Full-width horizontal image strip: w-full h-[35vh] overflow-hidden relative — image spans edge to edge, object-cover object-center
- OR: offset panel grid-cols-12 where image col-span-7 and text col-span-5, overlapping with negative margin

CONTENT MODULES (info rows, features, steps):
- grid grid-cols-3 or grid-cols-4 gap-0 — cells separated by border-r border-[#2A2A32] and border-t border-[#2A2A32]
- Each cell: px-8 py-10 — step number in font-mono text-[11px] text-[#E8C547] mb-4, title in text-xl font-bold, desc in text-sm text-[#888] leading-relaxed
- Counter/numbering: 01 02 03 in monospace, top-left of each cell

TYPOGRAPHY:
- Display: font-black or font-bold, tight tracking (-0.03em to -0.05em), large scale
- Labels/metadata: font-mono text-[11px] uppercase tracking-[0.15em] text-[#888] or text-[#E8C547]
- Body: text-[15px] text-[#888] leading-relaxed max-w-prose

COLORS: bg #0C0C10, surface #141418, border #2A2A32, text #F0F0F0, muted #888888, accent #E8C547
AVOID: rounded-full pills, glassmorphism blobs, warm beige tones, light backgrounds, generic card grids, accent color on more than 10% of elements.`
  },

  {
    id: 'skeuomorphic', name: 'High Contrast Skeuomorphic', category: 'Style',
    description: 'Tactile industrial-clean surfaces with deep contrast, inset highlights, and premium depth',
    accentColor: '#00D4AA', font: 'Inter',
    thumbnail: '/skills/skeuomorphic.png',
    promptContent: `DESIGN SKILL: High Contrast Skeuomorphic Clean

SCOPE: Full design-system direction across page shell, hero, cards, controls, supporting modules, and micro-visualizations. Use when the interface should feel tactile, premium, and industrial-clean, with real surface depth and contrast rather than flat minimal cards. Not playful neumorphism and not glossy consumer skeuomorphism — sharp, modern, and system-like.

VISUAL TARGET:
- Strong contrast relationship: light or neutral outer page framing a deep black or charcoal primary application shell
- Dark premium surfaces with subtle vertical or radial gradients — panels feel molded and dimensional, not flat
- True skeuomorphic depth through inset highlights, soft inner shadows, reflective edge cues, nested object-like modules — clean and controlled
- One restrained signal accent color for status lights, active markers, tiny progress details, focal emphasis
- Clean sans-serif paired with occasional mono labels — precise, not ornamental

IMPLEMENTATION:
- One dominant rounded or softly chamfered master container holding the whole interface inside darker premium shell
- Cards/modules: one-pixel wrappers, top-edge highlights, dark-to-darker fills, inset shadow stacks, soft outer shadow falloff
- High contrast: white/near-white text on black shells, muted gray support copy, clear separation between interactive and passive surfaces
- Skeuomorphic objects selectively: browser windows, search fields, progress bars, orbit widgets, document tiles, instrument modules
- Buttons/inputs/chips: touchable — layered fill, subtle bevel or inset edge, clean rounded geometry, measured hover brightness
- Fine structural framing with quiet border lines, corner markers, interior guide rails
- Motion: masked reveals, gentle object lift, slow orbiting details, subtle shimmer on highlights, calm particle drift

PATTERNS:
- Large dark industrial shell on lighter background with generous radius and premium shadow weight
- Rounded cards with thin white-to-transparent gradient borders, dark inner fills, soft inset lighting
- Micro visual modules: orbit diagrams, search plates, document chrome, status widgets as tactile objects
- Accent signal dots, progress slivers, active labels sparingly against mostly monochrome system
- Split compositions: bold editorial copy one side, stacked molded product modules other side

COLORS: outer-bg #F0F0F0, shell #0D0D0D, surface #1A1A1A, border rgba(255,255,255,0.08), text #FFFFFF, accent #00D4AA
AVOID: Soft washed-out neumorphism, overly glossy retro skeuomorphism, flat dark UI ignoring tactile character, too many accents.`
  },

  {
    id: 'paper-technical', name: 'Light Mode Paper Technical', category: 'Style',
    description: 'Warm parchment surfaces framed by dark outer shell with precise technical structure',
    accentColor: '#E85D26', font: 'Inter',
    thumbnail: '/skills/paper-technical.png',
    promptContent: `DESIGN SKILL: Light Mode Paper Technical

SCOPE: Full design-system direction across shell, layout, typography, navigation, cards, mockups, background treatment, and motion. Use when the interface should feel bright, refined, and technical — warmer and more tactile than cold white enterprise dashboard, combining paper-like surfaces with precise product-tech framing.

VISUAL TARGET:
- Warm off-white, parchment, or soft paper-toned surfaces instead of stark white
- Lighter interior wrapped inside darker outer shell — content area feels framed, elevated, intentional
- Subtle technical structure: thin borders, inset rules, L-brackets, tiny corner details, diagonal background texture, measured spatial guides
- One restrained accent for active states, labels, progress, focal details — punctuates, not dominates
- Premium and contemporary: rounded container shells acceptable, internal layout logic crisp and technical

IMPLEMENTATION:
- Framed master container with generous radius, soft shadow, light paper interior against darker page background
- Warm neutrals for primary surfaces, slightly darker paper tones for layers, gentle contrast — not bright white-on-gray UI
- Low-contrast diagonal texture or fine patterning to large paper regions — material and lightly engineered
- Clean sans-serif for interface content, optional mono utility text for timestamps, captions, browser chrome, metadata
- Product surfaces (app mockups, transcript panes, sidebars, session cards): bright clean interiors, careful spacing, delicate border hierarchy
- Motion: calm and polished — masked headline reveals, fade-up sections, controlled card entrance, subtle activity indicators

PATTERNS:
- Dark outer page with large light rounded container holding the whole experience
- Inner framing system: inset border rectangles, small corner brackets, quiet technical lines over paper-toned backgrounds
- Warm light app panels with browser chrome, transcript windows, sidebars, or dashboard modules nested inside main shell
- Accent-driven live states: active bullets, tiny dividers, progress marks, highlighted words, primary CTAs
- Paper-technical contrast: soft readable surfaces paired with precise geometry and system-level visual discipline

COLORS: outer-bg #1A1410, container #F5EFE6, surface #EDE5D5, border #D4C8B5, text #2A1F14, accent #E85D26
AVOID: Flat plain white SaaS, heavy vintage paper distressing, cold enterprise blue-gray systems, over-softening, excessive accent.`
  },
];

// Cache for fetched DESIGN.md content
const DESIGN_MD_CACHE = {};

async function fetchDesignMd(styleId) {
  if (DESIGN_MD_CACHE[styleId]) return DESIGN_MD_CACHE[styleId];

  if (styleId === 'taste-skill') {
    try {
      const url = 'https://raw.githubusercontent.com/Leonxlnx/taste-skill/main/skills/taste-skill/SKILL.md';
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const content = await res.text();
      DESIGN_MD_CACHE[styleId] = content;
      console.log(`Cached DESIGN.md for taste-skill (${content.length} chars)`);
      return content;
    } catch (err) {
      console.warn(`[Warning] Failed to fetch DESIGN.md for taste-skill:`, err.message);
      return null;
    }
  }

  // Prompt skills have inline content — no GitHub fetch needed
  const skillObj = UI_STYLES_CATALOG.find(s => s.id === styleId);
  if (skillObj?.promptContent) {
    DESIGN_MD_CACHE[styleId] = skillObj.promptContent;
    return skillObj.promptContent;
  }

  // Map style IDs to their repo folder names
  const folderMap = {
    stripe: 'stripe', linear: 'linear.app', vercel: 'vercel', notion: 'notion',
    superhuman: 'superhuman', supabase: 'supabase', spotify: 'spotify',
    apple: 'apple', airbnb: 'airbnb', shopify: 'shopify', revolut: 'revolut',
    figma: 'figma', nike: 'nike', tesla: 'tesla'
  };
  const folder = folderMap[styleId];
  if (!folder) return null;
  
  try {
    const url = `https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/${folder}/DESIGN.md`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const content = await res.text();
    DESIGN_MD_CACHE[styleId] = content;
    console.log(`Cached DESIGN.md for ${styleId} (${content.length} chars)`);
    return content;
  } catch (err) {
    console.warn(`[Warning] Failed to fetch DESIGN.md for ${styleId}:`, err.message);
    return null;
  }
}

// Pre-cache all prompt skills at startup (no network fetch needed — inline content)
setTimeout(() => {
  UI_STYLES_CATALOG.forEach(s => { if (s.promptContent) fetchDesignMd(s.id).catch(() => {}); });
}, 2000);

const router = express.Router();

// Setup local uploads directory
const uploadDir = process.env.VERCEL ? '/tmp' : join(__dirname, 'uploads');
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
} catch (err) {
  console.warn('[Warning] Writable uploads directory warning:', err.message);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// POST /api/agentic-ui/upload — Upload screenshot
router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const relativePath = `/uploads/${req.file.filename}`;
  res.json({
    success: true,
    url: relativePath,
    path: req.file.path
  });
});

// ── Agentic UI Credit Helpers ─────────────────────────────────────────

/**
 * Returns { used, limit, remaining, isUnlimited } for agentic UI generations.
 * Trial credits are lifetime (never reset). Paid plans reset monthly.
 */
function getAgenticQuota(user) {
  const limits = CREDIT_LIMITS[user.role] || CREDIT_LIMITS.trial;
  const planLimit = limits.agenticGenerations ?? 0;
  const isUnlimited = planLimit === Infinity;
  const used = user.usage?.agenticGenerations || 0;

  // If user role is trial and their 7-day trial has expired, set remaining generations to 0
  const isTrialExpired = typeof user.isTrialExpired === 'function' ? user.isTrialExpired() : false;
  const remaining = isUnlimited ? Infinity : (isTrialExpired ? 0 : Math.max(0, planLimit - used));

  return { used, limit: planLimit, remaining, isUnlimited, isTrialExpired };
}

/**
 * Atomically deducts one agentic generation from the user's usage.
 * No-ops for unlimited plans.
 */
async function deductAgenticCredit(user) {
  const limits = CREDIT_LIMITS[user.role] || CREDIT_LIMITS.trial;
  if (limits.agenticGenerations === Infinity) return; // unlimited — skip
  const usage = { ...(user.usage || {}) };
  usage.agenticGenerations = (usage.agenticGenerations || 0) + 1;
  await UserService.updateUser(user.id, { usage });
}

// GET /api/agentic-ui/styles — Return available UI styles
router.get('/styles', (req, res) => {
  res.json({ styles: UI_STYLES_CATALOG });
});

// ── Config ────────────────────────────────────────────────────────────
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-chat';
const modelStorage = new AsyncLocalStorage();
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;

const DEVICE_SPECS = {
  web:    { width: 1440, height: 900,  statusBar: false, label: 'Desktop Web' },
  ios:    { width: 393,  height: 852,  statusBar: false, label: 'iPhone 15' },
  tablet: { width: 1366, height: 1024, statusBar: false, label: 'iPad Pro (Landscape)' },
};

// ── Mini-Tool: WCAG Contrast ──────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0,2),16), parseInt(h.slice(2,4),16), parseInt(h.slice(4,6),16)];
}

function relativeLuminance([r, g, b]) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function rgbToHex([r, g, b]) {
  return '#' + [r, g, b].map(c => Math.min(255, Math.max(0, Math.round(c))).toString(16).padStart(2, '0')).join('');
}

// HSL helpers for color contrast adjustments
function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToRgb([h, s, l]) {
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [r * 255, g * 255, b * 255];
}

function ensureContrast(hexText, hexBg, minContrast = 4.5) {
  try {
    let textRgb = hexToRgb(hexText);
    let bgRgb = hexToRgb(hexBg);
    let bgL = relativeLuminance(bgRgb);
    
    let ratio = contrastRatio(rgbToHex(textRgb), rgbToHex(bgRgb));
    if (ratio >= minContrast) return rgbToHex(textRgb);
    
    let [h, s, l] = rgbToHsl(textRgb);
    
    if (bgL > 0.5) {
      // Light bg -> make text darker (decrease L)
      for (let step = 0; step < 20; step++) {
        l = Math.max(0, l - 0.05);
        const testHex = rgbToHex(hslToRgb([h, s, l]));
        if (contrastRatio(testHex, rgbToHex(bgRgb)) >= minContrast) {
          return testHex;
        }
      }
      return '#000000';
    } else {
      // Dark bg -> make text lighter (increase L)
      for (let step = 0; step < 20; step++) {
        l = Math.min(1, l + 0.05);
        const testHex = rgbToHex(hslToRgb([h, s, l]));
        if (contrastRatio(testHex, rgbToHex(bgRgb)) >= minContrast) {
          return testHex;
        }
      }
      return '#FFFFFF';
    }
  } catch (e) {
    return hexText;
  }
}

function validateAndCleanPalette(rawPalette, theme) {
  const fallback = theme === 'light' ? {
    name: 'Light Minimal',
    theme: 'light',
    background: '#FAFAFA',
    surface: '#FFFFFF',
    primary: '#3B82F6',
    accent: '#3B82F6',
    accent2: '#10B981',
    supporting: '#F59E0B',
    textPrimary: '#111827',
    textSecondary: '#4B5563',
    border: 'rgba(0,0,0,0.06)'
  } : {
    name: 'Dark Slate',
    theme: 'dark',
    background: '#090A0F',
    surface: '#12131C',
    primary: '#6C5CE7',
    accent: '#6C5CE7',
    accent2: '#00D2FF',
    supporting: '#A855F7',
    textPrimary: '#F5F5F7',
    textSecondary: '#8B8D97',
    border: 'rgba(255,255,255,0.08)'
  };

  const safe = rawPalette || {};
  const clean = {};
  const keys = ['background', 'surface', 'primary', 'accent', 'accent2', 'supporting', 'textPrimary', 'textSecondary', 'border'];
  
  for (const key of keys) {
    let val = safe[key];
    if (typeof val === 'string') {
      if (!val.startsWith('#')) val = '#' + val;
      if (val.length === 4) {
        val = '#' + val[1] + val[1] + val[2] + val[2] + val[3] + val[3];
      }
      if (/^#[0-9a-fA-F]{6}$/.test(val)) {
        clean[key] = val;
        continue;
      }
    }
    clean[key] = fallback[key];
  }
  
  clean.textPrimary = ensureContrast(clean.textPrimary, clean.background, 4.5);
  clean.textPrimary = ensureContrast(clean.textPrimary, clean.surface, 4.5);
  
  let bgRgb = hexToRgb(clean.background);
  let sfRgb = hexToRgb(clean.surface);
  let [bgH, bgS, bgL] = rgbToHsl(bgRgb);
  let [sfH, sfS, sfL] = rgbToHsl(sfRgb);
  if (Math.abs(bgL - sfL) < 0.06) {
    if (theme === 'dark') {
      sfL = Math.min(1, bgL + 0.08);
    } else {
      bgL = Math.max(0, sfL - 0.08);
    }
    clean.background = rgbToHex(hslToRgb([bgH, bgS, bgL]));
    clean.surface = rgbToHex(hslToRgb([sfH, sfS, sfL]));
  }
  
  let pmRgb = hexToRgb(clean.primary);
  let acRgb = hexToRgb(clean.accent2);
  let [pmH, pmS, pmL] = rgbToHsl(pmRgb);
  let [acH, acS, acL] = rgbToHsl(acRgb);
  if (Math.abs(pmL - acL) < 0.1 && Math.abs(pmH - acH) < 0.1) {
    acH = (pmH + 0.2) % 1.0;
    acL = pmL > 0.5 ? Math.max(0.2, pmL - 0.25) : Math.min(0.8, pmL + 0.25);
    clean.accent2 = rgbToHex(hslToRgb([acH, acS, acL]));
  }
  
  let ratioWhite = contrastRatio('#FFFFFF', clean.primary);
  let ratioBlack = contrastRatio('#111827', clean.primary);
  if (Math.max(ratioWhite, ratioBlack) < 4.5) {
    let primaryRgb = hexToRgb(clean.primary);
    let [h, s, l] = rgbToHsl(primaryRgb);
    if (l > 0.5) {
      clean.primary = ensureContrast(clean.primary, '#111827', 4.5);
    } else {
      clean.primary = ensureContrast(clean.primary, '#FFFFFF', 4.5);
    }
  }
  
  clean.name = rawPalette.name || fallback.name;
  clean.reason = rawPalette.reason || 'AI generated contrast-compliant color palette';
  clean.theme = theme;
  return clean;
}

async function brainGeneratePalette({ prompt, platform, theme, selectedSkill, visualAssetMode }) {
  const systemPrompt = `You are a world-class UI color theorist and brand designer.
Your job is to generate a custom, context-aware color palette for a UI screen based on the user's prompt and details.
You must return ONLY a valid JSON object matching the schema below. Do NOT output markdown code blocks or explanations.

JSON SCHEMA:
{
  "name": "Short creative palette name",
  "reason": "One short sentence explaining why this palette suits the product",
  "background": "#RRGGBB (neutral page background)",
  "surface": "#RRGGBB (card surface, slightly lighter or darker than background)",
  "primary": "#RRGGBB (brand primary color)",
  "accent": "#RRGGBB (vibrant interactive/CTA accent color)",
  "accent2": "#RRGGBB (supporting accent color, contrasting with primary/accent)",
  "supporting": "#RRGGBB (neutral supporting color)",
  "textPrimary": "#RRGGBB (body and title text - MUST have 4.5:1 contrast against background and surface)",
  "textSecondary": "#RRGGBB (secondary text)",
  "border": "#RRGGBB (subtle border color)"
}

PALETTE DESIGN RULES:
1. Product Fit: Do NOT use simplistic mappings (like green for all plant apps, blue for all finance apps). Choose deliberate, modern, sophisticated color relationships.
2. Readability: Contrast is absolute. Text must be perfectly readable.
3. Harmony: Pick a coherent color palette (usually ~5 visual colors). Avoid rainbows or clashy palettes unless requested.
4. Theme: Make sure colors match the requested theme ("dark" or "light").`;

  const userPrompt = `USER PROMPT: "${prompt}"
PLATFORM: ${platform || 'ios'}
THEME: ${theme || 'dark'}
VISUAL ASSET MODE: ${visualAssetMode || 'mixed'}
SELECTED SKILL ID: ${selectedSkill || 'none'}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 1200);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return validateAndCleanPalette(parsed, theme || 'dark');
  } catch (err) {
    console.error('[Error] [AI Palette] DeepSeek palette generation failed:', err.message);
    throw err;
  }
}

async function isUrlAccessible(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    try {
      const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(1000) });
      return res.ok;
    } catch {
      return false;
    }
  }
}

// ── Mini-Tool: Color Palette from References ──────────────────────────
function derivePalette(references, theme) {
  // Average the color palettes from references
  const allColors = references.flatMap(r => r.colors || []).filter(c => Array.isArray(c) && c.length === 3);
  if (allColors.length === 0) {
    // Fallback palette
    return theme === 'dark' ? {
      background: '#0F1117', surface: '#1A1D27', border: '#2A2D37',
      textPrimary: '#F5F5F7', textSecondary: '#8B8D97',
      accent: '#6C5CE7', accentSecondary: '#00D2FF',
      success: '#34D399', warning: '#FBBF24', error: '#EF4444'
    } : {
      background: '#FFFFFF', surface: '#F8F9FA', border: '#E5E7EB',
      textPrimary: '#111827', textSecondary: '#6B7280',
      accent: '#6366F1', accentSecondary: '#06B6D4',
      success: '#10B981', warning: '#F59E0B', error: '#EF4444'
    };
  }

  // Sort by luminance to find bg/surface/accent
  const sorted = allColors.map(c => ({ rgb: c, lum: relativeLuminance(c) }))
    .sort((a, b) => a.lum - b.lum);

  if (theme === 'dark') {
    const bg = sorted[0]?.rgb || [15, 17, 23];
    const surface = sorted[Math.min(1, sorted.length - 1)]?.rgb || [26, 29, 39];
    const accent = sorted[Math.floor(sorted.length * 0.6)]?.rgb || [108, 92, 231];
    return {
      background: rgbToHex(bg), surface: rgbToHex(surface),
      border: rgbToHex(surface.map(c => Math.min(255, c + 20))),
      textPrimary: '#F5F5F7', textSecondary: '#8B8D97',
      accent: rgbToHex(accent), accentSecondary: '#00D2FF',
      success: '#34D399', warning: '#FBBF24', error: '#EF4444'
    };
  } else {
    const bg = sorted[sorted.length - 1]?.rgb || [255, 255, 255];
    const surface = sorted[Math.max(0, sorted.length - 2)]?.rgb || [248, 249, 250];
    const accent = sorted[Math.floor(sorted.length * 0.4)]?.rgb || [99, 102, 241];
    return {
      background: rgbToHex(bg), surface: rgbToHex(surface),
      border: rgbToHex(surface.map(c => Math.max(0, c - 20))),
      textPrimary: '#111827', textSecondary: '#6B7280',
      accent: rgbToHex(accent), accentSecondary: '#06B6D4',
      success: '#10B981', warning: '#F59E0B', error: '#EF4444'
    };
  }
}

// ── Mini-Tool: Font Derivation from References ──────────────────────
function deriveFonts(references) {
  const fontCounts = {};
  references.forEach(r => {
    (r.fonts || []).forEach(f => {
      if (f && f !== 'Unknown') fontCounts[f] = (fontCounts[f] || 0) + 1;
    });
  });
  const sorted = Object.entries(fontCounts).sort((a, b) => b[1] - a[1]);
  return {
    heading: sorted[0]?.[0] || 'Inter',
    body: sorted[1]?.[0] || sorted[0]?.[0] || 'Inter',
    mono: 'JetBrains Mono'
  };
}

// ── Mini-Tool: Icon Fetcher (Iconify API) — with in-memory cache ──────
const ICON_CACHE = {};
async function fetchIcons(names, setPrefix = 'solar') {
  const icons = {};
  const fetches = names.slice(0, 12).map(async (name) => {
    const cacheKey = `${setPrefix}:${name}`;
    if (ICON_CACHE[cacheKey]) { icons[name] = ICON_CACHE[cacheKey]; return; }
    try {
      const res = await fetch(`https://api.iconify.design/${setPrefix}/${name}.svg?width=24&height=24`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) { const svg = await res.text(); icons[name] = svg; ICON_CACHE[cacheKey] = svg; }
    } catch {}
  });
  await Promise.allSettled(fetches);
  return icons;
}

// ── Mini-Tool: Avatar Fetcher (DiceBear) ──────────────────────────────
function getAvatarUrls(count = 3, style = 'notionists') {
  return Array.from({ length: count }, (_, i) =>
    `https://api.dicebear.com/9.x/${style}/svg?seed=user${i + 1}&size=48`
  );
}

// ── Mini-Tool: Chart Generator ────────────────────────────────────────
function generateLineChart(w, h, accentColor) {
  const points = [28, 45, 32, 68, 54, 72, 60, 85, 78, 92];
  const maxVal = Math.max(...points);
  const coords = points.map((v, i) => ({
    x: (i / (points.length - 1)) * w,
    y: h - (v / maxVal) * h * 0.85
  }));
  const pathD = coords.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
    const prev = coords[i - 1];
    const cpx = ((prev.x + p.x) / 2).toFixed(1);
    return `${acc} C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${p.y.toFixed(1)}, ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }, '');
  return `<g id="line-chart"><path d="${pathD}" fill="none" stroke="${accentColor}" stroke-width="2.5" stroke-linecap="round"/><path d="${pathD} L ${w} ${h} L 0 ${h} Z" fill="${accentColor}" opacity="0.08"/></g>`;
}

function generateBarChart(w, h, accentColor) {
  const data = [65, 45, 80, 55, 90, 70, 85];
  const barW = w / (data.length * 2);
  const maxVal = Math.max(...data);
  const bars = data.map((v, i) => {
    const bh = (v / maxVal) * h * 0.85;
    const x = i * (barW * 2) + barW * 0.5;
    return `<rect x="${x.toFixed(1)}" y="${(h - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="4" fill="${accentColor}" opacity="${0.6 + (i % 2) * 0.4}"/>`;
  }).join('');
  return `<g id="bar-chart">${bars}</g>`;
}

function generateDonutChart(size, colors) {
  const data = [35, 25, 20, 20];
  const r = size / 2 - 8;
  const cx = size / 2, cy = size / 2;
  let startAngle = -90;
  const arcs = data.map((pct, i) => {
    const angle = (pct / 100) * 360;
    const endAngle = startAngle + angle;
    const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180);
    const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180);
    const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180);
    const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180);
    const largeArc = angle > 180 ? 1 : 0;
    startAngle = endAngle;
    const color = [colors.accent, colors.accentSecondary, colors.success, colors.warning][i];
    return `<path d="M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z" fill="${color}" opacity="0.85"/>`;
  }).join('');
  return `<g id="donut-chart">${arcs}<circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="${colors.background}"/></g>`;
}

// ── Mini-Tool: Stock Images (Aura Asset Images) ───────────────────────
const CURATED_AURA_ASSETS = {
  background: [
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fa51902b-c2a4-4c33-a96e-a8f1ef67edc6_3840w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/d14dc069-558a-4c51-8aad-5cc237f9b61d_3840w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/75134536-4198-40bf-9944-315511fe8c0b_3840w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/c31dd008-598b-4fc9-b5c7-9c3e1d296d38_3840w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/a4780cd9-2a3d-4bdc-9e5f-85a097b3a8bf_3840w.webp"
  ],
  abstract: [
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/4734259a-bad7-422f-981e-ce01e79184f2_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/e534354d-c5f2-4399-a1d9-2f50338e8c47_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/d14dc069-558a-4c51-8aad-5cc237f9b61d_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fa51902b-c2a4-4c33-a96e-a8f1ef67edc6_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/bfef5098-c30f-4cd9-b4ac-04b2673ab943_1600w.jpg"
  ],
  architecture: [
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/724142aa-44a6-48d3-9cf3-761e00d05b78_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/005600e5-f6ab-4e59-bc86-eaeb02797dfa_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/5ee0a38a-b5d3-4531-8793-98beed4af162_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/7f78131e-65e9-49b2-aa1f-ccc33e28df9f_1600w.webp",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/fb6415fd-bf4d-4ccf-8e9d-7ab445e99207_1600w.jpg"
  ],
  portrait: [
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/0d868fef-f560-45ca-ab35-5dad4fc29059_3840w.webp",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/3186f9ea-5f5a-49f7-8fcf-568ad52f515e_3840w.webp",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/65695f80-23f9-46ee-8487-cbb6c93cc48b_3840w.webp",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/0d063fd9-f7c1-4536-ade0-9fd133f07279_3840w.webp",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/582afef4-b810-47b8-a047-8b3597c323e1_3840w.webp"
  ],
  headshot: [
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/2f563338-39fa-47ea-9761-658d4f3f84db_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/4f5668c5-fc4a-44e0-bc5e-a664189d3c31_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/eca707cc-a5b7-439a-b4fd-247f6106c2e1_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/77415a2e-dcbc-4748-a29d-fced4821881a_1600w.jpg",
    "https://hoirqrkdgbmvpwutwuwj.supabase.co/storage/v1/object/public/assets/assets/c92852bb-a510-405a-85ab-ffa0fde136a4_1600w.jpg"
  ]
};

async function fetchStockImages(queries, count = 4) {
  const results = [];
  const seenUrls = new Set();

  const addImage = (url, alt) => {
    if (!url || seenUrls.has(url)) return false;
    seenUrls.add(url);
    results.push({ url, thumb: url, color: '#F3F4F6', alt: alt || 'Aura Asset', credit: 'Aura Build Assets' });
    return true;
  };

  const queryList = Array.isArray(queries)
    ? queries.filter(Boolean)
    : String(queries || '').split(/[,;]+/).map(q => q.trim()).filter(Boolean);

  const AURA_KEY = process.env.AURA_KEY || process.env.SUPABASE_KEY || '';
  const perQuery = Math.ceil((count + 2) / Math.max(queryList.length, 1)) + 2;
  const AURA_HEADERS = { 'apikey': AURA_KEY, 'Authorization': `Bearer ${AURA_KEY}` };

  // ── Run one Aura DB query per term, in parallel ────────────────────────
  // Searches: title (text ilike), description (text ilike), AND keywords array (cs per word).
  // Previously used tags.ilike which does not exist — that caused every query to 500.
  const queryResults = await Promise.all(queryList.map(async (query) => {
    const cleanQ = query.trim().toLowerCase();
    const local = [];

    try {
      const eq = encodeURIComponent(cleanQ);
      // Split multi-word queries into individual words for keyword array matching.
      // keywords is a jsonb/text[] column; use cs.{word} (array contains exact string).
      const words = cleanQ.split(/\s+/).filter(w => w.length > 2);
      const kwClauses = words.map(w => `keywords.cs.%7B${encodeURIComponent(w)}%7D`).join(',');
      const orParts = [`title.ilike.*${eq}*`, `description.ilike.*${eq}*`, ...words.map(w => `keywords.cs.%7B${encodeURIComponent(w)}%7D`)];
      const url = `https://hoirqrkdgbmvpwutwuwj.supabase.co/rest/v1/assets?or=(${orParts.join(',')})&select=image_1600w,image_800w,title&active=eq.true&order=views.desc.nullslast&limit=${perQuery}`;

      const resp = await fetch(url, { headers: AURA_HEADERS, signal: AbortSignal.timeout(5000) });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data)) {
          for (const row of data) {
            if (local.length >= perQuery) break;
            const imgUrl = row.image_1600w || row.image_800w;
            if (imgUrl) {
              const cleanUrl = imgUrl.replace('-all.supabase.co', '.supabase.co');
              local.push({ url: cleanUrl, alt: row.title || cleanQ });
            }
          }
        }
      } else {
        console.error(`[Warning] Aura DB ${resp.status} for "${query}":`, await resp.text().catch(() => ''));
      }
    } catch (err) {
      console.error(`[Warning] Aura DB query error for "${query}":`, err.message);
    }
    return local;
  }));

  // ── Interleave results so each query contributes evenly ───────────────
  const maxRows = Math.max(...queryResults.map(r => r.length), 0);
  for (let i = 0; i < maxRows && results.length < count; i++) {
    for (const qr of queryResults) {
      if (results.length >= count) break;
      if (qr[i]) addImage(qr[i].url, qr[i].alt);
    }
  }

  // Validate stock image URLs
  const validatedResults = [];
  const checks = results.map(async (img) => {
    const ok = await isUrlAccessible(img.url);
    if (ok) {
      validatedResults.push(img);
    } else {
      console.warn(`[Warning] [Images] Inaccessible stock image removed: ${img.url}`);
    }
  });
  await Promise.all(checks);

  // If validation removed some and we have less than count, fill with local fallbacks
  if (validatedResults.length < count) {
    const combined = queryList.join(' ').toLowerCase();
    let fallback;
    if (combined.match(/fashion|beauty|skincare|portrait|woman|model|luxury|editorial/)) fallback = CURATED_AURA_ASSETS.portrait;
    else if (combined.match(/person|people|team|corporate|professional|headshot|avatar/))  fallback = [...CURATED_AURA_ASSETS.portrait, ...CURATED_AURA_ASSETS.headshot];
    else if (combined.match(/home|house|room|interior|hotel|architecture|villa|resort/))   fallback = CURATED_AURA_ASSETS.architecture;
    else fallback = [...CURATED_AURA_ASSETS.abstract, ...CURATED_AURA_ASSETS.background];
    
    for (const url of fallback) {
      if (validatedResults.length >= count) break;
      if (!validatedResults.some(r => r.url === url)) {
        validatedResults.push({ url, thumb: url, color: '#F3F4F6', alt: 'Asset', credit: 'Aura Build Assets' });
      }
    }
  }

  if (validatedResults.length < count) {
    const allCurated = Object.values(CURATED_AURA_ASSETS).flat().sort(() => Math.random() - 0.5);
    for (const url of allCurated) {
      if (validatedResults.length >= count) break;
      if (!validatedResults.some(r => r.url === url)) {
        validatedResults.push({ url, thumb: url, color: '#F3F4F6', alt: 'Asset', credit: 'Aura Build Assets' });
      }
    }
  }

  console.log(`fetchStockImages: ${validatedResults.length}/${count} validated URLs.`);
  return validatedResults.slice(0, count);
}

// DEAD CODE BELOW — kept only so the old call-path compiles; remove after next cleanup
async function _fetchStockImages_legacy(query, count = 4) {
  const results = [];
  const seenUrls = new Set();
  const cleanQuery = query.trim().toLowerCase();

  const addImage = (url, alt) => {
    if (!url || seenUrls.has(url)) return;
    seenUrls.add(url);
    results.push({
      url: url,
      thumb: url,
      color: '#F3F4F6',
      alt: alt || 'Aura Asset',
      credit: 'Aura Build Assets'
    });
  };

  // 2. Query Aura's Supabase DB dynamically
  if (results.length < count) {
    const remaining = count - results.length;
    try {
      console.log(`Querying Aura's Supabase DB for: "${cleanQuery}"`);
      const urlEscapedQuery = encodeURIComponent(cleanQuery);
      const auraApiUrl = `https://hoirqrkdgbmvpwutwuwj.supabase.co/rest/v1/assets?or=(title.ilike.*${urlEscapedQuery}*,description.ilike.*${urlEscapedQuery}*)&limit=${remaining * 2}`;

      const response = await fetch(auraApiUrl, {
        headers: {
          'apikey': AURA_KEY,
          'Authorization': `Bearer ${AURA_KEY}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          for (const row of data) {
            if (results.length >= count) break;
            const imgUrl = row.image_1600w || row.image_800w || row.image_3840w || row.image_original;
            if (imgUrl) {
              const cleanUrl = imgUrl.replace('-all.supabase.co', '.supabase.co');
              addImage(cleanUrl, row.title || row.description);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Warning] Aura DB query error:', err.message);
    }
  }

  return results;
}

// ── Mini-Tool: Noise Gradient Generator ───────────────────────────────
function generateNoiseGradient(colors) {
  const accent = colors.accent || '#6C5CE7';
  const accent2 = colors.accentSecondary || '#00D2FF';
  const bg = colors.background || '#0A0A0F';
  const surface = colors.surface || '#1A1D27';
  return `<!-- NOISE GRADIENT SNIPPET: Use this for hero sections, feature backgrounds, or banner areas -->
<style>
  .noise-gradient-bg {
    position: relative;
    overflow: hidden;
  }
  .noise-gradient-bg::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse at 20% 50%, ${accent}44 0%, transparent 50%),
      radial-gradient(ellipse at 80% 20%, ${accent2}33 0%, transparent 50%),
      radial-gradient(ellipse at 50% 80%, ${surface} 0%, transparent 60%);
    background-color: ${bg};
    z-index: 0;
  }
  .noise-gradient-bg::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    opacity: 0.30;
    mix-blend-mode: overlay;
    z-index: 1;
  }
  .noise-gradient-bg > * {
    position: relative;
    z-index: 2;
  }
</style>`;
}

// ── Mini-Tool: Logo Fetcher ───────────────────────────────────────────
function getLogoUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

// ── Mini-Tool: Logo Placeholders ─────────────────────────────────────
function getPlaceholderLogo(seed = 'App') {
  return `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(seed)}&colors=6c5ce7,00d2ff,34d399,a855f7,ff6b35`;
}

// ── DeepSeek Reasoner API Call ───────────────────────────────────────────
async function callDeepSeek(systemPrompt, userPrompt, maxTokens = 8000, attempt = 1) {
  const startMs = Date.now();
  const selectedModel = modelStorage.getStore() || DEEPSEEK_MODEL;
  const isReasoner = selectedModel === 'deepseek-reasoner';

  const bodyPayload = {
    model: selectedModel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    stream: false
  };

  // deepseek-reasoner does not support temperature/penalty parameters
  if (!isReasoner) {
    bodyPayload.max_tokens = maxTokens;
    bodyPayload.temperature = attempt > 1 ? 0.5 : 0.7;
    bodyPayload.frequency_penalty = attempt > 1 ? 0.5 : 0.0;
  }

  const res = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
    body: JSON.stringify(bodyPayload)
  });

  if (!res.ok) {
    const err = await res.text();
    // Handle DeepSeek's loop detection (HTTP error variant)
    if (err.includes('looping content') && attempt <= 2) {
      console.log(`  [Warning] Loop detected in HTTP error (attempt ${attempt}), retrying...`);
      return callDeepSeek(systemPrompt, userPrompt, maxTokens, attempt + 1);
    }
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  const reasoningContent = data.choices?.[0]?.message?.reasoning_content || '';

  if (reasoningContent) {
    console.log(`\n[DeepSeek Reasoner CoT - Thinking Process]:\n${reasoningContent}\n`);
  }

  console.log(`    DeepSeek call took ${Date.now() - startMs}ms (attempt ${attempt})`);

  // Handle DeepSeek's loop detection (200 OK but error in content)
  if (content.includes('looping content') || content.includes('flagged for looping')) {
    if (attempt <= 2) {
      console.log(`  [Warning] Loop detected in response content (attempt ${attempt}), retrying with anti-repetition...`);
      return callDeepSeek(systemPrompt, userPrompt, maxTokens, attempt + 1);
    }
    console.warn(`  [Warning] Loop detection persists after ${attempt} attempts, proceeding anyway`);
  }

  return content;
}

// ── DeepSeek Vision Pipeline ──
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

async function callVisionAPI(systemPrompt, contentParts, maxTokens = 8000) {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured — vision analysis unavailable');
  }
  const startMs = Date.now();
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: contentParts }
      ],
      max_tokens: maxTokens,
      temperature: 0.7
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vision API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  console.log(`    OpenAI GPT-4o Vision call took ${Date.now() - startMs}ms`);
  return data.choices?.[0]?.message?.content || '';
}

// ── Brain Call 1: Understand + Clarify ─────────────────────────────────
async function brainUnderstand(userQuery, isFollowUp = false) {
  const bypassKeywords = [
    'you decide', 'you deceide', 'you decied', 'you deiced',
    'decide everything', 'deceide everything', 'choose the colors', 'choose the font',
    'use your judgment', 'use your judgement', 'create it directly', 'surprise me',
    'up to you', 'go ahead', 'decide the color', 'deceide the color'
  ];
  const lowerQuery = userQuery.toLowerCase();
  const shouldBypass = bypassKeywords.some(keyword => lowerQuery.includes(keyword));

  // If this is the FIRST message (not a follow-up) and user did not bypass, ALWAYS ask for clarity
  if (!isFollowUp && !shouldBypass) {
    const systemPrompt = `You are a senior UI design consultant. The user wants a UI screen designed.
Your job is to ALWAYS ask clarifying questions before designing. Never skip this step.

Analyze what the user said, then ask 2-3 smart follow-up questions to nail the design.
Your questions should feel like a real designer asking for clarity.

Output ONLY valid JSON, no markdown:
{
  "needsClarification": true,
  "clarificationQuestion": string,
  "platform": "web" | "ios" | "tablet" | null,
  "theme": "dark" | "light" | null,
  "industry": string,
  "screenType": string,
  "specificRef": string or null,
  "sections": string[],
  "searchQuery": string,
  "mentionedBrands": string[],
  "suggestedDesignStyle": "ui-design-style" | "inspoai-design-style" | "none",
  "suggestedPalette": {
    "name": string,
    "reason": string,
    "background": "#RRGGBB",
    "surface": "#RRGGBB",
    "primary": "#RRGGBB",
    "accent": "#RRGGBB",
    "accent2": "#RRGGBB",
    "supporting": "#RRGGBB",
    "textPrimary": "#RRGGBB",
    "textSecondary": "#RRGGBB",
    "border": "#RRGGBB"
  }
}

RULES for suggestedPalette:
- Generate a custom, context-aware color palette matching the product genre and the requested theme.
- All values must be valid 6-digit hex colors.
- textPrimary must have at least 4.5:1 contrast against background and surface.

RULES for clarificationQuestion:
- If the user's message contains "Visual Scan Context of Reference Screenshot", you MUST acknowledge that you analyzed their reference screen (e.g., "Got it. I've scanned your reference screen!").
- If a reference screenshot is provided, do NOT ask about visual styling, color palettes, fonts, or brand references. Instead, focus your 2-3 questions PURELY on layout structure and functional scaling/adaptation (e.g. porting iOS elements to the wider desktop web viewport, key sections to keep/expand, sidebar vs top nav, etc.).
- Do NOT ask about platform or theme if the user already specified them in their message
- Only ask about sections, features, or design references
- Use plain English. No emojis whatsoever.
- Use line breaks and arrow markers (→) for each question
- Keep it SHORT, honest, and conversational — 2-3 questions max
- Extract any brand names mentioned into mentionedBrands array

Example for text-only prompt:
"Got it. A few things to lock down before I start:\n\n→ Key sections you want? (e.g. revenue chart, transactions list, profile header)\n→ Any apps you want it to feel like? (e.g. Revolut, Mercury)\n→ How many screens?"

Example for visual screenshot upload:
"Got it. I've scanned your reference screen! A few details to confirm before porting to the web:\n\n→ How should we adapt the layout? (e.g. adding a sidebar menu, top navigation bar)\n→ Are there any specific iOS components you want to expand or reposition for web?\n→ What key sections should the web version include?"`;

    const result = await callDeepSeek(systemPrompt, userQuery, 600);
    try {
      const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      parsed.needsClarification = true; // Force it
      parsed.suggestedPalette = validateAndCleanPalette(parsed.suggestedPalette || null, parsed.theme || 'dark');
      return parsed;
    } catch {
      return {
        needsClarification: true,
        clarificationQuestion: "Got it. A few things to lock down:\n\n→ What specific sections or features do you need?\n→ Any apps you want it to feel like?\n→ How many screens?",
        platform: null, theme: null,
        industry: 'general', screenType: 'app screen',
        sections: [], searchQuery: userQuery, mentionedBrands: [],
        suggestedPalette: validateAndCleanPalette(null, 'dark')
      };
    }
  }

  // Follow-up or Bypass: extract final intent from the conversation
  const systemPrompt = `You are a UI design assistant. The user wants to design UI screens.
Extract their FINAL intent. Set needsClarification to false.
If the user wants multiple screens (e.g. 'at least 8 screens' or '12 screens'), set screenCount to that number (up to 12) and list each screen in screenDescriptions.
If the user asks for "at least 8 screens", return EXACTLY 8 screen descriptions.
If the user asks for "12 screens", return EXACTLY 12 screen descriptions.

For a request like a plant AI app with floral onboarding, return exactly these 12 onboarding and main app screen descriptions in order:
1. Plant identification onboarding
2. Plant health diagnosis onboarding
3. Care reminders onboarding
4. Home dashboard
5. Camera capture
6. AI analysing state
7. Identification result
8. Disease diagnosis
9. Plant care guide
10. My Garden
11. Reminders
12. Profile

Output ONLY valid JSON:
{
  "needsClarification": false,
  "platform": "web" | "ios" | "tablet",
  "theme": "dark" | "light",
  "industry": string,
  "screenType": string,
  "specificRef": string or null,
  "sections": string[],
  "searchQuery": string,
  "mentionedBrands": string[],
  "screenCount": number (default 1),
  "screenDescriptions": string[] (one description per screen, e.g. ["Upload screen", "File list with sharing", "Analytics dashboard"]),
  "suggestedDesignStyle": "ui-design-style" | "inspoai-design-style" | "none",
  "suggestedPalette": {
    "name": string,
    "reason": string,
    "background": "#RRGGBB",
    "surface": "#RRGGBB",
    "primary": "#RRGGBB",
    "accent": "#RRGGBB",
    "accent2": "#RRGGBB",
    "supporting": "#RRGGBB",
    "textPrimary": "#RRGGBB",
    "textSecondary": "#RRGGBB",
    "border": "#RRGGBB"
  }
}

RULES for suggestedPalette:
- Generate a custom, context-aware color palette matching the product genre and theme.
- All values must be valid 6-digit hex colors.
- textPrimary must have at least 4.5:1 contrast against background and surface.`;

  const result = await callDeepSeek(systemPrompt, userQuery, 2000);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    parsed.suggestedPalette = validateAndCleanPalette(parsed.suggestedPalette || null, parsed.theme || 'dark');
    return parsed;
  } catch {
    return {
      needsClarification: false, platform: null, theme: 'dark',
      industry: 'general', screenType: 'app screen',
      sections: ['header', 'content', 'navigation'],
      searchQuery: userQuery, mentionedBrands: [],
      suggestedPalette: validateAndCleanPalette(null, 'dark')
    };
  }
}

async function brainPlanProduct({ prompt, platform, requestedScreenCount, selectedSkill, uploadedReference }) {
  console.log(`[Product Plan] Planning product concept...`);
  const systemPrompt = `You are a world-class Product Director. Based on the user's prompt and details, define a clear product concept.
Return ONLY valid JSON, no markdown blocks:
{
  "appName": "Creative name for the product",
  "tagline": "Short punchy tagline",
  "category": "High level category",
  "positioning": "Value proposition and main utility",
  "primaryUser": "Target demographic",
  "primaryGoal": "The main task users perform",
  "personality": ["array", "of", "4-5", "descriptive", "adjectives"],
  "antiReferences": ["styles", "or", "patterns", "to", "strictly", "avoid"],
  "visualConcept": "A creative visual metaphor or art direction concept (e.g. 'A modern pressed-botanical journal', 'Minimal neon cyberpunk trading screen', 'A soft-contrast paper book')"
}`;

  const userPrompt = `USER PROMPT: "${prompt}"
PLATFORM: ${platform || 'ios'}
SCREEN COUNT: ${requestedScreenCount || 1}
SELECTED STYLE SKILL: ${selectedSkill || 'none'}
VISUAL PRE-SCAN DETAILS: ${uploadedReference ? JSON.stringify(uploadedReference) : 'none'}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 500);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[Warning] [Product Plan] Failed, using default fallback plan:', err.message);
    const lowerPrompt = prompt.toLowerCase();
    if (lowerPrompt.includes('plant') || lowerPrompt.includes('flora')) {
      return {
        appName: 'Florae',
        tagline: 'A pocket botanist',
        category: 'Plant identification and care companion',
        positioning: 'A warm personal botanical assistant that identifies plants and helps users care for them.',
        primaryUser: 'Everyday plant owners',
        primaryGoal: 'Capture, identify, save and care for plants',
        personality: ['warm', 'botanical', 'calm', 'intelligent', 'hand-crafted'],
        antiReferences: ['generic SaaS dashboard', 'neon AI interface', 'random stock photography', 'children\'s cartoon app'],
        visualConcept: 'A modern pressed-botanical journal'
      };
    }
    return {
      appName: 'App',
      tagline: 'Designed with AI',
      category: 'Digital assistant',
      positioning: 'A modern utility app.',
      primaryUser: 'General user',
      primaryGoal: 'Complete simple actions',
      personality: ['minimal', 'clean', 'functional', 'precise'],
      antiReferences: ['cluttered layout', 'unreadable typography', 'bad contrast'],
      visualConcept: 'A clean minimalist layout'
    };
  }
}

async function brainPlanJourney({ prompt, productPlan, requestedScreenCount }) {
  console.log(`[Journey Planner] Planning screen flow for ${requestedScreenCount} screens...`);
  const systemPrompt = `You are a world-class User Experience (UX) Journey Planner.
Your job is to design a logical flow of screens for a digital product based on its category, goals, and prompt.
Return ONLY valid JSON, no markdown blocks:
{
  "requestedScreenCount": number,
  "screens": [
    {
      "id": "unique-kebab-case-id",
      "name": "Human readable name",
      "purpose": "A detailed explanation of what task the screen achieves",
      "primaryAction": "The primary button/action label on this screen",
      "previousScreen": "id of previous screen or null",
      "nextScreen": "id of next screen or null",
      "requiredContent": ["list", "of", "required", "UI", "elements", "or", "widgets"]
    }
  ],
  "primaryLoop": ["main", "actions", "representing", "the", "core", "user", "loop"]
}`;

  const userPrompt = `USER PROMPT: "${prompt}"
PRODUCT PLAN: ${JSON.stringify(productPlan)}
REQUESTED SCREEN COUNT: ${requestedScreenCount || 1}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 2000);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (parsed.screens && parsed.screens.length > 0) {
      return parsed;
    }
    throw new Error('Invalid screens list returned');
  } catch (err) {
    console.warn('[Warning] [Journey Planner] Failed, using reference fallback:', err.message);
    const lowerPrompt = prompt.toLowerCase();
    const screens = [];
    const maxCount = Math.min(requestedScreenCount || 8, 12);
    
    let defaultJourney = [
      { id: 'welcome', name: 'Welcome', purpose: 'Introduce the product and visual identity', primaryAction: 'Begin', requiredContent: ['brand wordmark', 'hero illustration', 'tagline', 'primary CTA'] },
      { id: 'identify-onboarding', name: 'Identify onboarding', purpose: 'Explain plant identification feature', primaryAction: 'Continue', requiredContent: ['onboarding card', 'plant illustration', 'description'] },
      { id: 'plant-health', name: 'Plant-health onboarding', purpose: 'Explain diagnosis features', primaryAction: 'Continue', requiredContent: ['onboarding card', 'health illustration', 'description'] },
      { id: 'care-reminders', name: 'Care-reminders onboarding', purpose: 'Explain watering reminders', primaryAction: 'Get Started', requiredContent: ['onboarding card', 'watering illustration', 'description'] },
      { id: 'garden-home', name: 'Garden home', purpose: 'Primary dashboard for user plants', primaryAction: 'Scan Plant', requiredContent: ['search bar', 'saved plants grid', 'care list', 'bottom tabs'] },
      { id: 'camera-capture', name: 'Camera capture', purpose: 'Aim camera at plant to capture', primaryAction: 'Capture', requiredContent: ['camera view finder', 'flash toggle', 'upload gallery button'] },
      { id: 'ai-analysing', name: 'AI analysing', purpose: 'Intermediate scanning loader state', primaryAction: 'Cancel', requiredContent: ['animated pulse scanning ring', 'live analyzer stats'] },
      { id: 'id-result', name: 'Identification result', purpose: 'Show identified plant species info', primaryAction: 'Save to Garden', requiredContent: ['plant visual card', 'match accuracy percentage', 'basic species specs'] },
      { id: 'disease-diagnosis', name: 'Disease diagnosis', purpose: 'Show plant health status & cure guide', primaryAction: 'Add Care Schedule', requiredContent: ['health status alert', 'diagnosis checklist', 'care remedies'] },
      { id: 'plant-detail', name: 'Plant detail', purpose: 'Comprehensive care schedules & info', primaryAction: 'Log Care', requiredContent: ['plant image', 'watering slider', 'light requirements gauge', 'notes'] },
      { id: 'reminders', name: 'Reminders', purpose: 'Watering & care notification schedules', primaryAction: 'Complete Water', requiredContent: ['calendar view', 'reminders list', 'completed checkboxes'] },
      { id: 'profile', name: 'Profile', purpose: 'User settings and preferences', primaryAction: 'Edit Profile', requiredContent: ['avatar', 'user stats', 'achievements', 'settings list'] }
    ];

    if (!lowerPrompt.includes('plant') && !lowerPrompt.includes('flora')) {
      defaultJourney = [
        { id: 'welcome', name: 'Welcome', purpose: 'Introduce the app', primaryAction: 'Get Started', requiredContent: ['app tagline', 'cta button', 'hero banner'] },
        { id: 'onboarding-1', name: 'Onboarding step 1', purpose: 'First feature highlights', primaryAction: 'Next', requiredContent: ['illustration', 'title', 'bullets'] },
        { id: 'onboarding-2', name: 'Onboarding step 2', purpose: 'Second feature highlights', primaryAction: 'Get Started', requiredContent: ['illustration', 'title', 'bullets'] },
        { id: 'dashboard', name: 'Home dashboard', purpose: 'Main hub screen', primaryAction: 'Create New', requiredContent: ['stats overview', 'recent list', 'navigation bar'] },
        { id: 'creation-wizard', name: 'Creation wizard', purpose: 'Steps to add new item', primaryAction: 'Submit', requiredContent: ['input form', 'stepper bar', 'save buttons'] },
        { id: 'item-detail', name: 'Item detail', purpose: 'Detail view of selected item', primaryAction: 'Edit', requiredContent: ['charts', 'metadata list', 'action toolbar'] },
        { id: 'settings', name: 'Settings', purpose: 'Configurations and profile options', primaryAction: 'Save Settings', requiredContent: ['user settings forms', 'switch toggles'] },
        { id: 'analytics', name: 'Analytics', purpose: 'Detailed reports and visual graphs', primaryAction: 'Export PDF', requiredContent: ['line graphs', 'comparisons', 'export options'] }
      ];
    }

    for (let i = 0; i < maxCount; i++) {
      const spec = defaultJourney[i] || {
        id: `screen-${i + 1}`,
        name: `Screen ${i + 1}`,
        purpose: `Purpose of Screen ${i + 1}`,
        primaryAction: 'Continue',
        requiredContent: ['section content', 'button']
      };
      spec.previousScreen = i > 0 ? (defaultJourney[i - 1]?.id || `screen-${i}`) : null;
      spec.nextScreen = i < maxCount - 1 ? (defaultJourney[i + 1]?.id || `screen-${i + 2}`) : null;
      screens.push(spec);
    }

    return {
      requestedScreenCount: maxCount,
      screens,
      primaryLoop: ['dashboard', 'detail', 'action']
    };
  }
}

async function brainCreateArtDirection({
  prompt, productPlan, journeyPlan, platform, requestedTheme, selectedSkill, uploadedReference, visualAssetMode
}) {
  console.log(`[Art Director] Formulating creative and visual direction...`);
  const systemPrompt = `You are a world-class Design Art Director. Based on the product and journey plans, define the aesthetic guidelines.
Return ONLY valid JSON, no markdown blocks:
{
  "creativeConcept": "Short creative description of the visual identity theme",
  "mood": ["organic", "trustworthy", "editorial", "clean", "playful"],
  "paletteReason": "Creative rationale explaining how the colors fit the concept and brand personality",
  "typographyReason": "Creative rationale for display serif/sans font pairings",
  "illustrationDirection": "Visual rules for inline SVGs: path shapes, rounded corners, complexity, color theme",
  "imageDirection": "Strict guidance on photos (no stock photography in illustration mode, specific themes in photography mode)",
  "layoutDirection": "Layout pattern guidance (editorial whitespace, margins, container shapes)",
  "signatureElement": "ONE specific, unusual visual motif that MUST appear on every screen to make this UI feel like a designed product — NOT a generic choice. Examples: 'colored left-border accent stripe on every card', 'oversized muted section numbers (01 02 03) behind headings', 'pill-shaped tag badges on all metadata rows', 'thin horizontal accent rule with a 4px dot at center between sections', 'gradient-filled icon containers instead of flat icon backgrounds'. Be specific and commit to one.",
  "layoutPersonality": "asymmetric | editorial | structured | fluid | modular — pick ONE that fits the brand personality",
  "contentDensity": "sparse | balanced | rich — sparse means big whitespace and few elements per screen, rich means data-forward with many elements"
}`;

  const userPrompt = `USER PROMPT: "${prompt}"
PRODUCT PLAN: ${JSON.stringify(productPlan)}
JOURNEY PLAN: ${JSON.stringify(journeyPlan)}
PLATFORM: ${platform || 'ios'}
THEME: ${requestedTheme || 'dark'}
SELECTED SKILL: ${selectedSkill || 'none'}
VISUAL ASSET MODE: ${visualAssetMode || 'mixed'}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 2000);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[Warning] [Art Director] Failed, returning fallback direction:', err.message);
    return {
      creativeConcept: 'Modern pressed-botanical journal',
      mood: ['organic', 'quiet', 'editorial', 'trustworthy'],
      paletteReason: 'Natural colors create organic trust while warm paper neutrals make the app approachable.',
      typographyReason: 'An expressive serif creates an identity while a clean sans-serif protects usability.',
      illustrationDirection: 'Layered botanical SVG illustrations using soft ellipses, leaves and simple quadratic curves.',
      imageDirection: 'No stock photography in illustration mode.',
      layoutDirection: 'Editorial hierarchy with generous whitespace and strong focal illustrations.',
      signatureElement: 'thin colored left-border accent stripe on every card and list item',
      layoutPersonality: 'editorial',
      contentDensity: 'balanced'
    };
  }
}

async function brainPlanIllustrations({ productPlan, journeyPlan, artDirection, designSystem }) {
  console.log(`[Illustration Planner] Planning illustration manifest...`);
  const systemPrompt = `You are a world-class illustration art director. Based on the product plan and journey, design a manifest of required inline SVG illustrations.
Return ONLY valid JSON, no markdown blocks:
{
  "sharedRules": {
    "format": "inline React SVG",
    "usePaletteTokens": true,
    "complexity": "medium",
    "externalImagesAllowed": false,
    "consistentShapeLanguage": true
  },
  "illustrations": [
    {
      "id": "unique-kebab-case-id",
      "componentName": "CamelCaseComponentName",
      "usedBy": ["list of screen IDs that use it"],
      "purpose": "A detailed explanation of the illustration's content",
      "searchQuery": "A simple 1-3 word keyword search query to find this illustration in a vector library, e.g. 'success' or 'delivery boy' or 'chart growth'"
    }
  ]
}`;

  const userPrompt = `PRODUCT PLAN: ${JSON.stringify(productPlan)}
JOURNEY PLAN: ${JSON.stringify(journeyPlan)}
ART DIRECTION: ${JSON.stringify(artDirection)}
DESIGN SYSTEM: ${JSON.stringify(designSystem)}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 2000);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[Warning] [Illustration Planner] Failed, returning fallback manifest:', err.message);
    return {
      sharedRules: { format: 'inline React SVG', usePaletteTokens: true, complexity: 'medium', externalImagesAllowed: false, consistentShapeLanguage: true },
      illustrations: [
        { id: 'hero-flower', componentName: 'HeroFlower', usedBy: ['welcome'], purpose: 'Primary brand botanical illustration', searchQuery: 'botanical flower plant' },
        { id: 'identify-scene', componentName: 'IdentifyScene', usedBy: ['identify-onboarding'], purpose: 'Explain AI plant identification with leaf scanner', searchQuery: 'scan leaf identification' },
        { id: 'care-scene', componentName: 'CareScene', usedBy: ['care-reminders'], purpose: 'Explain watering reminder schedule', searchQuery: 'watering plants calendar' }
      ]
    };
  }
}

async function brainPlanSharedComponents({ journeyPlan, designSystem, illustrationManifest }) {
  console.log(`[Shared Component Planner] Planning shared React components...`);
  const systemPrompt = `You are a Principal Frontend Architect. Based on the journey plan and design system, plan the reusable shared components.
Any component used by two or more screens MUST be planned here.
Return ONLY valid JSON, no markdown blocks:
{
  "components": [
    {
      "name": "CamelCaseComponentName",
      "usedBy": ["list of screen IDs or 'all'"],
      "purpose": "Component role and visual definition"
    }
  ]
}`;

  const userPrompt = `JOURNEY PLAN: ${JSON.stringify(journeyPlan)}
DESIGN SYSTEM: ${JSON.stringify(designSystem)}
ILLUSTRATIONS: ${JSON.stringify(illustrationManifest)}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 2000);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[Warning] [Component Planner] Failed, using default fallback plan:', err.message);
    return {
      components: [
        { name: 'AppShell', usedBy: ['all'], purpose: 'Main device container with header and safe areas' },
        { name: 'OnboardingTemplate', usedBy: ['identify-onboarding', 'plant-health', 'care-reminders'], purpose: 'Template layout for onboarding screens' },
        { name: 'PrimaryButton', usedBy: ['all'], purpose: 'Reusable CTA button with design system height' },
        { name: 'BottomNavigation', usedBy: ['garden-home', 'profile', 'reminders'], purpose: 'Bottom bar navigation' }
      ]
    };
  }
}

function getFallbackSharedResources(designSystem) {
  const colors = designSystem.colors;
  const radius = designSystem.radius;
  
  const illustrationsCode = `import React from 'react';

export function HeroFlower({ className = 'w-48 h-48' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="12" fill="${colors.highlight || '#E8C468'}" />
      <path d="M50 20 C45 35, 55 35, 50 20 Z" fill="${colors.accent || '#C87A5E'}" opacity="0.9" />
      <path d="M50 80 C45 65, 55 65, 50 80 Z" fill="${colors.accent || '#C87A5E'}" opacity="0.9" />
      <path d="M20 50 C35 45, 35 55, 20 50 Z" fill="${colors.accent || '#C87A5E'}" opacity="0.9" />
      <path d="M80 50 C65 45, 65 55, 80 50 Z" fill="${colors.accent || '#C87A5E'}" opacity="0.9" />
      <path d="M29 29 C40 38, 43 35, 29 29 Z" fill="${colors.accentSoft || '#F2C8C0'}" opacity="0.85" />
      <path d="M71 71 C60 62, 57 65, 71 71 Z" fill="${colors.accentSoft || '#F2C8C0'}" opacity="0.85" />
      <path d="M71 29 C62 40, 65 43, 71 29 Z" fill="${colors.accentSoft || '#F2C8C0'}" opacity="0.85" />
      <path d="M29 71 C38 60, 35 57, 29 71 Z" fill="${colors.accentSoft || '#F2C8C0'}" opacity="0.85" />
    </svg>
  );
}

export function IdentifyScene({ className = 'w-48 h-48' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="25" y="15" width="50" height="70" rx="8" stroke="${colors.primary}" strokeWidth="2" fill="${colors.surface}" />
      <circle cx="50" cy="45" r="16" stroke="${colors.secondary || colors.accent}" strokeWidth="1.5" fill="none" />
      <path d="M42 45 C45 42, 55 42, 58 45" stroke="${colors.accent}" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M46 52 C48 55, 52 55, 54 52" stroke="${colors.accent}" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="45" x2="80" y2="45" stroke="${colors.highlight}" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

export function CareScene({ className = 'w-48 h-48' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 25 C65 25, 70 45, 50 75 C30 45, 35 25, 50 25 Z" fill="${colors.accentSoft || '#F2C8C0'}" stroke="${colors.accent}" strokeWidth="2" />
      <path d="M50 75 V85" stroke="${colors.primary}" strokeWidth="2" strokeLinecap="round" />
      <circle cx="50" cy="85" r="3" fill="${colors.primary}" />
      <path d="M45 45 C48 42, 52 42, 55 45" stroke="${colors.primary}" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CollectionScene({ className = 'w-48 h-48' }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="30" width="25" height="40" rx="4" fill="${colors.surface}" stroke="${colors.border}" strokeWidth="1.5" />
      <rect x="55" y="30" width="25" height="40" rx="4" fill="${colors.surface}" stroke="${colors.border}" strokeWidth="1.5" />
      <path d="M32 45 C30 50, 35 50, 32 45 Z" fill="${colors.accent}" />
      <path d="M67 45 C65 50, 70 50, 67 45 Z" fill="${colors.accent}" />
    </svg>
  );
}
`;

  const sharedComponentsCode = `import React from 'react';
import * as Lucide from 'lucide-react';

export function AppShell({ children, platform = 'ios', theme = 'light', navigation }) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-[${colors.background}] text-[${colors.textPrimary}] font-sans relative">
      <div className="h-14 px-6 flex items-center justify-between border-b border-[${colors.border}] bg-[${colors.surface}]">
        <div className="flex items-center gap-2">
          <Lucide.Leaf className="w-5 h-5 text-[${colors.primary}]" />
          <span className="font-bold text-lg tracking-tight text-[${colors.textPrimary}]">Florae</span>
        </div>
        <div className="flex items-center gap-3">
          <Lucide.Bell className="w-5 h-5 opacity-70" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {children}
      </div>

      {navigation}
    </div>
  );
}

export function OnboardingTemplate({ eyebrow, title, body, illustration, primaryAction, onPrimaryClick }) {
  return (
    <div className="max-w-md mx-auto h-full flex flex-col justify-between py-4 text-center">
      <div>
        {eyebrow && <span className="text-xs font-semibold tracking-widest uppercase text-[${colors.accent}] mb-2 block">{eyebrow}</span>}
        <h1 className="text-3xl font-bold tracking-tight text-[${colors.textPrimary}] mb-3">{title}</h1>
        <p className="text-sm opacity-85 text-[${colors.textSecondary}] leading-relaxed px-4">{body}</p>
      </div>

      <div className="my-8 flex justify-center items-center">
        {illustration}
      </div>

      <button
        onClick={onPrimaryClick}
        className="w-full py-4 bg-[${colors.primary}] text-[${colors.background}] font-medium tracking-wide transition-all active:scale-[0.98]"
        style={{ height: '56px', borderRadius: '${radius.control}px' }}
      >
        {primaryAction}
      </button>
    </div>
  );
}

export function PrimaryButton({ label, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={\`w-full py-4 font-semibold tracking-wide bg-[\${colors.primary}] text-white transition-all active:scale-[0.98] \${className}\`}
      style={{ height: '56px', borderRadius: '${radius.control}px' }}
    >
      {label}
    </button>
  );
}

export function BottomNavigation({ activeTab, onTabClick, platform = 'ios' }) {
  const tabs = [
    { id: 'garden-home', label: 'My Garden', icon: 'Home' },
    { id: 'camera-capture', label: 'Identify', icon: 'Camera' },
    { id: 'reminders', label: 'Reminders', icon: 'Calendar' },
    { id: 'profile', label: 'Profile', icon: 'User' }
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[72px] flex items-center justify-around border-t border-[${colors.border}] bg-[${colors.surface}] px-4 z-20">
      {tabs.map(t => {
        const Icon = Lucide[t.icon] || Lucide.HelpCircle;
        const isActive = activeTab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onTabClick && onTabClick(t.id)}
            className={\`flex flex-col items-center justify-center gap-1 w-16 h-12 transition-colors \${isActive ? 'text-[${colors.primary}]' : 'text-[${colors.textSecondary}] opacity-60'}\`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
`;

  return { illustrationsCode, sharedComponentsCode };
}

async function generateSharedResources({
  productPlan, artDirection, designSystem, illustrationManifest, componentPlan, visualAssetMode
}) {
  console.log(`[Shared Resource Gen] Generating shared JSX resources (illustrations + components)...`);

  // Fallback to generating both illustrations and components via LLM (the original flow)
  console.log(`[Shared Resource Gen] Falling back to standard LLM generation for illustrations and shared components...`);
  const systemPrompt = `You are a senior frontend engineer. Generate the complete source code for two files:
1. 'illustrations.jsx': Contains React components for all planned illustrations in the illustration manifest.
2. 'sharedComponents.jsx': Contains React components for all planned shared components in the component plan.

RULES:
- Do NOT use typescript. Write pure JSX/JavaScript.
- Do NOT import other files. Assume they are all in scope or imported from 'react' or 'lucide-react'.
- Use Tailwind CSS classes for all styling.
- All colors and sizes must strictly refer to the provided DESIGN SYSTEM values.
- Illustrations must be inline SVGs (use simple primitives like path, rect, circle, ellipse). All SVG colors must use design system colors.
- SVG illustrations MUST NOT contain any <img> tags, external images, or remote URLs.
- Include exports for all components.

DESIGN SYSTEM:
${JSON.stringify(designSystem, null, 2)}

ILLUSTRATION MANIFEST:
${JSON.stringify(illustrationManifest, null, 2)}

COMPONENT PLAN:
${JSON.stringify(componentPlan, null, 2)}

Output the code wrapped in a clean JSON format:
{
  "illustrationsCode": "string containing illustrations.jsx source code",
  "sharedComponentsCode": "string containing sharedComponents.jsx source code"
}`;

  let attempts = 0;
  const maxAttempts = 3;
  while (attempts < maxAttempts) {
    let raw = '';
    try {
      raw = await callDeepSeek(systemPrompt, `Generate the shared JSX code now.`, 8000);
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      
      const check1 = compileCheck(parsed.illustrationsCode);
      const check2 = compileCheck(parsed.sharedComponentsCode);
      if (check1.success && check2.success) {
        console.log(`  [Shared Resources] Shared resources generated and compiled cleanly!`);
        return parsed;
      }
      
      console.warn(`  [Shared Resources] Compilation failed: Illus=${check1.error || 'OK'}, Comps=${check2.error || 'OK'}`);
      attempts++;
    } catch (err) {
      console.warn(`[Warning] [Shared Resources] JSON parse failed, trying custom regex block parser:`, err.message);
      const rawText = String(raw || '');
      const illustrationsCodeMatch = rawText.match(/\/\/\s*illustrations\.jsx[\s\S]*?(?=\/\/\s*sharedComponents\.jsx|$)/i) 
        || rawText.match(/illustrationsCode":\s*"([\s\S]*?)"\s*,\s*"sharedComponentsCode/);
      
      const sharedComponentsCodeMatch = rawText.match(/\/\/\s*sharedComponents\.jsx[\s\S]*$/i)
        || rawText.match(/sharedComponentsCode":\s*"([\s\S]*?)"\s*}/);
      
      if (illustrationsCodeMatch && sharedComponentsCodeMatch) {
        const parsed = {
          illustrationsCode: (illustrationsCodeMatch[1] || illustrationsCodeMatch[0]).replace(/```/g, '').trim(),
          sharedComponentsCode: (sharedComponentsCodeMatch[1] || sharedComponentsCodeMatch[0]).replace(/```/g, '').trim()
        };
        const check1 = compileCheck(parsed.illustrationsCode);
        const check2 = compileCheck(parsed.sharedComponentsCode);
        if (check1.success && check2.success) {
          console.log(`  [Shared Resources] Extracted from markdown blocks successfully!`);
          return parsed;
        }
      }
      attempts++;
    }
  }
  
  console.warn('[Warning] [Shared Resources] Failed to compile after max attempts, using fallback components.');
  return getFallbackSharedResources(designSystem);
}

function validateScreenSemantics(screenCode, screenSpec, visualAssetMode) {
  const issues = [];

  if (visualAssetMode === 'illustration') {
    if (screenCode.includes('<img') && !screenCode.includes('src={uploadedImage')) {
      issues.push("Do not use <img /> tags in illustration mode. Use inline SVGs or shared illustration components instead.");
    }
    if (screenCode.includes('http://') || screenCode.includes('https://')) {
      const remoteImgUrls = screenCode.match(/https?:\/\/[^\s"'`]+\.(png|jpg|jpeg|webp|svg)/gi) || [];
      if (remoteImgUrls.length > 0) {
        issues.push(`Remote stock image URLs detected: ${remoteImgUrls.join(', ')}. Stock photos are forbidden in illustration mode.`);
      }
    }
    if (screenCode.includes('background-image: url') || screenCode.includes('backgroundImage: \'url')) {
      issues.push("Do not use background-image photo URLs in illustration mode.");
    }
  }

  const lowerCode = screenCode.toLowerCase();
  if (screenSpec.primaryAction) {
    const ctaLower = screenSpec.primaryAction.toLowerCase();
    if (!lowerCode.includes(ctaLower) && !lowerCode.includes('button')) {
      issues.push(`The primary CTA button "${screenSpec.primaryAction}" is missing from the layout.`);
    }
  }

  if (screenSpec.id === 'welcome' && !lowerCode.includes('welcome') && !lowerCode.includes('get started') && !lowerCode.includes('begin')) {
    issues.push("The welcome screen must contain welcome brand messaging and a clear get started action.");
  }

  return {
    success: issues.length === 0,
    errors: issues
  };
}

async function brainReviewProject({
  screens, productPlan, journeyPlan, designSystem, visualAssetMode
}) {
  console.log(`[Visual QA] Running whole-project visual QA review...`);
  const systemPrompt = `You are a senior Design QA Director. Your job is to inspect the completed React component code for all screens and review styling consistency.
Return ONLY valid JSON, no markdown blocks:
{
  "scores": {
    "paletteCompliance": number (1-10),
    "typographyConsistency": number (1-10),
    "spacingConsistency": number (1-10),
    "illustrationConsistency": number (1-10),
    "contentRelevance": number (1-10),
    "screenHierarchy": number (1-10),
    "productStory": number (1-10)
  },
  "issues": [
    {
      "screenId": "id of the screen with issue",
      "issue": "Specific visual issue",
      "severity": "high" | "medium" | "low",
      "fix": "Instructions on how to repair this screen"
    }
  ]
}`;

  const userPrompt = `PRODUCT PLAN: ${JSON.stringify(productPlan)}
JOURNEY PLAN: ${JSON.stringify(journeyPlan)}
DESIGN SYSTEM: ${JSON.stringify(designSystem)}
VISUAL ASSET MODE: ${visualAssetMode}
GENERATED SCREENS METADATA:
${screens.map(s => `Screen "${s.title}" (Index ${s.index}): Length ${s.reactCode?.length || 0} chars`).join('\n')}`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 500);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn('[Warning] [Visual QA] Failed, returning default passing review:', err.message);
    return {
      scores: { paletteCompliance: 9, typographyConsistency: 9, spacingConsistency: 9, illustrationConsistency: 9, contentRelevance: 9, screenHierarchy: 9, productStory: 9 },
      issues: []
    };
  }
}


// ── Realistic Content Generator ───────────────────────────────────────────────
// Generates domain-specific fake-but-believable content so screens never show
// "Product Name", "User Name", "Lorem ipsum", or round numbers like "1,000 users"
async function brainGenerateContent({ productPlan, journeyPlan, prompt }) {
  console.log(`[Content Generator] Generating realistic domain-specific content...`);
  const systemPrompt = `You are a copywriter and product content specialist. Generate realistic, domain-specific dummy content for a UI prototype.
The content must feel like it came from a real, live product — not a generic template.
Return ONLY valid JSON, no markdown:
{
  "appName": "The real product name (from productPlan)",
  "tagline": "A sharp, specific one-liner tagline",
  "heroHeadline": "A specific, punchy headline for the hero/onboarding screen (NOT generic like 'Welcome to AppName')",
  "heroSubline": "A specific supporting sentence (max 12 words)",
  "primaryCTA": "Specific CTA button text (not just 'Get Started')",
  "featureNames": ["Feature 1 name", "Feature 2 name", "Feature 3 name", "Feature 4 name"],
  "userNames": ["First Last", "First Last", "First Last", "First Last", "First Last"],
  "metrics": [
    { "label": "Specific metric name", "value": "Realistic irregular value e.g. 2,847 or 94%", "trend": "+12%" },
    { "label": "Specific metric name", "value": "Realistic irregular value", "trend": "-3.2%" },
    { "label": "Specific metric name", "value": "Realistic irregular value", "trend": "+7.4%" }
  ],
  "recentDates": ["Mar 14", "Feb 28", "Jan 19", "Dec 4", "Nov 23"],
  "samplePrices": ["$47/mo", "$127/mo", "$287/mo"],
  "domainSpecificWords": ["3-5 domain-specific nouns/terms that appear in this app's UI copy"]
}`;

  const userPrompt = `PRODUCT PLAN: ${JSON.stringify(productPlan)}
JOURNEY PLAN: ${JSON.stringify({ screens: journeyPlan.screens?.slice(0,4) })}
USER PROMPT: "${prompt}"`;

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 2000);
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    console.log(`[Success] [Content Generator] Generated content for: ${parsed.appName}`);
    return parsed;
  } catch (err) {
    console.warn('[Warning] [Content Generator] Failed, using minimal fallback:', err.message);
    return {
      appName: productPlan.appName || 'App',
      tagline: productPlan.tagline || '',
      heroHeadline: '',
      heroSubline: '',
      primaryCTA: 'Get Started',
      featureNames: [],
      userNames: ['Alex Chen', 'Sarah Kim', 'Marcus Reid', 'Priya Nair', 'Tom Walsh'],
      metrics: [
        { label: 'Active Users', value: '2,847', trend: '+12%' },
        { label: 'Revenue', value: '$94,312', trend: '+7.4%' },
        { label: 'Satisfaction', value: '4.8/5', trend: '+0.3' }
      ],
      recentDates: ['Mar 14', 'Feb 28', 'Jan 19', 'Dec 4', 'Nov 23'],
      samplePrices: ['$47/mo', '$127/mo', '$287/mo'],
      domainSpecificWords: []
    };
  }
}

async function runV2Pipeline({
  prompt, platform, theme, isFollowUp, previousContext, designChoices, uploadedImagePath, cachedScanFromClient, visualAssetModeInput, requestId, generationOutputMode
}, callbacks) {
  const { sendStatus, sendClarification, sendScreenStart, sendScreenComplete, sendComplete, sendError } = callbacks;
  const startTime = Date.now();
  const stepTime = () => `${Date.now() - startTime}ms`;

  let currentStage = 'initializing';
  try {
    // ── Request ID & Reference Authority validation (Requirement 3) ──
    const reqId = requestId || 'req-' + Date.now();
    const hasCurrentReference =
      Boolean(uploadedImagePath) &&
      Boolean(cachedScanFromClient) &&
      cachedScanFromClient.requestId === reqId;

    let preScannedDesign = hasCurrentReference ? cachedScanFromClient : null;
    let visualScanContext = '';
    let scanWarning = null;

    if (preScannedDesign) {
      console.log(`  [${stepTime()}]  Using cached preScannedDesign from clarification turn (belonging to current request)`);
      visualScanContext = `[Visual Scan Context of Reference Screenshot]:
- Screen Layout Structure: ${preScannedDesign.layout?.layoutPattern || 'not specified'}
- Components & Widgets Found: ${(preScannedDesign.designDetails || []).join(', ')}
- Inferred Screen Type/Genre: ${preScannedDesign.layout?.navigationType || 'not specified'}
- Styling notes: ${preScannedDesign.visualNotesForGenerator || ''}
`;
    } else if (uploadedImagePath) {
      if (!fs.existsSync(uploadedImagePath)) {
        console.error(`[Error] Visual scan FAILED: File not found at path: ${uploadedImagePath}`);
        scanWarning = 'Your uploaded screenshot could not be found on the server. The design will use default styles instead of your image.';
        sendStatus('[Warning] Screenshot file not found — using default styles');
      } else {
        try {
          console.log(`  [${stepTime()}]  DeepSeek Vision: Pre-scanning uploaded screenshot reference: ${uploadedImagePath}`);
          preScannedDesign = await scanUploadedScreenshot(uploadedImagePath, prompt);
          if (preScannedDesign) {
            preScannedDesign.requestId = reqId;
            console.log(`  [${stepTime()}] [Success] DeepSeek Vision: Pre-scan success! Inferred layout: ${preScannedDesign.layout?.layoutPattern}`);
            visualScanContext = `[Visual Scan Context of Reference Screenshot]:
- Screen Layout Structure: ${preScannedDesign.layout?.layoutPattern || 'not specified'}
- Components & Widgets Found: ${(preScannedDesign.designDetails || []).join(', ')}
- Inferred Screen Type/Genre: ${preScannedDesign.layout?.navigationType || 'not specified'}
- Styling notes: ${preScannedDesign.visualNotesForGenerator || ''}
`;
          }
        } catch (err) {
          console.error(`[Error] Visual pre-scan FAILED for ${uploadedImagePath}:`, err.message);
          scanWarning = `Screenshot scan failed: ${err.message}. Using default styles.`;
          sendStatus('[Warning] Screenshot scan failed — using default styles');
        }
      }
    }

    // ── Target platform classification & detection (Requirement 1 & 9) ──
    const generationTarget = detectGenerationTarget(prompt, platform);
    let promptPlatform = null;
    if (generationTarget === 'web-page') {
      promptPlatform = 'web';
    } else if (generationTarget === 'mobile-flow') {
      promptPlatform = 'ios';
    } else if (generationTarget === 'tablet-flow') {
      promptPlatform = 'tablet';
    }

    // ── Extract exact source URLs & fetch references (Requirement 7) ──
    const urls = extractUrls(prompt);
    let exactReferences = [];
    if (urls.length > 0) {
      console.log(` Found exact source URLs in prompt:`, urls);
      exactReferences = await Promise.all(urls.map(url => fetchExactReference(url)));
    }

    // ── Context reconstruction (Requirement 2) ──
    const fullContext = isFollowUp && previousContext
      ? `ORIGINAL REQUEST:\n${previousContext}\n\nUSER CLARIFICATION:\n${prompt}\n\n${visualScanContext}`
      : `USER REQUEST:\n${prompt}\n\n${visualScanContext}`;

    const effectivePrompt = isFollowUp && previousContext ? fullContext : prompt;

    // ── Extract Requirements Ledger (Requirement 4) ──
    const requirementsLedger = await brainExtractRequirements({
      rawPrompt: effectivePrompt,
      generationTarget,
      uploadedReference: preScannedDesign,
      exactSources: exactReferences
    });
    
    sendStatus('Understanding request...');
    const intent = await brainUnderstand(fullContext, !!isFollowUp);
    
    intent.platform = promptPlatform || platform || intent.platform || 'ios';

    let promptTheme = null;
    const lowerPrompt = prompt.toLowerCase();
    if (/\b(dark|black|night)\b/i.test(lowerPrompt)) {
      promptTheme = 'dark';
    } else if (/\b(light|white|day)\b/i.test(lowerPrompt)) {
      promptTheme = 'light';
    }
    intent.theme = promptTheme || intent.theme || theme || 'dark';

    // ── Completeness and Clarification Skipping (Requirement 10) ──
    const promptCompleteness = calculatePromptCompleteness(requirementsLedger);
    const skipPhrases = [
      'you decide', 'choose everything', 'use your judgment', 
      'create directly', 'build the full project', 'show the final preview', 'surprise me'
    ];
    const shouldSkipExplicit = skipPhrases.some(phrase => prompt.toLowerCase().includes(phrase));

    // For the first prompt (!isFollowUp), we ALWAYS require clarification to ask colors, fonts, and styles.
    // For subsequent follow-up prompts, we skip clarification and generate updates directly.
    if (!isFollowUp) {
      requirementsLedger.clarificationRequired = true;
      intent.needsClarification = true;
    } else {
      requirementsLedger.clarificationRequired = false;
      intent.needsClarification = false;
    }

    if (intent.needsClarification) {
      if (preScannedDesign) {
        preScannedDesign.requestId = reqId;
      }
      sendClarification(intent.clarificationQuestion, intent, preScannedDesign, scanWarning);
      return;
    }

    // ── Content Writing Agent Step ──────────────────────────────────────────
    console.log(`  [${stepTime()}] Content Writing Agent (Test): Generating/Polishing copy...`);
    const copySpec = await brainWriteContent(prompt, requirementsLedger);
    console.log(`  [${stepTime()}] [Success] Content Writing Agent completed! Brand: "${copySpec.brandName}"`);

    // Extract brand names
    const knownBrands = ['stripe', 'linear', 'vercel', 'notion', 'superhuman', 'supabase', 'spotify', 'apple', 'airbnb', 'shopify', 'revolut', 'figma', 'nike', 'tesla'];
    const extractedBrands = [...(intent.mentionedBrands || [])];
    knownBrands.forEach(b => {
      if (lowerPrompt.includes(b) && !extractedBrands.map(x => x.toLowerCase()).includes(b)) {
        extractedBrands.push(b);
      }
    });
    intent.mentionedBrands = extractedBrands;

    // Detect Visual Asset Mode
    const visualAssetMode = detectVisualAssetMode(effectivePrompt, visualAssetModeInput);
    console.log(`  [${stepTime()}] Visual Asset Mode: ${visualAssetMode}`);

    // Fetch design resources in parallel
    sendStatus('Analyzing references...');
    let designStyleId = designChoices?.designStyle || null;
    if (!designStyleId) {
      if (intent.suggestedDesignStyle && intent.suggestedDesignStyle !== 'none') {
        designStyleId = intent.suggestedDesignStyle;
        console.log(`  [${stepTime()}] AI Dynamics: Using AI suggested design style: ${designStyleId}`);
      } else {
        if (/\b(blueprint|flat|radar|radar-l|grid|geometric)\b/i.test(lowerPrompt)) {
          designStyleId = 'ui-design-style';
          console.log(`  [${stepTime()}] AI Dynamics: Dynamically picked ui-design-style skill`);
        } else if (/\b(inspo|inspoai|floating|dynamic island|island|notch|notchy)\b/i.test(lowerPrompt)) {
          designStyleId = 'inspoai-design-style';
          console.log(`  [${stepTime()}] AI Dynamics: Dynamically picked inspoai-design-style skill`);
        } else {
          designStyleId = 'taste-skill';
          console.log(`  [${stepTime()}] AI Dynamics: Defaulting to taste-skill`);
        }
      }
    }

    if (!designChoices?.palette && !intent.suggestedPalette) {
      if (/\b(warm sand|sand|beige|cream)\b/i.test(lowerPrompt)) {
        intent.suggestedPalette = {
          background: '#FAFAF5',
          surface: '#FFFFFF',
          primary: '#1F242E',
          accent: '#FF5A2B',
          accent2: '#10B981',
          textPrimary: '#1F242E',
          textSecondary: '#71717A'
        };
        console.log(`  [${stepTime()}] AI Dynamics: Dynamically picked Warm Sand color palette`);
      } else if (/\b(emerald|green|forest|mint)\b/i.test(lowerPrompt)) {
        intent.suggestedPalette = {
          background: intent.theme === 'light' ? '#F4FBF7' : '#0B1511',
          surface: intent.theme === 'light' ? '#FFFFFF' : '#121F1B',
          primary: intent.theme === 'light' ? '#0F5B3F' : '#10B981',
          accent: intent.theme === 'light' ? '#0F5B3F' : '#10B981',
          accent2: '#F59E0B',
          textPrimary: intent.theme === 'light' ? '#111827' : '#F5F5F7',
          textSecondary: intent.theme === 'light' ? '#4B5563' : '#8B8D97'
        };
        console.log(`  [${stepTime()}] AI Dynamics: Dynamically picked Emerald/Green color palette`);
      } else if (/\b(violet|purple|indigo|lavender)\b/i.test(lowerPrompt)) {
        intent.suggestedPalette = {
          background: intent.theme === 'light' ? '#F9F8FD' : '#0E0C15',
          surface: intent.theme === 'light' ? '#FFFFFF' : '#161224',
          primary: intent.theme === 'light' ? '#6C5CE7' : '#8F82FC',
          accent: intent.theme === 'light' ? '#6C5CE7' : '#8F82FC',
          accent2: '#FF5A2B',
          textPrimary: intent.theme === 'light' ? '#111827' : '#F5F5F7',
          textSecondary: intent.theme === 'light' ? '#4B5563' : '#8B8D97'
        };
        console.log(`  [${stepTime()}] AI Dynamics: Dynamically picked Violet/Purple color palette`);
      }
    }

    const [brandLogos, searchResults, designStyleContent] = await Promise.all([
      fetchBrandLogos(intent.mentionedBrands || []),
      isSemanticSearchReady() ? semanticSearch(intent.searchQuery, 8) : Promise.resolve([]),
      designStyleId ? fetchDesignMd(designStyleId) : Promise.resolve(null)
    ]);

    let references = [];
    let screenshotUrls = [];
    if (searchResults.length > 0) {
      references = searchResults.map(r => r.metadata).filter(m => m && Object.keys(m).length > 0);
      if (supabase) {
        const ids = searchResults.slice(0, 3).map(r => r.id);
        try {
          const { data: rows } = await supabase.from('design_assets').select('id, src').in('id', ids);
          if (rows) screenshotUrls = rows.map(r => r.src).filter(Boolean);
        } catch {}
      }
    }

    // Add exact references if fetched (Requirement 7)
    if (exactReferences && exactReferences.length > 0) {
      references = [...exactReferences, ...references];
      screenshotUrls = [...exactReferences.map(r => r.screenshotUrl).filter(Boolean), ...screenshotUrls];
    }

    currentStage = 'initializing';
    
    let requestedScreenCount = intent.screenCount || 1;
    let pageType = null;
    if (generationTarget === 'web-page') {
      requestedScreenCount = 1;
      pageType = 'long-form-landing-page';
    }

    // Step 1: Product Director
    currentStage = 'product-planning';
    sendStatus('Planning product concept...');
    const productPlan = await brainPlanProduct({
      prompt: effectivePrompt, platform: intent.platform, requestedScreenCount,
      selectedSkill: designStyleId, uploadedReference: preScannedDesign,
      rawPrompt: effectivePrompt, requirementsLedger
    });

    // Step 2: Journey Planner
    currentStage = 'journey-planning';
    sendStatus('Planning user journey...');
    const journeyPlan = await brainPlanJourney({
      prompt: effectivePrompt, productPlan, requestedScreenCount,
      rawPrompt: effectivePrompt, requirementsLedger
    });
    
    let finalScreenCount = Math.min(journeyPlan.screens.length, 12);
    if (generationTarget === 'web-page') {
      finalScreenCount = 1;
      journeyPlan.screens = [{ id: 'landing-page', name: 'Landing Page', purpose: 'Long-form landing page', requiredContent: requirementsLedger.mustIncludeSections || ['hero', 'features', 'cta', 'footer'] }];
    }
    const targetScreens = journeyPlan.screens.slice(0, finalScreenCount);

    // Step 3: Art Director + Content Generator (run in parallel — zero added latency)
    currentStage = 'art-direction';
    sendStatus('Creating art direction...');
    const [artDirection, appContent] = await Promise.all([
      brainCreateArtDirection({
        prompt: effectivePrompt, productPlan, journeyPlan, platform: intent.platform, requestedTheme: intent.theme,
        selectedSkill: designStyleId, uploadedReference: preScannedDesign, visualAssetMode,
        rawPrompt: effectivePrompt, requirementsLedger
      }),
      brainGenerateContent({ productPlan, journeyPlan, prompt: effectivePrompt })
    ]);

    // Step 4: Resolve palette + build Complete Design System
    sendStatus('Building design system...');
    let colors = resolvePalettePriority({ designChoices, intent, preScannedDesign, designStyleContent, theme: intent.theme });
    let fonts = designChoices?.headingFont
      ? { heading: designChoices.headingFont, body: designChoices.bodyFont || designChoices.headingFont }
      : deriveFonts(references);

    // Apply visual scanning overrides from the screenshot if uploaded
    const overrides = await applyVisualScanOverrides(uploadedImagePath, intent, colors, fonts, {}, null, preScannedDesign, requirementsLedger);
    colors = overrides.colors;
    fonts = overrides.fonts;

    // Apply requirementsLedger overrides — user-specified exact values take highest priority
    const ledgerVisual = requirementsLedger?.visualRequirements || {};
    if (ledgerVisual.exactColors) {
      if (ledgerVisual.exactColors.background && /^#[0-9a-fA-F]{3,8}$/.test(ledgerVisual.exactColors.background)) colors.background = ledgerVisual.exactColors.background;
      if (ledgerVisual.exactColors.surface && /^#[0-9a-fA-F]{3,8}$/.test(ledgerVisual.exactColors.surface)) colors.surface = ledgerVisual.exactColors.surface;
      if (ledgerVisual.exactColors.accent && /^#[0-9a-fA-F]{3,8}$/.test(ledgerVisual.exactColors.accent)) { colors.accent = ledgerVisual.exactColors.accent; colors.primary = ledgerVisual.exactColors.accent; }
    }
    if (ledgerVisual.accentHex && /^#[0-9a-fA-F]{3,8}$/.test(ledgerVisual.accentHex)) {
      colors.accent = ledgerVisual.accentHex;
      colors.primary = ledgerVisual.accentHex;
    }
    if (ledgerVisual.headingFont && ledgerVisual.headingFont.length > 1) fonts.heading = ledgerVisual.headingFont;
    if (ledgerVisual.bodyFont && ledgerVisual.bodyFont.length > 1) fonts.body = ledgerVisual.bodyFont;

    colors.textPrimary = ensureContrast(colors.textPrimary, colors.background, 4.5);
    colors.textPrimary = ensureContrast(colors.textPrimary, colors.surface, 4.5);

    const designSystem = {
      colors: {
        background: colors.background,
        surface: colors.surface,
        primary: colors.primary || colors.surface,
        primaryDark: colors.primary ? ensureContrast(colors.primary, '#FFFFFF', 4.5) : colors.textPrimary,
        secondary: colors.accent2 || '#10B981',
        supporting: colors.textSecondary,
        accent: colors.accent,
        accentSoft: colors.accent2,
        highlight: colors.accent || '#3B82F6',
        textPrimary: colors.textPrimary,
        textSecondary: colors.textSecondary,
        border: colors.border
      },
      typography: {
        displayFont: fonts.heading,
        bodyFont: fonts.body,
        displayXL: 52, displayL: 42, pageTitle: 32, sectionTitle: 22, cardTitle: 18, body: 15, meta: 13, caption: 12
      },
      spacing: { screenX: 24, screenTop: 20, sectionGap: 28, cardPadding: 16, controlGap: 12, smallGap: 8 },
      radius: { small: 12, control: 14, card: 18, largeCard: 24, sheet: 28, pill: 999 },
      controls: { primaryButtonHeight: 56, secondaryButtonHeight: 44, inputHeight: 50, iconButtonSize: 40, bottomNavigationHeight: 72 },
      shadows: {
        card: "0 2px 8px rgba(0,0,0,0.06)",
        floating: "0 10px 28px rgba(0,0,0,0.14)",
        device: "0 36px 72px rgba(0,0,0,0.18)"
      },
      iconStyle: { type: designChoices?.iconStyle || 'outline', strokeWidth: 1.8, lineCap: "round", lineJoin: "round" }
    };

    // Step 5: Illustration Manifest
    sendStatus('Planning visual illustrations...');
    const illustrationManifest = await brainPlanIllustrations({ productPlan, journeyPlan, artDirection, designSystem });

    // Step 6: Shared Component Plan
    sendStatus('Planning shared components...');
    const componentPlan = await brainPlanSharedComponents({ journeyPlan, designSystem, illustrationManifest });

    // Step 7: Generate Shared Resources
    currentStage = 'shared-resources';
    sendStatus('Generating shared resources...');
    const sharedResourcesResult = await generateSharedResources({
      productPlan, artDirection, designSystem, illustrationManifest, componentPlan, visualAssetMode
    });

    const sharedResources = {
      illustrationsCode: sharedResourcesResult?.illustrationsCode || '',
      sharedComponentsCode: sharedResourcesResult?.sharedComponentsCode || ''
    };

    // Step 8: Concurrency batched screen generation
    currentStage = 'screen-generation';
    sendStatus(`Generating ${finalScreenCount} screens...`);
    targetScreens.forEach((s, i) => sendScreenStart(i, s.name));

    const device = DEVICE_SPECS[intent.platform] || DEVICE_SPECS.ios;
    const avatars = getAvatarUrls(5);
    const logoUrl = Object.values(brandLogos || {})[0]?.url || null;

    let stockImages = [];
    if (visualAssetMode === 'photography' || visualAssetMode === 'mixed') {
      const imageQueries = [productPlan.appName, intent.screenType, intent.industry].filter(Boolean);
      stockImages = await fetchStockImages(imageQueries, 12);
    }

    const completedScreens = [];
    const concurrency = 4;

    for (let i = 0; i < targetScreens.length; i += concurrency) {
      const batch = targetScreens.slice(i, i + concurrency);
      const batchPromises = batch.map((screenSpec, batchIdx) => {
        const globalIdx = i + batchIdx;
        // Collect all media asset URLs the user explicitly provided in their prompt
        const userMediaAssets = [
          ...(urls || []).filter(u => /\.(mp4|mov|webm|avi|mkv|png|jpg|jpeg|gif|webp|svg)($|\?)/i.test(u)),
          ...(requirementsLedger?.visualRequirements?.userMediaAssets || [])
        ].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

        const brief = {
          device, fonts, colors, avatars, logoUrl, references, intent,
          visualAssetMode, productPlan, journeyPlan, artDirection, designSystem,
          illustrationManifest, componentPlan, sharedResourcesCode: sharedResources,
          targetScreenSpec: screenSpec,
          stockImages, brandLogos,
          appContent,
          userMediaAssets,
          logoPolicy: logoUrl
            ? 'Use the supplied brand logo exactly.'
            : 'Do not invent or fetch a random logo. Use a clean text wordmark. An optional simple monogram is allowed.',
          rawPrompt: prompt,
          requirementsLedger,
          copySpec,
          generationOutputMode
        };

        return brainCompose(brief)
          .then(async raw => {
            const mergedCode = `
${sharedResources.illustrationsCode}

${sharedResources.sharedComponentsCode}

${raw}
`;
            let finalCode = await brainVerifyAndFix(mergedCode, brief);

            // Perform requirement coverage check (Requirement 6)
            let coverage = validateRequirementCoverage(finalCode, requirementsLedger);
            if (!coverage.success && requirementsLedger.mustIncludeSections?.length > 0) {
              console.log(` [Requirement Coverage] Missing sections: [${coverage.missing.join(', ')}]. Repairing...`);
              const repairPrompt = `The generated screen is missing the following required visual sections or elements:
- ${coverage.missing.join('\n- ')}

Please modify and add the missing sections to the React component code. All visual elements must be included in the final App component. Output ONLY valid React component code.`;
              const repairedRaw = await callDeepSeek(repairPrompt, finalCode, 10000);
              finalCode = await brainVerifyAndFix(repairedRaw, brief);
              coverage = validateRequirementCoverage(finalCode, requirementsLedger);
              console.log(` [Requirement Coverage Re-validation] Success: ${coverage.success}`);
            }

            const semanticCheck = validateScreenSemantics(finalCode, screenSpec, visualAssetMode);
            if (!semanticCheck.success) {
              console.log(`  [Semantic Check] FAILED for screen: ${screenSpec.name}. Attempting repair...`);
              const repairPrompt = `The screen code failed semantic check rules:\n- ${semanticCheck.errors.join('\n- ')}\n\nPlease repair the React code to strictly adhere to the rules. Output ONLY valid React code.`;
              const repairedRaw = await callDeepSeek(repairPrompt, finalCode, 8000);
              const repairedCode = await brainVerifyAndFix(repairedRaw, brief);
              const finalCheck = compileCheck(repairedCode);
              if (finalCheck.success) {
                return { html: cleanHTML(repairedCode, brief), reactCode: repairedCode, title: screenSpec.name, index: globalIdx };
              }
            }

            const finalCheck = compileCheck(finalCode);
            if (!finalCheck.success) {
              throw new Error(`Screen compilation failed: ${finalCheck.error}`);
            }
            return { html: cleanHTML(finalCode, brief), reactCode: finalCode, title: screenSpec.name, index: globalIdx };
          })
          .catch(err => {
            console.error(`[Error] Screen generation failed for ${screenSpec.name}:`, err);
            return { html: null, reactCode: null, title: screenSpec.name, index: globalIdx, error: err.message };
          });
      });

      const settledResults = await Promise.allSettled(batchPromises);
      const successfulScreens = settledResults
        .filter(result => result.status === 'fulfilled' && result.value)
        .map(result => result.value)
        .filter(screen => 
          screen && 
          typeof screen === 'object' && 
          typeof screen.html === 'string' && 
          screen.html.trim().length > 0
        );

      const failedScreens = settledResults
        .map((result, index) => ({ result, index }))
        .filter(({ result }) => result.status === 'rejected' || (result.status === 'fulfilled' && (!result.value || !result.value.html)))
        .map(({ result, index }) => ({
          index: i + index,
          message: result.status === 'rejected' ? (result.reason?.message || 'Unknown screen generation failure') : 'Screen html output was empty'
        }));

      // Normalized success screens emission
      const normalizedBatch = normalizeGeneratedScreens(successfulScreens);
      normalizedBatch.forEach(screen => {
        completedScreens.push(screen);
        if (!isValidGeneratedScreen(screen)) {
          sendScreenComplete(screen.index ?? i, null, null, screen.title);
        } else {
          sendScreenComplete(screen.index, screen.html, screen.reactCode, screen.title);
        }
      });

      // Failed screens error event emission
      failedScreens.forEach(errInfo => {
        sendScreenComplete(errInfo.index, null, null, `Screen ${errInfo.index + 1}`);
      });
    }

    let validScreens = normalizeGeneratedScreens(completedScreens);
    
    if (validScreens.length === 0) {
      sendError({
        message: 'The generated output did not produce a valid preview.',
        stage: 'screen-generation',
        code: 'no_valid_preview'
      });
      return;
    }

    if (generationTarget === 'web-page') {
      if (validScreens.length !== 1) {
        validScreens = [validScreens[0]];
      }
    }

    // Step 9: Whole-Project Visual QA
    currentStage = 'visual-qa';
    sendStatus('Reviewing project quality...');
    
    if (validScreens.length > 0) {
      const projectReview = await brainReviewProject({
        screens: validScreens, productPlan, journeyPlan, designSystem, visualAssetMode
      });
      
      for (const issue of (projectReview.issues || [])) {
        if (issue.severity === 'high') {
          const targetScreen = validScreens.find(s => s.title.toLowerCase() === issue.screenId.toLowerCase() || s.index === Number(issue.screenId));
          if (isValidGeneratedScreen(targetScreen)) {
            console.log(`[Visual QA Repair] Repairing screen: ${targetScreen.title} (Issue: ${issue.issue})`);
            try {
              const repairPrompt = `A design QA review flagged an issue on this screen:\nIssue: ${issue.issue}\nFix guide: ${issue.fix}\n\nPlease repair the React component. Output ONLY valid React component code.`;
              const repairedRaw = await callDeepSeek(repairPrompt, targetScreen.reactCode, 8000);
              const repairedCode = await brainVerifyAndFix(repairedRaw, {});
              if (compileCheck(repairedCode).success) {
                targetScreen.reactCode = repairedCode;
                targetScreen.html = cleanHTML(repairedCode, {});
                sendScreenComplete(targetScreen.index, targetScreen.html, targetScreen.reactCode, targetScreen.title);
              }
            } catch {}
          }
        }
      }

      const scores = projectReview.scores || { paletteCompliance: 8, typographyConsistency: 8, spacingConsistency: 8, illustrationConsistency: 8, contentRelevance: 8, screenHierarchy: 8, productStory: 8 };
      const avgScore = (Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length).toFixed(1);

      const duration = Date.now() - startTime;
      logPipelineTelemetry({
        requestId: reqId,
        rawPromptLength: prompt.length,
        generationTarget,
        isFollowUp,
        previousContextLength: previousContext?.length || 0,
        currentReferenceUsed: Boolean(uploadedImagePath && cachedScanFromClient && cachedScanFromClient.requestId === reqId),
        exactUrls: urls,
        promptCompleteness,
        hardRequirementCount: requirementsLedger.hardRequirements?.length || 0,
        mustIncludeSectionCount: requirementsLedger.mustIncludeSections?.length || 0,
        outputMode: generationOutputMode || 'preview-component',
        generatedCodeLength: validScreens[0]?.reactCode?.length || 0,
        compileSuccess: validScreens.length > 0,
        requirementCoverage: requirementsLedger.mustIncludeSections && requirementsLedger.mustIncludeSections.length > 0
          ? (validateRequirementCoverage(validScreens[0]?.reactCode || '', requirementsLedger).success ? 'success' : 'failed')
          : 'no_sections_requested',
        validScreenCount: validScreens.length
      });

      sendComplete({
        duration,
        requestedScreenCount: finalScreenCount,
        successfulScreenCount: validScreens.length,
        failedScreenCount: Math.max(finalScreenCount - validScreens.length, 0),
        productName: productPlan.appName,
        creativeConcept: productPlan.visualConcept || artDirection.creativeConcept,
        visualAssetMode,
        paletteName: colors.name || 'Custom',
        selectedSkillName: designChoices?.designStyle || null,
        sharedComponentsGenerated: componentPlan.components.length,
        illustrationsGenerated: illustrationManifest.illustrations.length,
        qaScore: Number(avgScore)
      }, validScreens, colors, fonts, references, scanWarning);
    } else {
      throw new Error('No valid screens were generated. The project-level review was not started.');
    }

  } catch (err) {
    console.error(`Generation failed during ${currentStage}:`, err);
    sendError({ message: err.message, stage: currentStage });
  }
}

function detectVisualAssetMode(prompt, userSelectedMode) {
  if (userSelectedMode && userSelectedMode !== 'mixed') {
    return userSelectedMode;
  }
  const lower = prompt.toLowerCase();
  const illustrationKeywords = [
    'illustration', 'vector', 'flower artwork', 'onboarding artwork',
    'floral', 'hand-drawn', 'mascot', 'character', '3d illustration'
  ];
  if (illustrationKeywords.some(kw => lower.includes(kw))) {
    return 'illustration';
  }
  return 'mixed';
}

function resolvePalettePriority({ designChoices, intent, preScannedDesign, designStyleContent, theme }) {
  // If user explicitly locked/customized the color palette, prioritize it
  if (designChoices?.paletteLocked && designChoices?.palette) {
    return validateAndCleanPalette(designChoices.palette, theme);
  }

  // Otherwise, if a style has custom colors, extract and use those as the primary choice!
  if (designStyleContent) {
    const bgMatch = designStyleContent.match(/(?:background|outer-bg|bg)\s*(#[0-9a-fA-F]{6})/i);
    const surfaceMatch = designStyleContent.match(/surface\s*(#[0-9a-fA-F]{6})/i) || designStyleContent.match(/container\s*(#[0-9a-fA-F]{6})/i);
    const borderMatch = designStyleContent.match(/border\s*(#[0-9a-fA-F]{6})/i);
    const textMatch = designStyleContent.match(/(?:text|textPrimary|textSecondary)\s*(#[0-9a-fA-F]{6})/i);
    const accentMatch = designStyleContent.match(/(?:accent)\s*(#[0-9a-fA-F]{6})/i);

    if (bgMatch || surfaceMatch || borderMatch || textMatch || accentMatch) {
      const skillPalette = {
        background: bgMatch ? bgMatch[1] : (theme === 'light' ? '#FAFAFA' : '#090A0F'),
        surface: surfaceMatch ? surfaceMatch[1] : (theme === 'light' ? '#FFFFFF' : '#12131C'),
        border: borderMatch ? borderMatch[1] : (theme === 'light' ? '#E5E7EB' : '#1F2937'),
        textPrimary: textMatch ? textMatch[1] : (theme === 'light' ? '#111827' : '#F5F5F7'),
        primary: accentMatch ? accentMatch[1] : (theme === 'light' ? '#3B82F6' : '#6C5CE7'),
        accent: accentMatch ? accentMatch[1] : (theme === 'light' ? '#3B82F6' : '#6C5CE7'),
        accent2: accentMatch ? accentMatch[1] : (theme === 'light' ? '#10B981' : '#00D2FF')
      };
      return validateAndCleanPalette(skillPalette, theme);
    }
  }

  if (designChoices?.palette) {
    return validateAndCleanPalette(designChoices.palette, theme);
  }
  if (intent?.suggestedPalette) {
    return validateAndCleanPalette(intent.suggestedPalette, theme);
  }
  if (preScannedDesign?.colors && Object.keys(preScannedDesign.colors).length > 0) {
    const refPalette = {
      background: preScannedDesign.colors.background || (theme === 'light' ? '#FAFAFA' : '#090A0F'),
      surface: preScannedDesign.colors.surface || (theme === 'light' ? '#FFFFFF' : '#12131C'),
      primary: preScannedDesign.colors.primary || (theme === 'light' ? '#3B82F6' : '#6C5CE7'),
      accent: preScannedDesign.colors.accent || (theme === 'light' ? '#3B82F6' : '#6C5CE7'),
      accent2: preScannedDesign.colors.accent2 || (theme === 'light' ? '#10B981' : '#00D2FF'),
      textPrimary: theme === 'light' ? '#111827' : '#F5F5F7',
      textSecondary: theme === 'light' ? '#4B5563' : '#8B8D97'
    };
    return validateAndCleanPalette(refPalette, theme);
  }
  return validateAndCleanPalette(null, theme);
}

// ── Mini-Tool: Brand Logo Fetcher ─────────────────────────────────────
async function fetchBrandLogos(brands) {
  const logos = {};
  const fetches = (brands || []).slice(0, 5).map(async (brand) => {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    try {
      // Try Simple Icons first (real SVG logos)
      const res = await fetch(`https://cdn.simpleicons.org/${slug}`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        logos[brand] = { type: 'svg', url: `https://cdn.simpleicons.org/${slug}/ffffff` };
        return;
      }
    } catch {}
    // Fallback to Google Favicon
    logos[brand] = { type: 'img', url: `https://www.google.com/s2/favicons?domain=${slug}.com&sz=64` };
  });
  await Promise.allSettled(fetches);
  return logos;
}

// ── Brain Call 1.5: Content Writing Agent ─────────────────────────────────
async function brainWriteContent(userPrompt, requirementsLedger) {
  const systemPrompt = `You are a world-class Conversion Copywriter and Landing Page Strategist with 15+ years of experience in direct-response marketing.
Your goal is to generate high-converting, emotionally resonant, and contextually rich copy for landing pages, websites, and UI screens.

ANALYSIS RULE FOR USER INPUT:
1. IF the user's prompt is VAGUE or OFF-BAKED (e.g. "make an e-commerce page", "SaaS landing page"):
   - Deeply analyze the implied target audience, their pain points, desires, and primary objections.
   - Generate rich, emotional, benefit-driven headers, hero copy, subtexts, product benefits, FAQs, and interactive section labels.
   - Use frameworks like PAS (Problem-Agitation-Solution) or AIDA (Attention-Interest-Desire-Action).

2. IF the user's prompt is FULLY STRUCTURED and contains specific copy:
   - Respect the user's copy exactly.
   - Do NOT rewrite or alter their messaging.
   - ONLY correct obvious spelling errors, typos, or grammatical slip-ups.

Output ONLY valid JSON, no markdown:
{
  "brandName": string,
  "hero": {
    "headline": string,
    "subheadline": string,
    "primaryCTA": string,
    "secondaryCTA": string
  },
  "features": {
    "title": string,
    "items": Array<{ "title": string, "description": string }>
  },
  "socialProof": {
    "headline": string,
    "testimonials": Array<{ "name": string, "role": string, "quote": string }>
  },
  "cta": {
    "title": string,
    "description": string,
    "ctaText": string
  }
}

Use plain English. No emojis.`;

  const result = await callDeepSeek(systemPrompt, userPrompt, 2000);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('[Error] brainWriteContent JSON parse failed, returning fallback structure:', err.message);
    return {
      brandName: "InspoAI",
      hero: {
        headline: "Turn your ideas into interfaces.",
        subheadline: "Describe your vision, and we'll generate the UI instantly.",
        primaryCTA: "Get Started Free",
        secondaryCTA: "Watch Demo"
      },
      features: {
        title: "Designed for rapid UI creation",
        items: [
          { title: "AI-Powered", description: "Generate beautiful layouts with natural language." },
          { title: "Fully Responsive", description: "Design once and run across all platforms." }
        ]
      },
      socialProof: {
        headline: "Trusted by builders everywhere",
        testimonials: [
          { name: "Sarah K.", role: "Lead Designer", quote: "This tool completely revolutionized our prototyping workflow." }
        ]
      },
      cta: {
        title: "Ready to design your masterpiece?",
        description: "Start generating high-converting layouts today.",
        ctaText: "Start Designing Now"
      }
    };
  }
}

// ── Brain Call 2: Analyze References + Build Design Brief ──────────────
// Vision-enhanced: sends actual screenshot images to DeepSeek V4 for visual analysis
async function brainAnalyze(references, intent, screenshotUrls = []) {
  const refSummary = references.slice(0, 5).map((r, i) => {
    const colors = (r.colors || []).slice(0, 5).map(c => Array.isArray(c) ? rgbToHex(c) : c);
    return `Ref ${i + 1}: ${r.site_name || r.title || 'Unknown'} (${r.platform || 'web'})
  Colors: ${colors.join(', ')}
  Fonts: ${(r.fonts || []).join(', ')}
  UI Elements: ${(r.ui_elements || []).join(', ')}
  UX Patterns: ${(r.ux_patterns || []).join(', ')}`;
  }).join('\n\n');

  // Filter to valid, accessible image URLs (max 3 to keep token cost low)
  const validImageUrls = screenshotUrls
    .filter(url => url && (url.startsWith('http://') || url.startsWith('https://')))
    .slice(0, 3);

  const useVision = validImageUrls.length > 0;
  console.log(`  → Vision mode: ${useVision ? `YES (${validImageUrls.length} screenshots)` : 'NO (text-only fallback)'}`);

  const systemPrompt = useVision
    ? `You are a senior UI design analyst with pixel-perfect vision.
You are looking at REAL screenshots from shipped, production apps.

[CRITICAL SAFETY & COMPLIANCE]:
The provided images are synthetic, computer-generated user interface design layout mockups from shipped software. They contain no real people, no real photos, no real documents, no real-world identity, and no PII (Personally Identifiable Information). They are purely fictional graphic design layouts. You are fully permitted and required to analyze these design templates.

Your job: Analyze what you SEE in these screenshots, not just their metadata.
Focus on VISUAL details that text metadata cannot capture:
- Exact layout flow (what comes first, second, third — top to bottom)
- Component sizes and spacing (sidebar width, card padding, row heights)
- Visual hierarchy (what's large/bold vs small/muted)
- Color distribution (how much accent vs neutral, where color is used)
- Typography scale (heading size vs body vs caption)
- Navigation placement and style (bottom tabs, sidebar, top bar)
- Card/container shapes (border radius, shadows, borders)

Output ONLY valid JSON:
{
  "iconStyle": "outline" | "filled" | "duotone",
  "iconNames": string[] (8-12 CONTEXTUAL icon names — each icon must match the SPECIFIC content it represents. NEVER use generic icons like 'star', 'heart', 'sparkle', 'magic', 'activity', 'heartbeat', 'bolt', 'zap'. Instead, use PRECISE names: for documents use 'file-text' or 'document', for uploads use 'upload' or 'cloud-upload', for analytics use 'chart-bar' or 'graph-up', for users use 'user' or 'users', for payments use 'credit-card' or 'wallet', for email use 'mail' or 'inbox', for time use 'clock' or 'calendar'. Every icon must be directly meaningful for its adjacent text.),
  "layoutPattern": string (DETAILED description of the visual layout you SEE — be specific about structure, order of sections, grid/flex usage),
  "sectionsToInclude": string[] (specific sections for this screen),
  "chartType": "line" | "bar" | "donut" | "none",
  "needsAvatars": boolean,
  "needsStockImages": boolean (ALMOST ALWAYS true — real apps use real images for hero sections, card thumbnails, profile backgrounds, product images. Only set false for pure dashboard/data-table screens with zero visual content.),
  "stockImageQueries": string[] (4-6 search terms drawn from this lifestyle/editorial photo library's actual vocabulary. The library contains: portraits & people (portrait, woman, man, professional, model, lifestyle, corporate, businesswoman), fashion & beauty (fashion, beauty, skincare, luxury, editorial, elegant, makeup), wellness (wellness, meditation, yoga, mindfulness, zen, nature, serene), food (sushi, fine dining, gourmet, culinary, restaurant, breakfast, food photography), finance & tech (finance, fintech, analytics, dashboard, technology, futuristic, corporate), travel & real estate (luxury, travel, tropical, ocean, architecture, interior, resort, villa), workspace (office, workspace, laptop, productivity), nature (landscape, mountains, forest, meadow), abstract art (abstract, gradient, 3D, minimalist). Match terms to the MOOD and INDUSTRY of this screen. Examples — fashion e-commerce: ["fashion", "luxury", "portrait", "beauty", "elegant"]; food delivery: ["food photography", "gourmet", "culinary", "fine dining"]; fitness app: ["wellness", "yoga", "nature", "lifestyle"]; fintech: ["finance", "corporate", "technology", "dashboard"]; travel: ["travel", "luxury", "tropical", "architecture"]; real estate: ["architecture", "luxury", "interior", "villa"]; health/medical: ["wellness", "professional", "portrait", "lifestyle"]. Use ONLY terms from the library vocabulary above — never product names like "iPhone" or "running shoes".),
  "visualNotes": string (describe specific visual details you observe: exact component placement, spacing patterns, typography hierarchy, color usage patterns — this will guide the HTML generator)
}`
    : `You are a design analyst. Given reference screens from real apps, extract the shared design DNA.
Output ONLY valid JSON:
{
  "iconStyle": "outline" | "filled" | "duotone",
  "iconNames": string[] (8-12 CONTEXTUAL icon names — each icon must match the SPECIFIC content it represents. NEVER use generic icons like 'star', 'heart', 'sparkle', 'magic', 'activity', 'heartbeat', 'bolt', 'zap'. Instead, use PRECISE names: for documents use 'file-text' or 'document', for uploads use 'upload' or 'cloud-upload', for analytics use 'chart-bar' or 'graph-up', for users use 'user' or 'users', for payments use 'credit-card' or 'wallet'. Every icon must be directly meaningful for its adjacent text.),
  "layoutPattern": string (describe the layout structure),
  "sectionsToInclude": string[] (specific sections for this screen),
  "chartType": "line" | "bar" | "donut" | "none",
  "needsAvatars": boolean,
  "needsStockImages": boolean (ALMOST ALWAYS true — real apps use real images. Only false for pure data-table screens.),
  "stockImageQueries": string[] (4-6 terms from this lifestyle/editorial library's vocabulary: portraits & people (portrait, woman, man, professional, model, lifestyle), fashion & beauty (fashion, beauty, skincare, luxury, editorial, elegant), wellness (wellness, meditation, yoga, mindfulness, zen), food (sushi, fine dining, gourmet, culinary, restaurant, food photography), finance & tech (finance, fintech, technology, dashboard, corporate, futuristic), travel & architecture (luxury, travel, tropical, ocean, architecture, interior, villa, resort), workspace (office, workspace, laptop), nature (landscape, mountains, forest), abstract (abstract, gradient, 3D, minimalist). Match the mood/industry. Never use product names.)
}`;

  const textContext = `User wants: ${intent.screenType} for ${intent.industry} (${intent.platform}, ${intent.theme} theme)
Sections requested: ${(intent.sections || []).join(', ')}

REFERENCE SCREENS FROM REAL APPS:
${refSummary}

Analyze what icons, layout, charts this screen needs.${useVision ? '\n\nThe images above are REAL screenshots from these reference apps. Describe what you SEE in detail.' : ''}`;

  let result;
  if (useVision) {
    // Build multimodal content: images first, then text context
    const contentParts = [];
    for (const url of validImageUrls) {
      contentParts.push({ type: 'image_url', image_url: { url } });
    }
    contentParts.push({ type: 'text', text: textContext });
    result = await callVisionAPI(systemPrompt, contentParts, 2000);
  } else {
    result = await callDeepSeek(systemPrompt, textContext, 2000);
  }

  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (useVision && parsed.visualNotes) {
      console.log(`  → Vision notes: ${parsed.visualNotes.slice(0, 120)}...`);
    }
    return parsed;
  } catch {
    return {
      iconStyle: 'outline', iconNames: ['home', 'search', 'user', 'settings', 'bell', 'chart-bar'],
      layoutPattern: 'standard mobile layout', sectionsToInclude: intent.sections || ['header', 'content'],
      chartType: 'none', needsAvatars: true, needsStockImages: false, stockImageQuery: null,
      visualNotes: ''
    };
  }
}
// ── Brain Call 2.5: Consistency Specification Agent ──────────────────
async function brainConsistencySpec(intent, analysis, colors, fonts, avatars, screenDescs) {
  const systemPrompt = `You are a UI design systems architect. You are about to generate ${screenDescs.length} screens for the same app.
Your job is to create a SHARED DESIGN CONTRACT that ensures ALL screens look like they belong to the same product.

Output ONLY valid JSON, no markdown. The contract must define:
1. Exact shared component specs (sizes, colors, styles)
2. Shared user data (same names and avatars across screens)
3. Consistent navigation (which tabs, which is active per screen)
4. Consistent header pattern

JSON format:
{
  "appName": string,
  "statusBar": { "style": string, "time": "9:41" },
  "navigation": {
    "type": "bottom-tab" | "sidebar" | "top-tab",
    "tabs": [{ "label": string, "iconName": string, "activeForScreen": number }],
    "height": string,
    "activeStyle": string,
    "inactiveOpacity": "40%"
  },
  "header": {
    "height": string,
    "titleFont": string,
    "rightActions": string[]
  },
  "cards": {
    "borderRadius": string,
    "padding": string,
    "shadow": string
  },
  "sharedUsers": [
    { "name": string, "location": string, "avatarIndex": number }
  ],
  "iconStyle": "outline" | "filled" | "duotone",
  "dividerStyle": string,
  "screenSpecs": [
    { "title": string, "activeTab": number, "uniqueElements": string }
  ]
}`;

  const userPrompt = `APP TYPE: ${intent.screenType}
INDUSTRY: ${intent.industry}
PLATFORM: ${intent.platform}
THEME: ${intent.theme}
ICON STYLE: ${analysis.iconStyle || 'outline'}
SCREENS TO GENERATE:
${screenDescs.map((d, i) => `${i + 1}. ${d}`).join('\n')}
AVAILABLE AVATARS: ${avatars.length} avatar images
FONTS: Heading=${fonts.heading}, Body=${fonts.body}
ACCENT COLOR: ${colors.accent}`;

  const result = await callDeepSeek(systemPrompt, userPrompt, 1200);
  try {
    const cleaned = result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null; // Fallback: no spec, screens generate independently
  }
}

// ── Brain Call 3: Compose Final HTML ──────────────────────────────────
async function brainCompose(designBrief) {
  const {
    device, fonts, colors, icons, avatars, chart, sections, references,
    intent, stockImages, brandLogos, designStyleContent,
    isRefMode, scannedDesign, logoUrl,
    visualAssetMode, illustrationRules, logoPolicy, designPriority,
    rawPrompt, requirementsLedger, generationOutputMode, copySpec,
    userMediaAssets, designChoices
  } = designBrief;

  const isPaletteLocked = designChoices?.paletteLocked || false;

  const iconSnippets = Object.entries(icons || {}).map(([name, svg]) =>
    `ICON "${name}": ${svg}`
  ).join('\n');

  const avatarImgs = (avatars || []).map((url, i) =>
    `AVATAR ${i + 1}: <img src="${url}" alt="user" style="width:40px;height:40px;border-radius:50%;object-fit:cover;">`
  ).join('\n');

  const stockImgs = (stockImages || []).map((img, i) =>
    `STOCK IMAGE ${i + 1}: <img src="${img.url}" alt="${img.alt || ''}" style="width:100%;height:200px;object-fit:cover;border-radius:12px;"> (credit: ${img.credit})`
  ).join('\n');

  const appName = intent?.mentionedBrands?.[0] || 'App';
  const logoSnippet = logoUrl 
    ? `DEFAULT/APP LOGO: <img src="${logoUrl}" alt="Logo" style="width:32px;height:32px;border-radius:8px;">`
    : `NO BRAND LOGO PROVIDED. Policy: ${logoPolicy || 'Do not invent or fetch a random logo. Use a clean text wordmark with the app name. An optional simple one-color monogram may be created using the selected accent color.'}`;

  const brandLogoSnippets = Object.entries(brandLogos || {}).map(([brand, logo]) =>
    `BRAND LOGO "${brand}": <img src="${logo.url}" alt="${brand}" style="width:24px;height:24px;border-radius:4px;">`
  ).join('\n');

  const noiseGradientSnippet = generateNoiseGradient(colors);

  let requirementsSnippet = '';
  if (rawPrompt || requirementsLedger) {
    requirementsSnippet = `
=========================================
RAW USER PROMPT & REQUIREMENTS LEDGER (AUTHORITATIVE):
Raw User Prompt: "${rawPrompt || ''}"
Requirements Ledger: ${requirementsLedger ? JSON.stringify(requirementsLedger, null, 2) : 'None'}

CRITICAL COMPLIANCE DIRECTIVES:
1. The RAW USER PROMPT and REQUIREMENTS LEDGER are authoritative.
2. Before returning code, verify that every hard requirement is implemented.
3. Do NOT rely only on the summarised intent object.
4. Do NOT omit sections merely because they were not included in the short screen description.
=========================================
`;
  }

  let copySpecSnippet = '';
  if (copySpec) {
    copySpecSnippet = `
=========================================
PRE-WRITTEN COPY SPECIFICATION (MANDATORY)
=========================================
You MUST use the exact copywriting, brandName, headlines, subheadlines, descriptions, and CTA labels provided below. Do NOT invent generic text.

BRAND NAME:
${copySpec.brandName || 'InspoAI'}

HERO SECTION COPY:
- Headline: "${copySpec.hero?.headline || ''}"
- Subheadline: "${copySpec.hero?.subheadline || ''}"
- Primary CTA Button Text: "${copySpec.hero?.primaryCTA || ''}"
- Secondary CTA Button Text: "${copySpec.hero?.secondaryCTA || ''}"

FEATURES SECTION COPY:
- Section Title: "${copySpec.features?.title || ''}"
${(copySpec.features?.items || []).map((item, idx) => `  * Point ${idx + 1}: "${item.title}" - "${item.description}"`).join('\n')}

SOCIAL PROOF & TESTIMONIALS COPY:
- Section Headline: "${copySpec.socialProof?.headline || ''}"
${(copySpec.socialProof?.testimonials || []).map((item, idx) => `  * Testimonial ${idx + 1} by ${item.name} (${item.role}): "${item.quote}"`).join('\n')}

FINAL CALL TO ACTION (CTA) COPY:
- Title: "${copySpec.cta?.title || ''}"
- Description: "${copySpec.cta?.description || ''}"
- Button Text: "${copySpec.cta?.ctaText || ''}"
=========================================
`;
  }

  let modeInstructions = '';
  if (generationOutputMode === 'preview-component') {
    modeInstructions = `
=========================================
PREVIEW GENERATION MODE INSTRUCTIONS (CRITICAL):
- This generation stage creates the PREVIEW only, inside one inline React component named "App".
- The user may describe a complete project structure (e.g., App.jsx, main.jsx, package.json, tailwind.config.js), but you MUST ignore the multi-file request and implement all requested visual sections inside a single "App" component.
- Do NOT output multiple files during preview generation.
- Do NOT output package.json, Vite configuration, or markdown code fences.
- Return only one component, root named "App", with no separate files.
=========================================
`;
  }

  // ── BRANCHING: Ref-mode vs Creative-mode ──
  let systemPrompt;

  if (isRefMode && scannedDesign) {
    const scanNotes = scannedDesign.visualNotesForGenerator || '';
    const scanComponents = (scannedDesign.uiComponents || scannedDesign.designDetails || []).join(', ');
    const scanLayout = scannedDesign.layout?.layoutPattern || 'standard layout';
    const scanNav = scannedDesign.layout?.navigationType || 'bottom-tab';
    const scanRadius = scannedDesign.styling?.borderRadius || '12px';
    const scanPadding = scannedDesign.styling?.padding || '16px';
    const scanShadow = scannedDesign.styling?.shadow || 'subtle';
    const scanBorder = scannedDesign.styling?.borderStyle || 'none';
    const scanLang = scannedDesign.content?.language || 'English';
    const scanDomain = scannedDesign.content?.contentDomain || 'general';

    systemPrompt = `You are an elite, pixel-perfect frontend UI engineer and senior design system architect.
A user has uploaded a screenshot of a real application screen (such as a modern finance/banking app dashboard).
Your job is to FAITHFULLY REBUILD that exact screen as a high-fidelity, self-contained React component named App.

THIS IS A STRICT CLONING AND REPLICATION TASK. DO NOT IMPROVISE OR INVENT DESIGN DETAILS.

SCANNED DESIGN SYSTEM DNA FROM THE REFERENCE SCREENSHOT:
- Layout structure: ${scanLayout}
- Navigation layout: ${scanNav}
- Border radius style: ${scanRadius}
- Spacing / Padding: ${scanPadding}
- Box shadows: ${scanShadow}
- Borders / dividers: ${scanBorder}
- Key components to replicate: ${scanComponents}
- Context Domain & Tone: ${scanDomain}
- Inferred language: ${scanLang}
- Detailed scan notes: ${scanNotes}
${designStyleContent ? `
DESIGN SKILL — VISUAL STYLE DIRECTION (CRITICAL: Preserve the reference layout structure above, but apply THIS visual language, color palette, surface treatment, and typography system to the output. The skill overrides generic aesthetic defaults):
${designStyleContent.slice(0, 5000)}
` : ''}
${modeInstructions}
CRITICAL REPLICATION RULES (FOLLOW STEP-BY-STEP WITH THE UTMOST RIGOR):

1. READ THE SCREEN AS A SPEC, NOT A PICTURE:
   - Carefully identify every textual string, heading, number, percentage, label, and detail in the user's prompt or reference screenshot.
   - Render exact strings, capitalization, and numbers exactly as scanned in the DNA.
   - Every single chart or graph must be custom hand-drawn using Recharts components (e.g., ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area) or crisp vector inline SVG paths.
   - You also have access to top-tier interactive libraries:
     - 'framer-motion' for spring animations, gestures, and layout transitions — motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring, useScroll, useInView are ALL pre-imported globals, use them directly without any import statement.
     - Radix UI primitives (e.g., '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', etc.) for accessible, high-interaction widgets (shadcn/ui style).
     - 'clsx' and 'tailwind-merge' for dynamic class merging.

2. REACT ENVIRONMENT COMPATIBILITY:
   - Write valid React JSX code in a single file.
   - Name your main container component 'App' (export default function App() { ... }).
   - Use Tailwind CSS classes for all styling (use 'className="..."' instead of 'class="..."').
   - Use React state (useState, useEffect) to make components interactive (tabs, toggles, hover details, charts).

3. LUXURY BACKGROUND RADIAL GRADIENTS & GLOWS (CRITICAL):
   - Modern, high-end dark dashboard reference layouts feature gorgeous radial/conic background glows. Layer these elegantly using inline style gradients.
   - For light mode screens, use a warm radial background glow at the top: bg-[radial-gradient(80%_60%_at_50%_0%,oklch(0.95_0.05_60/0.6),transparent_70%)] to simulate soft ambient light.
   - Alternate section background textures using a 3-tone rhythm: Tone A (bg-background default warm off-white #faf8f4), Tone B (bg-surface shade darker warm inset #f5f1ea), and Tone C (bg-foreground text-background deep high-contrast ink/accent band).
   - Never stack two identical-background sections. Use edge-faded dividers (h-px bg-gradient-to-r from-transparent via-border to-transparent) instead of raw <hr> lines.
   - Avoid hard cuts between light and dark sections by placing a h-24 bg-gradient-to-b from-background to-foreground transition strip between them.

4. SPACIOUS PADDING, ASYMMETRIC GRID & HERO LAYOUT (CRITICAL):
   - Replicate the exact visual margins, padding, grids, and card sizing from the reference.
   - Spacing Scale Rule: Use mobile-first padding — py-8 sm:py-12 md:py-20 for sections (NEVER bare py-24 which applies to mobile too). Container horizontal padding: px-4 sm:px-6 md:px-8. Constrain widths: max-w-7xl for sections, max-w-5xl for hero headlines, max-w-3xl for FAQ/body text (keep under 70ch).
   - Asymmetric Hero Layout: Desktop-only asymmetric grid: lg:grid-cols-12 gap-12 items-center. Use lg:col-span-6 for copy, lg:col-span-6 for mockup. On mobile this collapses to a single column stack (grid-cols-1).
   - Visual Mockup Hook: Give the mockup container aspect-[4/3] rounded-2xl border bg-card overflow-hidden. Any absolute floating cards/badges MUST use hidden lg:block and MUST be inside an overflow-hidden parent — NEVER use negative offsets (-left-8, -right-6) that can bleed outside the container on mobile.

5. MULTI-LAYERED PREMIUM CARDS:
   - Layer 3-4 subtle styles: rounded-2xl, border border-black/[0.06] (or border-white/[0.06] on dark), bg-white (or bg-card), ring-1 ring-inset ring-white/60 (or ring-white/10) for top-edge highlight, and a transition-all duration-300.
   - Top-to-Bottom Gradient: Use a top-to-bottom card gradient (e.g. from-white to-[oklch(0.97_0.012_85)]) to simulate overhead light.
   - BEAUTIFUL SHADOWS (use these exact values — never default Tailwind shadow scales):
     * sm — compact cards, pills, form controls: shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)]
     * md — cards, panels, elevated surfaces (default): shadow-[0px_0px_0px_1px_rgba(0,0,0,0.06),0px_1px_1px_-0.5px_rgba(0,0,0,0.06),0px_3px_3px_-1.5px_rgba(0,0,0,0.06),0px_6px_6px_-3px_rgba(0,0,0,0.06),0px_12px_12px_-6px_rgba(0,0,0,0.06),0px_24px_24px_-12px_rgba(0,0,0,0.06)]
     * lg — hero media, feature callouts, modal-like containers: shadow-[0_2.8px_2.2px_rgba(0,0,0,0.034),0_6.7px_5.3px_rgba(0,0,0,0.048),0_12.5px_10px_rgba(0,0,0,0.06),0_22.3px_17.9px_rgba(0,0,0,0.072),0_41.8px_33.4px_rgba(0,0,0,0.086),0_100px_80px_rgba(0,0,0,0.12)]
   - Hover Lift: on hover apply the lg shadow + hover:-translate-y-0.5 transition-all duration-300.

6. PREMIUM TAB COMPONENT STRUCTURE:
   - Tab Bar: Inset pill bar style: rounded-full border bg-white/60 backdrop-blur p-1 inline-flex gap-1.
   - Active Tab: bg-foreground text-background shadow-sm with a small active indicator dot (size-1.5 rounded-full bg-emerald-400 animate-pulse).
   - Panel Transition: Force remounting on active tab change by using key={active} on the panel container along with a className="animate-fade-in" for smooth fade-ins.

5. ICONS & CHARTS:
   - DO NOT use emojis.
   - Use standard Lucide icons where possible by importing them at the top of the file:
     import * as Lucide from 'lucide-react';
     (and use them as <Lucide.Home className="..." />, <Lucide.TrendingUp className="..." />, etc.)
     - BANNED ICONS (NEVER use these Lucide icons under any circumstances): Activity, Sparkles, Sparkle, CircleCheckBig, CircleCheck, CheckCircle, CheckCircle2, Heart, Star, Bolt, Zap, Flame, WandSparkles, WandSparkle.
     - INSTEAD of banned icons, use precise contextual equivalents:
       * For activity/analytics/trends, use: TrendingUp, LineChart, BarChart, or ArrowUpRight.
       * For success checkmarks, use: Check or BadgeCheck.
       * For AI features, use: Wand2 or Cpu (instead of Sparkles or WandSparkles).
     Alternatively, use clean custom stroke-based SVG icons with className and standard SVG elements.
   - Every single chart or graph must be custom hand-drawn using Recharts components (e.g., ResponsiveContainer, LineChart, Line, BarChart, Bar, AreaChart, Area) or crisp vector inline SVG paths.

6. COHESIVE SYSTEM FRAMEWORK:
   - Build a phone-sized or desktop-sized layout container: width: 100%; height: 100%; overflow-y: auto.
   - ${device.statusBar ? 'Include a mock status bar at the top: signal, wifi, battery, time "9:41".' : 'No mock status bar needed.'}
   - Include a bottom-tab or sidebar navigation pill rendered exactly like the reference screen. Use a black/dark pill container if the reference screen has a black navigation pill at the bottom.
${intent.platform === 'ios' ? `   - MOBILE PHONE LAYOUT (CRITICAL — iOS 393×852 viewport):
     • Root App component MUST be: <div className="h-screen overflow-hidden flex flex-col"> (never min-h-screen on the root)
     • Top nav/header: fixed height (h-14 or h-16), flex-shrink-0
     • Main content area: <main className="flex-1 overflow-y-auto"> — this makes the content scroll INSIDE the phone frame
     • Bottom tab bar (if present): fixed height, flex-shrink-0, pb-safe
     • NEVER use "min-h-screen flex items-center justify-center" on any section — this centers content vertically, making the top 400px appear blank. Instead start content from the top with pt-4 or pt-6
     • Hero sections: use pt-6 pb-8 NOT py-24 or min-h-screen. All hero content must be visible in the first 300px without scrolling.
     • Content-first layout: put the most important information (headline, CTA, primary image) within the FIRST 350px of the main content area, immediately below the header` : `   - DESKTOP WEB LAYOUT (CRITICAL — 1440px viewport. THIS IS NOT A MOBILE APP. DO NOT generate a phone-sized card centered on the screen):
     • Root must be full-width: <div className="min-h-screen w-full"> — NO h-screen, NO overflow-hidden on root
     • Sticky top navigation bar: <nav className="sticky top-0 z-50 w-full border-b backdrop-blur-md"> with logo left, nav links center/right
     • Content sections use: <section className="w-full py-16 md:py-24"> with inner <div className="max-w-7xl mx-auto px-6 lg:px-8">
     • Hero section: min-h-[80vh] or min-h-screen with LARGE headline (text-5xl to text-7xl), NOT text-xl or text-2xl
     • Multi-column layouts: use CSS grid (grid-cols-2, grid-cols-3, lg:grid-cols-4) for features, cards, pricing
     • NO bottom tab navigation — web apps use top nav or sidebar
     • NO mobile-style stacked single-column card list for desktop — use 2 or 3 column grids
     • Footer: full-width multi-column footer with links, copyright
     • Typography scale for desktop: hero h1 = text-6xl, section h2 = text-4xl, card h3 = text-xl, body = text-base`}

7. MICRO-INTERACTIONS & TRANSITIONS:
   - Add hover states to everything: cards translate-y-[-2px] with increased shadow, buttons scale up to 1.02 on hover, and list items have subtle bg opacity transitions. Make the UI feel alive using React hooks state toggles!

8. LOGO REPLICATION & ASSET COMPLIANCE (CRITICAL): 
   - If the reference screen has a logo, use the provided DEFAULT/APP LOGO img tag (or relevant BRAND LOGO) to render it. Render it cleanly as <img src={...} className="h-8 w-8 object-contain" alt="Logo" />.
   - NEVER use relative paths for images or media (e.g. "assets/photo.jpg", "images/hero.png"). ALL image/video src values MUST be full absolute URLs starting with https://. If the user prompt explicitly provides a specific URL for a background video, logo image, or asset, you MUST use that exact URL in the appropriate tag (e.g. <video src="url"> or <img src="url">). Do not omit, replace, or default them to supabase stock placeholders.

9. TYPESCRIPT & REACT COMPILATION ERROR PREVENTION (CRITICAL):
   - Do NOT use TypeScript. Remove all types, interfaces, parameter annotations (: string, : number, etc.), and generic syntax (<T>). Write pure JavaScript/JSX only.
   - NEVER interpolate variables inside Tailwind class brackets like bg-[\${color}] or text-[\${size}]. Instead, use inline style properties: style={{ backgroundColor: color }} or style={{ color: size }}.
   - NEVER put JSX elements (like <img ... />, <Lucide.Home />) directly inside object/array properties. Instead, store the icon or image URL as a string (e.g. iconName: "Home") and render the JSX element dynamically inside the component rendering logic.
   - Always explicitly import any React hooks used (useState, useEffect, useMemo, useRef, useCallback) from 'react'.
   - DO NOT import Lucide, Recharts, React hooks, or framer-motion — these are pre-loaded globals already in scope.
   - Lucide icons: use directly as <Lucide.Home /> or const { Home } = Lucide;
   - Recharts: use directly as const { LineChart, ... } = Recharts;
   - Framer Motion: use motion, AnimatePresence, useAnimation, useSpring, etc. directly — no import needed.
   - You MAY add explicit imports for @radix-ui/*, clsx, tailwind-merge, three, @react-three/* — these resolve via import map.
   - Ensure all tags (<div ...>...</div>), curly braces { ... }, brackets [ ... ], and parentheses ( ... ) are perfectly closed and balanced.
   - Verify that every variable, state, function, or property referenced in your JSX is fully defined and in scope. Do not reference undefined identifiers.
   - Do NOT write prefix tags like "tsx" or "typescript" on the very first line of your output. Start directly with the imports.
   - STYLE OBJECT TERNARY BUG (CRITICAL — causes SyntaxError): NEVER write a CSS property name directly followed by ===. WRONG: 'backgroundColor=== active ? "#red" : "#blue"'. CORRECT: 'backgroundColor: activeTab === "red" ? "#red" : "#blue"'. Always put the state variable BEFORE ===, and separate the property name from its value with a colon.
   - SHORTHAND PROPERTY BUG (CRITICAL — causes ReferenceError): NEVER use shorthand object properties unless the variable is explicitly declared. WRONG: 'const slides = [{image, title: "foo"}]' when image is never declared. CORRECT: 'const slides = [{image: stockImg.url, title: "foo"}]'. Every property in an object literal must use explicit key: value syntax if the value variable might not be in scope.

Output ONLY valid React component code starting with imports. Do NOT wrap it in HTML tags. Do NOT include markdown code blocks (like \`\`\`jsx) or explanations. Just return raw React component code.`;

  } else {
    const projSystemStr = designBrief.designSystem ? `
DESIGN SYSTEM TO COMPLY WITH:
${JSON.stringify(designBrief.designSystem, null, 2)}
` : '';

    const sharedComponentsStr = designBrief.componentPlan ? `
SHARED COMPONENTS & ILLUSTRATIONS IN SCOPE (DO NOT DEFINE OR WRITE THESE IN YOUR CODE):
The following components are already pre-loaded in your runtime environment. Use them as standard JSX tags:
- Illustrations: ${designBrief.illustrationManifest?.illustrations.map(i => i.componentName).join(', ') || 'None'}
- Reusable UI Components: ${designBrief.componentPlan?.components.map(c => c.name).join(', ') || 'None'}
Assume they are already imported and fully available in scope.` : '';

    // Build the safe icon list to inject into the prompt (first 60 most useful icons)
    const SAFE_ICON_LIST = [
      'Home','Search','Settings','User','Bell','Mail','Phone','Calendar','Clock','Check',
      'X','Plus','Minus','ChevronRight','ChevronLeft','ChevronDown','ChevronUp',
      'ArrowRight','ArrowLeft','ArrowUp','ArrowDown','ArrowUpRight','ArrowDownRight',
      'TrendingUp','TrendingDown','BarChart2','LineChart','PieChart',
      'Edit','Edit2','Trash','Trash2','Download','Upload','Share','Share2',
      'Link','Lock','Unlock','Eye','EyeOff','Filter','SlidersHorizontal',
      'Grid','List','LayoutGrid','LayoutList','Menu','MoreHorizontal','MoreVertical',
      'Info','AlertCircle','AlertTriangle','BadgeCheck','Wand2','Cpu','Layers',
      'Map','MapPin','Tag','Tags','Bookmark','BookOpen','FileText','Folder',
      'Image','Camera','Mic','Volume2','Play','Pause','RefreshCw','RotateCcw',
      'Send','MessageSquare','MessageCircle','Globe','Wifi','Battery','Loader2'
    ].filter(n => VALID_LUCIDE_ICONS.has(n)).join(', ');

    const signatureElement = designBrief.artDirection?.signatureElement || 'thin colored left-border accent stripe on every card';
    const layoutPersonality = designBrief.artDirection?.layoutPersonality || 'structured';
    const contentDensity = designBrief.artDirection?.contentDensity || 'balanced';
    const appContent = designBrief.appContent || {};

    systemPrompt = `You are a world-class UI designer and senior frontend engineer. Your output must be indistinguishable from a real shipped product (Apple, Stripe, Linear quality).

 CRITICAL TOKEN EFFICIENCY (PREVENT TRUNCATION):
DeepSeek has a strict output limit of 4096 tokens. To avoid truncation, your code MUST be compact and efficient (keep the total file under 280 lines). Reuse styles, keep SVG path strings short, and limit mock data arrays to 2-3 items max. NEVER write verbose code.

[Error] FATAL ERRORS — THESE WILL BREAK THE RENDER. NEVER DO ANY OF THESE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. DYNAMIC TAILWIND: NEVER write className={\`text-\${x}-500\`} or bg-[\${color}]
   → ALWAYS hardcode: className="text-blue-500" or use style={{ color }}
2. TYPESCRIPT: NO interfaces, NO type annotations (: string), NO generics (<T>), NO "as Type"
   → Pure JavaScript/JSX only
3. JSX IN DATA: NEVER put <Component/> inside an array or object literal
   → Store icon name as string "Home", render with <Lucide.Home /> inside JSX
4. UNDEFINED VARS: NEVER reference a variable not defined in this component
   → Every const/let used in JSX must be declared in the same file
5. BANNED ICONS: NEVER use: Activity, Sparkles, Sparkle, CircleCheckBig, CircleCheck,
   CheckCircle, CheckCircle2, Heart, Star, Bolt, Zap, Flame, WandSparkles, WandSparkle
   → Use instead: TrendingUp, BarChart2, Check, BadgeCheck, Wand2, Cpu
6. RELATIVE IMAGE PATHS: ALL img src must be full https:// URLs
   → "assets/photo.jpg" is WRONG — only use the provided STOCK IMAGE URLs
7. IMPORT HALLUCINATIONS: Do NOT add import statements for react, react-dom, lucide-react, recharts, framer-motion, or motion/react — these are PRE-IMPORTED GLOBALS already in scope.
   Available globals: Lucide (icons), Recharts (charts), motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring, useScroll, useInView (framer-motion).
   You MAY add explicit imports for: @radix-ui/*, clsx, tailwind-merge, three, @react-three/fiber, @react-three/drei — these resolve via the import map.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SAFE LUCIDE ICONS (only use names from this list):
${SAFE_ICON_LIST}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DESIGN QUALITY RULES — make this feel like a real designer made it:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SIGNATURE ELEMENT (apply this on EVERY card, section, and list item — this is what makes
the UI feel coherent and designed, not randomly assembled):
→ ${signatureElement}

LAYOUT PERSONALITY: ${layoutPersonality}
${layoutPersonality === 'asymmetric' ? '→ Use unequal column splits (5/7, 4/8), offset elements, break grid deliberately in 1-2 places' : ''}
${layoutPersonality === 'editorial' ? '→ Large typographic moments, generous whitespace, bold contrast between text sizes' : ''}
${layoutPersonality === 'structured' ? '→ Clean grid, aligned edges, consistent rhythm between sections' : ''}
${layoutPersonality === 'fluid' ? '→ Flowing sections, curved dividers, elements that bleed across column boundaries' : ''}
${layoutPersonality === 'modular' ? '→ Card-based, bento-style grid, each block is self-contained' : ''}

CONTENT DENSITY: ${contentDensity}
${contentDensity === 'sparse' ? '→ Minimum 80px (py-20) between sections, max 4 elements per screen view, large typography' : ''}
${contentDensity === 'rich' ? '→ Dense information, tables, lists, stats; use compact spacing py-3 py-4 within cards' : ''}
${contentDensity === 'balanced' ? '→ Sections py-12 to py-16, mix of roomy hero + tighter content rows' : ''}

VISUAL HIERARCHY (non-negotiable):
→ ONE H1-equivalent per screen (biggest element, largest font size on page)
→ Primary CTA button must be visually distinct from ALL other buttons (different fill or size)
→ At least ONE element dramatically larger than its neighbors (oversized stat, hero text, large image)
→ No more than 3 competing focal points per screen
→ Sections need minimum py-12 vertical padding — no cramped stacking

ANTI-REPETITION RULES:
→ If you render the same card component more than twice, the third instance MUST differ in: size, color, content type, or layout
→ No two adjacent sections can share the same background color
→ Maximum 2 center-aligned text sections per screen — all others must be left-aligned
→ Lists with 5+ items must vary the treatment of item 4+ (compact rows, different visual style)
→ NEVER place 4 identical cards in a 2x2 or 4-column grid with the same content structure

REALISTIC CONTENT (use this instead of placeholders):
${appContent.heroHeadline ? `→ Hero headline: "${appContent.heroHeadline}"` : '→ Write specific, punchy copy — NOT "Welcome to AppName" or "Your journey starts here"'}
${appContent.heroSubline ? `→ Hero subline: "${appContent.heroSubline}"` : '→ Sublines must be max 12 words, specific to this product domain'}
${appContent.primaryCTA ? `→ Primary CTA: "${appContent.primaryCTA}"` : '→ CTAs must be action-specific (not just "Get Started" or "Learn More")'}
${appContent.userNames?.length ? `→ User names to use: ${appContent.userNames.join(', ')}` : '→ Use realistic diverse names — no "John Doe" or "User 1"'}
${appContent.metrics?.length ? `→ Metrics: ${appContent.metrics.map(m => `${m.label}: ${m.value} (${m.trend})`).join(', ')}` : '→ All numbers must be irregular (2,847 not 3,000; 94% not 100%; $47/mo not $50/mo)'}
${appContent.recentDates?.length ? `→ Recent dates: ${appContent.recentDates.join(', ')}` : '→ Use specific recent dates (Mar 14, Feb 28) not "Today" or "Recent"'}

TECHNICAL RULES:
1. Output ONLY the React component code. No HTML wrappers, no doctype, no CDN scripts.
2. Main component MUST be named "App": export default function App() { ... }
3. Import icons ONLY as: import * as Lucide from 'lucide-react'; then use <Lucide.Home />
4. Use Tailwind CSS className="..." for all styling (never class="...")
5. Use useState/useEffect for interactivity: active tabs, toggles, bottom nav switching
6. Use only colors from the provided design system — ignore any colors in the design skill
7. Under "illustration" mode: NO stock photos, NO remote images — only provided illustration components and SVGs
8. Every <img> tag MUST have onError handler: onError={e => e.target.style.display='none'}
9. Consistent spacing from the design system — no arbitrary magic numbers
10. USER ASSET & MEDIA COMPLIANCE (CRITICAL): If the user prompt explicitly provides a specific URL for a background video, logo image, or asset (such as an mp4 link), you MUST use that exact URL in the appropriate tag (e.g. <video src="url"> or <img src="url">) instead of replacing it with stock image placeholders. Do not omit or default user-provided asset URLs.

PRODUCT PLAN:
${JSON.stringify(designBrief.productPlan, null, 2)}

ART DIRECTION:
${JSON.stringify(designBrief.artDirection, null, 2)}
${projSystemStr}
${sharedComponentsStr}
${modeInstructions}

SCREEN SPECIFIC SPECIFICATIONS:
- Screen Name: "${designBrief.targetScreenSpec?.name || intent?.screenType || 'Screen'}"
- Purpose: "${designBrief.targetScreenSpec?.purpose || intent?.screenType || 'General Purpose'}"
- Primary Action: "${designBrief.targetScreenSpec?.primaryAction || 'Continue'}"
- Required Content: ${JSON.stringify(designBrief.targetScreenSpec?.requiredContent || sections || [])}
- Previous Screen ID: "${designBrief.targetScreenSpec?.previousScreen || 'none'}"
- Next Screen ID: "${designBrief.targetScreenSpec?.nextScreen || 'none'}"

PLATFORM: ${intent?.platform || 'ios'} (${device?.label || 'iPhone'}, ${device?.width || 375}x${device?.height || 812})
THEME: ${intent?.theme || 'dark'}
SECTIONS TO INCLUDE: ${(sections || []).join(', ')}
LAYOUT GUIDANCE: ${designBrief.layoutPattern || 'standard layout'}
${designBrief.visualNotes ? `VISUAL REFERENCE NOTES (from analyzing real screenshots -- follow these closely):
${designBrief.visualNotes}` : ''}
REFERENCE APPS: ${(references || []).map(r => r.site_name || r.title).filter(Boolean).join(', ')}
${designBrief.consistencySpec ? `
DESIGN CONTRACT (follow this EXACTLY for consistency with other screens in this app):
${JSON.stringify(designBrief.consistencySpec, null, 0)}

THIS IS SCREEN: "${intent.screenType}"
ACTIVE TAB INDEX: ${designBrief.activeTabIndex ?? 0}
You MUST use the EXACT same navigation tabs, header style, card radius, icon style, and user names as defined in the contract above.` : ''}
${designStyleContent ? `

ACTIVE DESIGN SKILL — HIGHEST PRIORITY VISUAL DIRECTIVE (${isPaletteLocked ? "CRITICAL: Override the skill's default colors with the custom COLOR PALETTE specified below. Follow only the skill's layout, spacing, and structural directives" : "MANDATORY: Follow the visual language, typography, layout, spacing, and signature Accents of this skill. The primary, background, and accent colors to use are specified in the COLOR PALETTE section below"}):
${designStyleContent.slice(0, 5000)}` : ''}`;
  }

  const userMediaSnippet = userMediaAssets && userMediaAssets.length > 0
    ? `\n=========================================\nUSER-PROVIDED MEDIA ASSETS — HIGHEST PRIORITY — USE THESE EXACT URLs:\nThe user explicitly provided the following assets in their prompt. You MUST embed them using the exact URL shown. These override any stock image placeholders for the same slot. Do NOT replace them with supabase/unsplash/placeholder URLs.\n${userMediaAssets.map((url, i) => {
        const isVideo = /\.(mp4|mov|webm|avi|mkv)($|\?)/i.test(url);
        return isVideo
          ? `VIDEO ASSET ${i + 1}: ${url}\n  → Use as: <video src="${url}" autoPlay muted loop playsInline className="w-full h-full object-cover" />`
          : `IMAGE ASSET ${i + 1}: ${url}\n  → Use as: <img src="${url}" alt="" className="w-full h-full object-cover" onError={e => e.target.style.display='none'} />`;
      }).join('\n')}\n=========================================\n`
    : '';

  const userPrompt = `${userMediaSnippet}AVAILABLE ICONS:
${iconSnippets || 'No pre-provided icons. Import standard icons from "lucide-react" instead.'}

AVAILABLE AVATARS (use these for profile pictures):
${avatarImgs || 'No avatars.'}

${userMediaAssets && userMediaAssets.length > 0
  ? (isRefMode ? `AVAILABLE STOCK IMAGES (use ONLY if the reference screenshot contained photography and you need additional images beyond the user-provided assets above. DO NOT repeat or reuse the same image URL across different cards/containers):
${stockImgs || 'No stock images.'}`
  : `AVAILABLE STOCK IMAGES (use for any image slots NOT already covered by USER-PROVIDED MEDIA ASSETS above. DO NOT repeat or reuse the same image URL across different cards/containers):
${stockImgs || 'No pre-fetched images.'}`)
  : (isRefMode ? `AVAILABLE STOCK IMAGES (use ONLY if the reference screenshot contained photography. DO NOT repeat or reuse the same image URL across different cards/containers; every image card must use a unique URL):
${stockImgs || 'No stock images.'}` : `AVAILABLE STOCK IMAGES (MANDATORY — you MUST use these in your design. DO NOT repeat or reuse the same image URL across different cards/containers; every image card must use a unique URL):
${stockImgs || 'No pre-fetched images.'}`)}

AVAILABLE LOGOS & BRAND LOGOS (MANDATORY: Use these images instead of generating custom SVG logos):
${logoSnippet}
${brandLogoSnippets || 'No additional brand logos.'}

${chart ? `CHART SVG REFERENCE (you can use Recharts or custom inline SVG paths mirroring this chart structure):\n<svg viewBox="0 0 280 160">${chart}</svg>` : 'No chart needed.'}

${requirementsSnippet}
${copySpecSnippet}

COLOR PALETTE (MUST USE THESE STYLES & HEX VALUES):
- Primary (main surfaces, cards, containers): ${colors.primary || colors.surface}
- Secondary / Background (page background): ${colors.secondary || colors.background}
- Accent (CTAs, highlights, interactive): ${colors.accent}
- Accent Secondary: ${colors.accentSecondary}
- Surface/Card: ${colors.surface}
- Border: ${colors.border}
- Text Primary: ${colors.textPrimary}
- Text Secondary: ${colors.textSecondary}
- Success: ${colors.success}
- Warning: ${colors.warning}

FONTS: Heading: ${fonts.heading}, Body: ${fonts.body}

${visualAssetMode ? `VISUAL ASSET MODE: ${visualAssetMode}
${visualAssetMode === 'illustration' ? `ILLUSTRATION RULES:
- Do not automatically fetch or prioritize stock photographs.
- Instead, write reusable inline SVG React components (e.g. flower artwork, vector onboarding illustration).
- Use simple, safe SVG primitives: <path>, <circle>, <ellipse>, <rect>, <linearGradient>, <radialGradient>.
- Use the selected accent and palette colors inside the illustration.
- Reuse the same illustration style/language across all onboarding screens.
- Do not use external placeholder images.
- Keep SVG path data simple to avoid compiler errors.` : ''}` : ''}

${designStyleContent ? `DESIGN SKILL — MANDATORY VISUAL STYLE (${isPaletteLocked ? "CRITICAL: Override the skill's default colors with the custom COLOR PALETTE specified below. Follow only the skill's layout, spacing, and structural directives" : "MANDATORY: Follow the visual language, typography, layout, spacing, and signature Accents of this skill. The colors specified in the COLOR PALETTE section below must be strictly used"}):
${designStyleContent.slice(0, 6000)}` : ''}
${!designStyleContent && DESIGN_RULES ? `DESIGN SYSTEM REFERENCE:
${DESIGN_RULES}` : ''}

Generate the complete React component source code now. Make it stunning, pixel-perfect, interactive, and production-ready.
Include state hooks (useState, useEffect) for toggles/tabs/charts. Make sure to define a single main container component named 'App' (export default function App() { ... }) that renders the screen inside a root layout.
${intent.platform === 'ios' ? 'REMINDER: iOS phone layout — root must be h-screen overflow-hidden flex flex-col. Main area must be flex-1 overflow-y-auto. First visible content must appear within the top 300px (no vertically-centered min-h-screen sections).' : 'REMINDER: DESKTOP WEB — Generate a full-width 1440px web page, NOT a phone UI. Must have: sticky top nav, large hero (text-6xl heading), multi-column section grids, full-width sections with max-w-7xl mx-auto containers, and a footer. NO bottom tab bar. NO single-column mobile card stacks on desktop.'}
Do NOT wrap the code in HTML tags. Do NOT output anything other than valid React component code.`;

  // Set max tokens to 20,000 as requested by user to allow maximum headroom for complete generation.
  // Note: DeepSeek's server may clamp this to its maximum supported output limit (e.g. 8192 for reasoner / 4096 for chat).
  const maxTokens = 20000;

  return await callDeepSeek(systemPrompt, userPrompt, maxTokens);
}

// ── Repair Truncated JSX (BUG FIX #3) ────────────────────────────────────────
function repairTruncatedJSX(code) {
  let braces = 0, parens = 0, brackets = 0;
  let inString = false, strChar = '';
  let inTemplate = false;
  let inSingleLineComment = false;
  let inMultiLineComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const nextCh = i < code.length - 1 ? code[i + 1] : '';
    const prevCh = i > 0 ? code[i - 1] : '';

    // Skip escaped characters inside strings
    if (prevCh === '\\' && (inString || inTemplate)) continue;

    // 1. If inside single-line comment, check for newline
    if (inSingleLineComment) {
      if (ch === '\n') {
        inSingleLineComment = false;
      }
      continue;
    }

    // 2. If inside multi-line comment, check for closure
    if (inMultiLineComment) {
      if (ch === '*' && nextCh === '/') {
        inMultiLineComment = false;
        i++; // skip '/'
      }
      continue;
    }

    // 3. If inside a regular string (single or double quote)
    if (inString) {
      if (ch === strChar) {
        inString = false;
      }
      continue;
    }

    // 4. If inside a template literal
    if (inTemplate) {
      if (ch === '`') {
        inTemplate = false;
      }
      continue;
    }

    // 5. Detect comment and string boundaries
    if (ch === '/' && nextCh === '/') {
      inSingleLineComment = true;
      i++; // skip '/'
      continue;
    }
    if (ch === '/' && nextCh === '*') {
      inMultiLineComment = true;
      i++; // skip '*'
      continue;
    }
    if (ch === '"' || ch === "'") {
      // Skip single quotes/apostrophes in prose (like Today's, don't, user's)
      if (ch === "'" && /\w/.test(prevCh) && /\w/.test(nextCh)) {
        continue;
      }
      inString = true;
      strChar = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      continue;
    }

    // 6. Count structural characters outside of comments/strings
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '(') parens++;
    else if (ch === ')') parens--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // If balanced (or negative mismatches, which are impossible to close anyway), no repair needed
  if (braces <= 0 && parens <= 0 && brackets <= 0) return code;

  console.warn(`[Warning] JSX truncation detected — braces:${braces}, parens:${parens}, brackets:${brackets}. Attempting repair...`);

  // Build closing suffix
  let suffix = '\n// ── Auto-repaired truncated output ──';
  
  // Close brackets first (arrays), then parens (function calls, JSX), then braces (blocks)
  while (brackets > 0) { suffix += '\n]'; brackets--; }
  while (parens > 0) { suffix += '\n)'; parens--; }
  while (braces > 0) { suffix += '\n}'; braces--; }
  
  code += suffix;
  
  // Ensure the component function App exists even after truncation
  if (!/function\s+App\b/.test(code) && !/const\s+App\s*=/.test(code)) {
    code += '\nfunction App() { return React.createElement("div", {className: "flex items-center justify-center h-screen bg-gray-900 text-white text-xl"}, "Screen generation was truncated. Please try again."); }';
  }
  
  return code;
}

// ── Sanitize LLM React Code for Inline Babel Execution ───────────────────────
function sanitizeReactCode(rawReactCode) {
  let code = rawReactCode;

  // Strip leading stray language tags (like "tsx" or "typescript") that LLMs sometimes output on the first line
  code = code.replace(/^(tsx|typescript|jsx|javascript|html)\b\s*\n/i, '').trim();

  // Strip TypeScript type annotations using the backend BabelInstance if available
  if (BabelInstance) {
    try {
      const result = BabelInstance.transform(code, {
        presets: ['typescript'],
        filename: 'App.tsx',
        retainLines: true
      });
      if (result && result.code) {
        code = result.code;
      }
    } catch (err) {
      console.warn('[Warning] Failed to strip TypeScript types using Babel:', err.message);
    }
  } else {
    // Fallback regex-based TS stripping when Babel is not loaded
    console.log('Running fallback regex-based TypeScript stripping...');
    // Remove 'import type' statements
    code = code.replace(/^\s*import\s+type\s+.*from\s+['"].*['"];?\s*$/gm, '');
    // Remove 'export type' statements
    code = code.replace(/^\s*export\s+type\s+\{[^}]*\}\s*;?\s*$/gm, '');
    // Remove interface declarations (including multi-line with nested braces)
    code = code.replace(/\binterface\s+\w+(?:\s+extends\s+[\w,\s<>]+)?\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)?\}/g, '');
    // Remove enum declarations
    code = code.replace(/(?:const\s+)?enum\s+\w+\s*\{[^}]*\}/g, '');
    // Remove type alias declarations (including generics and complex union types)
    code = code.replace(/\btype\s+\w+(?:<[^>]+>)?\s*=[\s\S]*?;(?=\s*(?:const|let|var|function|class|type|interface|export|import|\/\/|\n\n))/g, '');
    // Remove 'as const' assertions
    code = code.replace(/\bas\s+const\b/g, '');
    // Remove 'satisfies Type' (TypeScript 4.9+)
    code = code.replace(/\s+satisfies\s+[\w<>[\],\s.]+(?=[;,\n\)])/g, '');
    // Remove type casting: value as SomeType<Generic>  — handle nested generics
    code = code.replace(/\s+as\s+[A-Za-z_][\w<>[\],\s.|&]*/g, '');
    // Remove return type annotations on functions: ): ReturnType =>  or ): void {
    code = code.replace(/\)\s*:\s*[A-Za-z_][\w<>[\].,\s|&]*(?=\s*(?:=>|\{))/g, ')');
    // Remove variable type annotations: const x: Type<Generic> = ...
    code = code.replace(/\b(const|let|var)\s+(\w+)\s*:\s*[a-zA-Z_][\w<>[\].,\s|&]*/g, '$1 $2');
    // Remove parameter annotations: (x: Type<Generic>, y: Type)
    code = code.replace(/(\(|,)(\s*\w+\s*):\s*[A-Za-z_][\w<>[\].,\s|&]*(?=\s*[,)=?])/g, '$1$2');
    // Remove non-null assertions: value!
    code = code.replace(/(\w)!(?=[.\[,;)\s])/g, '$1');
    // Remove optional chaining on parameters: param?: Type
    code = code.replace(/(\w)\?:\s*[A-Za-z_][\w<>[\].,\s|&]*/g, '$1');
    // Remove generic type parameters from arrow functions: <T>(x) => or <T extends Foo>(x) =>
    code = code.replace(/<([A-Z]\w*)(?:\s+extends\s+[^>]+)?>\s*\(/g, '(');
  }

  // Remove React imports completely since React and its hooks/elements are imported at the top-level
  code = code.replace(/import\s+(?:React\s*,\s*)?\{\s*[\s\S]*?\}\s*from\s*['"]react['"];?/g, '');
  code = code.replace(/^\s*import\s+(?:React|\*\s+as\s+React)\s+from\s+['"]react['"];?\s*$/gm, '');

  // Remove destructuring of React hooks/components from React
  const reactDestructureRegex = /(?:const|let|var)\s*\{\s*([a-zA-Z0-9_\s,]+)\s*\}\s*=\s*(?:window\.)?React\b;?/g;
  code = code.replace(reactDestructureRegex, (match, destructuredVars) => {
    const vars = destructuredVars.split(',').map(v => v.trim());
    const standardReactExports = new Set([
      'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo', 'useContext', 
      'useReducer', 'useLayoutEffect', 'useTransition', 'useDeferredValue', 
      'useId', 'useImperativeHandle', 'useDebugValue', 'createContext', 
      'Fragment', 'Component', 'PureComponent', 'forwardRef', 'memo', 'lazy', 'Suspense'
    ]);
    const remainingVars = vars.filter(v => !standardReactExports.has(v));
    if (remainingVars.length === 0) {
      return ''; // remove entire declaration
    }
    return `const { ${remainingVars.join(', ')} } = React;`;
  });

  // Remove single hook assignments from React (e.g. const useState = React.useState;)
  const hookAssignmentRegex = /(?:const|let|var)\s+(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useTransition|useDeferredValue|useId|useImperativeHandle|useDebugValue|createContext|Fragment|Component|PureComponent|forwardRef|memo)\s*=\s*(?:window\.)?React\.\1;?/g;
  code = code.replace(hookAssignmentRegex, '');

  // Fix malformed lucide wildcard import: AI sometimes outputs `import *'lucide-react'` or
  // `import * 'lucide-react'` (missing `as Lucide from`). Lucide is globally available in the
  // iframe via the HTML template, so just remove these broken lines entirely.
  code = code.replace(/^\s*import\s*\*\s*(?:as\s+\w+\s*)?['"]lucide-react['"];?\s*$/gm, '');

  // Handle Lucide icon imports: map specific icon imports to destructured assignments from Lucide
  code = code.replace(/import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*['"]lucide-react['"];?/g, (match, imports) => {
    const cleanImports = imports.replace(/\s+/g, ' ');
    return `const { ${cleanImports} } = Lucide;`;
  });
  code = code.replace(/^\s*import\s+.*from\s+['"]lucide-react['"];?\s*$/gm, '');

  // Handle Recharts imports: map specific Recharts component imports to destructured assignments from Recharts
  code = code.replace(/import\s*\{\s*([\s\S]*?)\s*\}\s*from\s*['"]recharts['"];?/g, (match, imports) => {
    const cleanImports = imports.replace(/\s+/g, ' ');
    return `const { ${cleanImports} } = Recharts;`;
  });
  code = code.replace(/^\s*import\s+.*from\s+['"]recharts['"];?\s*$/gm, '');

  // Remove duplicate react-dom/client or react-dom imports
  code = code
    .replace(/^\s*import\s+.*from\s+['"]react-dom\/client['"];?\s*$/gm, '')
    .replace(/^\s*import\s+.*from\s+['"]react-dom['"];?\s*$/gm, '');

  // Strip framer-motion / motion/react imports — pre-imported as globals in the HTML template
  code = code.replace(/import\s*\{\s*[\s\S]*?\}\s*from\s*['"]framer-motion['"];?/g, '');
  code = code.replace(/^\s*import\s+.*from\s*['"]framer-motion['"];?\s*$/gm, '');
  code = code.replace(/import\s*\{\s*[\s\S]*?\}\s*from\s*['"]motion\/react['"];?/g, '');
  code = code.replace(/^\s*import\s+.*from\s*['"]motion\/react['"];?\s*$/gm, '');

  // Strip CSS / SCSS / module stylesheet imports — they don't resolve in the iframe sandbox
  code = code.replace(/^\s*import\s+['"][^'"]*\.(?:css|scss|sass|less)['"];?\s*$/gm, '');
  code = code.replace(/^\s*import\s+\w+\s+from\s+['"][^'"]*\.(?:css|scss|sass|less|module\.css|module\.scss)['"];?\s*$/gm, '');

  // Remove export default (illegal in inline <script type="text/babel">)
  code = code
    .replace(/^\s*export\s+default\s+function\s+/gm, 'function ')
    .replace(/^\s*export\s+default\s+class\s+/gm, 'class ')
    .replace(/^\s*export\s+default\s+const\s+/gm, 'const ')
    .replace(/^\s*export\s+default\s+/gm, '')
    .replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '');

  // Remove trailing bare component name expressions like "App;" at end of file
  code = code.replace(/\n\s*(App|GeneratedScreen|Dashboard|UI|Screen|Main)\s*;?\s*[\s\n]*$/, '\n');

  // ── Fix AI code pattern bugs ──────────────────────────────────────────────

  // Fix: `cssPropName=== condition ? trueVal : falseVal` in JSX style objects.
  // The AI forgets the state variable before `===`, producing a SyntaxError.
  // e.g. `backgroundColor=== 'share' ? '#C4A882' : 'transparent'`
  // Safe: only matches known CSS camelCase property names followed by `===` (no space before).
  code = code.replace(
    /\b(backgroundColor|backgroundImage|background|color|fontSize|fontWeight|fontStyle|fontFamily|textAlign|textDecoration|textTransform|letterSpacing|lineHeight|transform|transition|animation|opacity|width|height|minWidth|maxWidth|minHeight|maxHeight|marginTop|marginRight|marginBottom|marginLeft|paddingTop|paddingRight|paddingBottom|paddingLeft|borderRadius|borderColor|borderWidth|borderStyle|boxShadow|outline|position|top|right|bottom|left|zIndex|display|flexDirection|flexWrap|alignItems|justifyContent|alignContent|gap|overflowX|overflowY|overflow|cursor|pointerEvents|visibility|objectFit|filter|fill|stroke)===[ \t]*([^?{\n]+?)\s*\?[ \t]*('[^']*'|"[^"]*"|[^,:\n}]+?)\s*:[ \t]*('[^']*'|"[^"]*"|[^,\n}]+)/g,
    (_match, prop, _cond, _trueVal, falseVal) => `${prop}: ${falseVal.trim()}`
  );

  // Fix: `image,` shorthand property when `image` variable is never declared.
  // e.g. const slides = [{image, title: 'foo'}] → ReferenceError: image is not defined.
  if (!/\b(?:const|let|var)\s+image\b/.test(code) &&
      !/function\s*\w*\s*\([^)]*\bimage\b/.test(code) &&
      /\bimage,/.test(code)) {
    const urlMatch = code.match(/"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif|svg|avif))"/);
    const fallback = urlMatch ? urlMatch[1] : '';
    code = code.replace(/\bimage,/g, `image: "${fallback}",`);
  }

  // Fix: relative image paths in string literals (e.g. "assets/variants/photo.jpg")
  // These don't resolve inside the iframe sandbox — replace with empty string.
  code = code.replace(/"assets\/[^"]*"/g, '""');
  code = code.replace(/'assets\/[^']*'/g, "''");

  // Repair any truncation
  code = repairTruncatedJSX(code);

  // Run the programmatic invalid Lucide icon fixes
  code = fixInvalidLucideIcons(code);

  // ── Design quality normalizers (run after TS stripping + import rewriting) ──

  // Replace arbitrary spacing values with nearest Tailwind grid class
  code = normalizeSpacing(code);

  // Replace arbitrary text sizes with nearest Tailwind scale class
  code = enforceTypeScale(code);

  // Replace suspiciously round numbers in JSX text with realistic values
  code = realistifyNumbers(code);

  // Apply deterministic pre-fixes for common AI code generation bugs
  code = deterministicPreFix(code);

  // Clean up excessive blank lines from removed imports
  code = code.replace(/\n{3,}/g, '\n\n').trim();

  return code;
}

// ── Brain Call 4: Verify and Fix React/TypeScript Compilation Errors ──────────────────
async function brainVerifyAndFix(reactCode, designBrief = {}) {
  // Run programmatic fixes first to resolve invalid/banned icons immediately
  let code = sanitizeReactCode(extractReactCode(reactCode));
  let attempts = 0;
  const maxAttempts = 3;

  const stockImages = designBrief?.stockImages || [];
  let stockImgsList = stockImages.map(img => img.url);
  if (stockImgsList.length === 0) {
    stockImgsList = [
      ...CURATED_AURA_ASSETS.abstract.slice(0, 3),
      ...CURATED_AURA_ASSETS.background.slice(0, 3),
      ...CURATED_AURA_ASSETS.headshot.slice(0, 3),
      ...CURATED_AURA_ASSETS.architecture.slice(0, 3)
    ];
  }
  const allowedImagesSnippet = stockImgsList.map((url, i) => `IMAGE ${i + 1}: ${url}`).join('\n');

  // ── Deterministic pre-fix pass (zero LLM cost, runs before every attempt) ──
  // Apply known-pattern fixes: dynamic Tailwind, TS generics, bad imports, etc.
  code = deterministicPreFix(code);

  // Also run error-localized known-pattern regex fixes before even trying to compile
  // Fix: dynamic Tailwind interpolation in className template literals
  code = code.replace(/className=\{`([^`]*)\$\{[^}]+\}([^`]*)`\}/g, (match, before, after) => {
    // Strip interpolated parts and just keep static classes — prevents JIT resolution failure
    const staticClasses = (before + after).trim().replace(/\s+/g, ' ');
    return staticClasses ? `className="${staticClasses}"` : '';
  });

  // Fix: Template literal classNames with multiple interpolations — convert whole thing to empty or remove
  code = code.replace(/className=\{`[^`]*\$\{[^`]+`\}/g, 'className=""');

  while (attempts < maxAttempts) {
    const check = compileCheck(code);

    // Before calling LLM, run targeted regex fixes based on the specific error message
    if (!check.success) {
      const errMsg = check.error || '';

      // Known fix: Recharts data prop issues — if error mentions Recharts or data
      if (/recharts|AreaChart|LineChart|BarChart|PieChart|RadarChart/i.test(errMsg)) {
        // Ensure Recharts globals are destructured (not imported)
        code = code.replace(/import\s*\{([^}]+)\}\s*from\s*['"]recharts['"]\s*;?/g, (_, imports) =>
          `const { ${imports.replace(/\s+/g,' ').trim()} } = Recharts;`
        );
      }

      // Known fix: relative image path in src attribute
      if (/assets\/|images\//.test(code)) {
        code = code.replace(/(src|image)\s*=\s*["'](?!https?:\/\/)(?!data:)[^"']+["']/g, '$1=""');
      }

      // Known fix: missing semicolons or stray characters at end of file
      code = code.replace(/[^}\s];?\s*$/, (m) => m.includes('}') ? m : '');
    }

    if (check.success) {
      if (attempts > 0) {
        console.log(`  [Verify & Fix] Code successfully repaired after ${attempts} attempts!`);
      } else {
        console.log(`  [Verify & Fix] Code compiled cleanly with 0 syntax errors.`);
      }
      break;
    }

    console.warn(`  [Verify & Fix] Compilation failed on attempt ${attempts + 1}: ${check.error}`);
    attempts++;

    if (attempts >= maxAttempts) {
      const finalError = new Error(
        `Generated React code failed validation after ${maxAttempts} repair attempts: ${check.error}`
      );
      finalError.code = 'GENERATED_CODE_INVALID';
      finalError.compilerError = check.error;
      throw finalError;
    }

    // Call LLM fixer with the exact compilation error
    const systemPrompt = `You are an elite senior frontend QA engineer and compiler/linter specialist.
Your job is to inspect the provided React + Tailwind CSS code and fix the compilation/syntax error it threw.
Analyze the compilation error message, find the bug in the code, and fix it.

MANDATORY IMAGE RULE:
You MUST ONLY use image URLs from the ALLOWED IMAGES list below. DO NOT use or introduce any external image URLs (such as Unsplash, Lorem Pixel, or placeholders) under any circumstances. If the code contains any external image URLs, replace them with URLs from the ALLOWED IMAGES list.

ALLOWED IMAGES:
${allowedImagesSnippet}

COMPILATION ERROR:
${check.error}

COMMON BUGS TO DOUBLE-CHECK & FIX:
1. Recharts Elements:
   - Recharts charts (like LineChart, BarChart, AreaChart, PieChart) MUST receive a "data" prop which is an array of objects. Never leave them with empty data or missing fields.
   - You MUST NOT put raw text nodes or invalid elements directly inside Recharts wrappers. Only child elements like <XAxis>, <YAxis>, <Tooltip>, <CartesianGrid>, <Line>, <Bar>, <Area>, <Cell>, etc., are allowed.
   - Do NOT wrap Recharts elements inside other Recharts elements incorrectly.
2. Lucide Icons:
   - Ensure all Lucide icons are used correctly as <Lucide.IconName className="..." /> OR as const { IconName } = Lucide; <IconName />.
   - Do NOT use icons that do not exist or are misspelled in lucide-react v0.300.0.
   - Common hallucinations and correct replacements:
     * House -> Home
     * WandSparkles -> Wand2
     * WandSparkle -> Wand2
     * CircleCheckBig -> BadgeCheck
     * CircleCheck -> BadgeCheck
     * Bolt -> Lightbulb
     * Armchair -> Sofa
     * PawPrint -> Dog
   - Do NOT use any banned Lucide icons (Activity, Sparkles, Sparkle, CircleCheckBig, CircleCheck, CheckCircle, CheckCircle2, Heart, Star, Bolt, Zap, Flame, WandSparkles, WandSparkle). Replace them with TrendingUp, LineChart, Check, BadgeCheck, Wand2, Cpu, Settings, Sliders, or Gear depending on context.
3. Types & TypeScript Syntax:
   - Do NOT use TypeScript. Remove all types, interfaces, parameter annotations (: string, : number, etc.), and generic syntax (<T>). Write pure JavaScript/JSX only.
4. Dynamic Tailwind Class Interpolation (CRITICAL):
   - NEVER interpolate variables inside Tailwind class brackets like bg-[\${color}] or text-[\${size}]. Tailwind's JIT compiler cannot generate classes from variable interpolation.
   - Instead, convert them to inline style properties: style={{ backgroundColor: color }} or style={{ color: size }}.
5. JSX in Data Arrays/Objects:
   - NEVER put JSX elements (like <img ... />, <Lucide.Home />) directly inside object/array properties.
   - Instead, store the icon or image URL as a string (e.g. iconName: "Home", imageUrl: "...") and render the JSX element inside the component rendering logic.
6. Truncation & syntax checks:
   - Verify all tags (<div className="...">...</div>) are correctly opened and closed.
   - Verify curly braces { ... }, brackets [ ... ], and parentheses ( ... ) are properly balanced.
   - Remove any illegal/extra characters at the end of the file.
7. Component Structure & React Rules:
   - The main React component MUST be named "App".
   - You can define sub-components or helper functions outside of App, but the default/root mount element must be "App".
   - Hook rules: Never call hooks conditionally or inside nested functions/loops.
   - All state variables referenced in the JSX must be defined.
8. Missing imports or symbols:
   - Ensure all state variables, hooks, functions, or assets referenced are properly declared.
   - If you use useState, useEffect, useMemo, etc., verify they are either imported or correctly referenced.
   - PRE-IMPORTED GLOBALS (do NOT add import statements for these — they are already in scope):
     * React hooks: useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, useLayoutEffect, createContext, Fragment, forwardRef, memo
     * Lucide: all icons available as Lucide.IconName or const { IconName } = Lucide
     * Recharts: all components available as const { LineChart, ... } = Recharts
     * Framer Motion: motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring, useScroll, useInView
   - These DO need explicit import statements (they resolve via import map): @radix-ui/*, clsx, tailwind-merge, three, @react-three/fiber, @react-three/drei
   - REMOVE any import statement for: react, react-dom, lucide-react, recharts, framer-motion, motion/react
9. Stray tags and formatting:
   - Do NOT output stray word prefixes like "tsx" or "typescript" on the first line.
   - Do NOT wrap code in markdown block wrappers.
10. Style Object Ternary Syntax Error (CRITICAL — common AI generation bug):
   - WRONG: 'backgroundColor=== "share" ? "#C4A882" : "transparent"' — SyntaxError. A CSS property name cannot be directly followed by ===.
   - The AI forgot to write the state variable before ===. Correct pattern: 'backgroundColor: activeTab === "share" ? "#C4A882" : "transparent"'
   - When you see ANY CSS camelCase property name (backgroundColor, color, fontSize, transform, opacity, borderRadius, boxShadow, etc.) directly followed by === with no space before it, it is a bug. Fix by examining nearby useState() calls to find the right state variable, then write: propName: stateVar === condition ? trueVal : falseVal. If no state variable is obvious, just use the false/default value: propName: falseVal.
   - This same bug can appear as: 'color=== "active" ? "#fff" : "#000"', 'transform=== goal.id ? "translateY(-4px)" : "none"', etc. Fix them ALL.
11. Undefined Shorthand Properties in Arrays/Objects (CRITICAL — runtime ReferenceError):
   - WRONG: 'const slides = [{image, title: "Slide 1", desc: "text"}]' where image is NEVER declared anywhere in the file. At runtime the shorthand expands to {image: image} but image is undefined — ReferenceError.
   - Fix: Replace any shorthand property whose variable is never declared with a real value. For image-type properties use one of the ALLOWED IMAGE URLs: image: "https://...". For other undefined shorthands, use an empty string or sensible literal.
   - Check ALL shorthand properties in object/array literals and verify the variable they reference is declared via const/let/var or as a function parameter.
12. Relative/Non-URL Image Paths (broken in iframe sandbox):
   - WRONG: 'image: "assets/variants/photo.jpg"' or 'src="images/hero.png"' — relative paths do not resolve in the iframe.
   - ALL image src values and image: properties MUST be full absolute URLs starting with https://.
   - Replace every relative path (starting with assets/, images/, ../, ./, or any path without http) with one of the ALLOWED IMAGE URLs from the list provided above.

Output ONLY the modified, 100% working React component code. Do NOT wrap it in HTML tags. Do NOT wrap it in markdown code blocks (such as \`\`\`jsx or \`\`\`javascript). Just return the raw React component code.`;

    const userPrompt = `DESIGN BRIEF: ${JSON.stringify(designBrief?.intent || {})}
COLORS: ${JSON.stringify(designBrief?.colors || {})}
FONTS: ${JSON.stringify(designBrief?.fonts || {})}

INPUT REACT CODE TO FIX:
${code}`;

    try {
      console.log(`  [Verify & Fix] Calling fixer agent (Attempt ${attempts})...`);
      const fixedCode = await callDeepSeek(systemPrompt, userPrompt, 10000);
      const cleaned = extractReactCode(fixedCode);
      if (cleaned.length > 50) {
        code = sanitizeReactCode(cleaned);
      }
    } catch (err) {
      console.warn(`[Warning] [Verify & Fix] Fixer agent call failed:`, err.message);
      break;
    }
  }

  const finalCheck = compileCheck(code);
  if (!finalCheck.success) {
    const finalError = new Error(
      `Final React validation failed: ${finalCheck.error}`
    );
    finalError.code = 'GENERATED_CODE_INVALID';
    finalError.compilerError = finalCheck.error;
    throw finalError;
  }

  return code;
}

// ── Validate & Clean React Code and Wrap in dynamic Babel HTML Shell ─────────────────────────────────────────────
function cleanHTML(raw, designBrief = {}) {
  const reactCode = String(raw || '').trim();
  
  const fontHeading = designBrief.fonts?.heading || 'Inter';
  const fontBody = designBrief.fonts?.body || 'Inter';
  
  const colors = designBrief.colors || {
    background: '#0A0A0F',
    surface: '#1A1A24',
    border: 'rgba(255,255,255,0.08)',
    textPrimary: '#F5F5F7',
    textSecondary: 'rgba(255,255,255,0.6)',
    accent: '#6C5CE7',
    accentSecondary: '#A855F7',
    success: '#22C55E',
    warning: '#F59E0B',
    error: '#EF4444'
  };

  // BUG FIX #5: Robust isDark detection with multiple fallbacks
  const isDark = designBrief.intent?.theme === 'dark' 
    || designBrief.theme === 'dark'
    || (colors.background && /^#[0-3][0-9a-fA-F]{5}$/.test(colors.background));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>React Agentic UI Preview</title>
  
  <!-- BUG FIX #6: Global error listener with VISIBLE error overlay -->
  <script>
    window.onerror = function(message, source, lineno, colno, error) {
      console.error("Iframe error:", message, "at line", lineno, ":", colno);
      try { window.parent.postMessage({ type: 'iframe-render-error', error: String(message) }, '*'); } catch(e) {}
      var root = document.getElementById('root');
      if (root && (!root.innerHTML || root.innerHTML.trim() === '')) {
        root.innerHTML = '<div style="padding:24px;color:#F87171;font-family:monospace;background:#0F1117;min-height:100vh;">' +
          '<div style="max-width:400px;margin:40px auto;text-align:center;">' +
          '<div style="font-size:48px;margin-bottom:16px;">[Warning] </div>' +
          '<h3 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#F5F5F7;">Component Error</h3>' +
          '<p style="font-size:13px;color:#9CA3AF;margin-bottom:16px;">The generated component could not be compiled.</p>' +
          '<pre style="text-align:left;font-size:11px;background:#1A1A2E;padding:12px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;color:#F87171;border:1px solid #2A2A3E;">' +
          message + '</pre>' +
          '</div></div>';
      }
      return false;
    };
    window.addEventListener('unhandledrejection', function(event) {
      var reason =
        event.reason && event.reason.message
          ? event.reason.message
          : String(event.reason || 'Unhandled promise rejection');

      console.error('Iframe unhandled rejection:', reason);

      try {
        window.parent.postMessage({
          type: 'iframe-render-error',
          error: reason
        }, '*');
      } catch (e) {}
    });
  </script>
  
  <!-- Import map for React, ReactDOM client, Lucide Icons, Recharts, Framer Motion, Radix UI primitives, and utility helpers -->
  <script type="importmap">
    {
      "imports": {
        "react": "https://esm.sh/react@18.2.0",
        "react/jsx-runtime": "https://esm.sh/react@18.2.0/jsx-runtime",
        "react/jsx-dev-runtime": "https://esm.sh/react@18.2.0/jsx-dev-runtime",
        "react-dom": "https://esm.sh/react-dom@18.2.0",
        "react-dom/client": "https://esm.sh/react-dom@18.2.0/client",
        "lucide-react": "https://esm.sh/lucide-react@0.300.0?external=react,react-dom",
        "recharts": "https://esm.sh/recharts@2.10.3?external=react,react-dom",
        "framer-motion": "https://esm.sh/framer-motion@11.11.17?external=react,react-dom",
        "motion/react": "https://esm.sh/motion@11.11.17/react",
        "three": "https://esm.sh/three@0.158.0",
        "@react-three/fiber": "https://esm.sh/@react-three/fiber@8.15.11?external=react,react-dom,three",
        "@react-three/drei": "https://esm.sh/@react-three/drei@9.88.16?external=react,react-dom,three,@react-three/fiber",
        "clsx": "https://esm.sh/clsx@2.0.0",
        "tailwind-merge": "https://esm.sh/tailwind-merge@2.0.0",
        "@radix-ui/react-dialog": "https://esm.sh/@radix-ui/react-dialog@1.0.5?external=react,react-dom",
        "@radix-ui/react-dropdown-menu": "https://esm.sh/@radix-ui/react-dropdown-menu@2.0.6?external=react,react-dom",
        "@radix-ui/react-accordion": "https://esm.sh/@radix-ui/react-accordion@1.1.2?external=react,react-dom",
        "@radix-ui/react-tabs": "https://esm.sh/@radix-ui/react-tabs@1.0.4?external=react,react-dom",
        "@radix-ui/react-popover": "https://esm.sh/@radix-ui/react-popover@1.0.7?external=react,react-dom",
        "@radix-ui/react-slider": "https://esm.sh/@radix-ui/react-slider@1.1.2?external=react,react-dom",
        "@radix-ui/react-select": "https://esm.sh/@radix-ui/react-select@2.0.0?external=react,react-dom",
        "@radix-ui/react-tooltip": "https://esm.sh/@radix-ui/react-tooltip@1.0.7?external=react,react-dom",
        "@radix-ui/react-hover-card": "https://esm.sh/@radix-ui/react-hover-card@1.0.7?external=react,react-dom",
        "@radix-ui/react-avatar": "https://esm.sh/@radix-ui/react-avatar@1.0.4?external=react,react-dom",
        "@radix-ui/": "https://esm.sh/@radix-ui/?external=react,react-dom"
      }
    }
  </script>
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  
  <!-- Babel Standalone for dynamic compilation -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js"></script>
  
  <!-- Custom Fonts from Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontHeading)}:wght@300;400;500;600;700${fontHeading !== fontBody ? `&family=${encodeURIComponent(fontBody)}:wght@300;400;500;600;700` : ''}&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --screen-bg: ${colors.background};
      --card-bg: ${colors.surface};
      --border-color: ${colors.border};
      --text-primary: ${colors.textPrimary};
      --text-secondary: ${colors.textSecondary};
      --accent-color: ${colors.accent};
      --accent-secondary: ${colors.accentSecondary || colors.accent};
      --color-success: ${colors.success};
      --color-warning: ${colors.warning};
      --color-error: ${colors.error};
    }
    
    * {
      box-sizing: border-box;
      scrollbar-width: none;
    }
    ::-webkit-scrollbar {
      display: none;
    }
    
    body {
      margin: 0;
      padding: 0;
      background-color: var(--screen-bg);
      color: var(--text-primary);
      font-family: '${fontBody}', sans-serif;
      width: 100vw;
      height: 100vh;
      overflow-x: hidden;
      overflow-y: auto;
    }
    
    .glass-effect {
      backdrop-filter: blur(20px) saturate(180%);
      background: ${isDark ? 'rgba(0, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.7)'};
      border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'};
    }
    
    .noise-gradient-bg {
      position: relative;
      overflow: hidden;
      background: radial-gradient(circle at 50% -20%, ${colors.accent}33 0%, var(--screen-bg) 60%), var(--screen-bg);
    }
    
    .noise-gradient-bg::after {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
      opacity: 0.03;
      mix-blend-mode: overlay;
      pointer-events: none;
      z-index: 1;
    }
    
    /* ── Color tint utilities (accent/surface at various opacities) ── */
    .bg-accent-5  { background-color: ${colors.accent}0D; }
    .bg-accent-10 { background-color: ${colors.accent}1A; }
    .bg-accent-15 { background-color: ${colors.accent}26; }
    .bg-accent-20 { background-color: ${colors.accent}33; }
    .bg-accent-30 { background-color: ${colors.accent}4D; }
    .bg-surface-5  { background-color: ${colors.surface}0D; }
    .bg-surface-10 { background-color: ${colors.surface}1A; }
    .text-accent { color: ${colors.accent}; }
    .border-accent { border-color: ${colors.accent}; }
    .border-accent-30 { border-color: ${colors.accent}4D; }
    .ring-accent { --tw-ring-color: ${colors.accent}; }

    /* ── Signature design detail: subtle left-accent border on cards ── */
    .card-accented {
      border-left: 3px solid ${colors.accent};
    }

    /* ── Hero gradient mesh (applied to first section automatically) ── */
    .hero-mesh-bg {
      background:
        radial-gradient(ellipse 70% 50% at 20% 0%, ${colors.accent}22 0%, transparent 60%),
        radial-gradient(ellipse 50% 40% at 80% 10%, ${colors.accentSecondary || colors.accent}18 0%, transparent 50%),
        ${colors.background};
    }

    /* ── Section entrance animations ── */
    .animate-enter {
      opacity: 0;
      transform: translateY(18px);
      transition: opacity 0.45s ease, transform 0.45s ease;
    }
    .animate-enter.visible {
      opacity: 1;
      transform: translateY(0);
    }

    /* Smooth transitions and hover animations */
    .hover-trigger {
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .hover-trigger:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px -10px ${colors.accent}44;
    }

    /* Radix Accordion Animations (shadcn style) */
    @keyframes slideDown {
      from { height: 0; }
      to { height: var(--radix-accordion-content-height); }
    }
    @keyframes slideUp {
      from { height: var(--radix-accordion-content-height); }
      to { height: 0; }
    }
    .animate-slideDown {
      animation: slideDown 200ms cubic-bezier(0.87, 0, 0.13, 1);
    }
    .animate-slideUp {
      animation: slideUp 200ms cubic-bezier(0.87, 0, 0.13, 1);
    }
  </style>
</head>
<body>
  <div id="root"></div>

  <!-- Dynamic React Mounting Script -->
  <script type="text/babel" data-presets="react,typescript" data-type="module">
    import React, { 
      useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, useLayoutEffect, 
      useTransition, useDeferredValue, useId, useImperativeHandle, useDebugValue, 
      createContext, Fragment, Component, PureComponent, forwardRef, memo, lazy, Suspense 
    } from 'react';
    import ReactDOM from 'react-dom/client';
    import * as Lucide from 'lucide-react';
    import * as Recharts from 'recharts';
    import { motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring, useScroll, useInView } from 'framer-motion';

    // LLM Generated Component Code:
    ${reactCode}

    // Dynamic Mount Execution
    try {
      const rootElement = document.getElementById('root');
      const root = ReactDOM.createRoot(rootElement);
      
      // Fallback detection if LLM uses standard component names
      const ComponentToRender = (typeof App !== 'undefined') ? App : 
                                (typeof GeneratedScreen !== 'undefined') ? GeneratedScreen : 
                                (typeof Dashboard !== 'undefined') ? Dashboard : 
                                (typeof UI !== 'undefined') ? UI : 
                                (typeof Screen !== 'undefined') ? Screen :
                                (typeof Main !== 'undefined') ? Main :
                                null;
                                
      if (ComponentToRender) {
        root.render(React.createElement(ComponentToRender));
      } else {
        root.render(
          <div className="flex flex-col items-center justify-center h-full p-6 text-center bg-[#0F1117] text-white">
            <Lucide.AlertCircle size={48} className="text-red-500 mb-4 animate-bounce" />
            <h3 className="text-lg font-bold">Mounting Error</h3>
            <p className="text-sm text-gray-400 mt-2 max-w-xs">
              We couldn't locate the main container component. Please make sure the main component is named 'App' or 'GeneratedScreen'.
            </p>
          </div>
        );
      }
    } catch (err) {
      console.error('Mounting failed:', err);
      try { window.parent.postMessage({ type: 'iframe-render-error', error: err.message }, '*'); } catch(e) {}
      document.getElementById('root').innerHTML =
        '<div style="padding:24px;color:#F87171;font-family:monospace;background:#0F1117;min-height:100vh;">' +
        '<div style="max-width:400px;margin:40px auto;text-align:center;">' +
        '<div style="font-size:48px;margin-bottom:16px;">[Warning] </div>' +
        '<h3 style="font-size:18px;font-weight:700;margin-bottom:8px;color:#F5F5F7;">Render Error</h3>' +
        '<p style="font-size:13px;color:#9CA3AF;margin-bottom:16px;">The component failed to mount.</p>' +
        '<pre style="text-align:left;font-size:11px;background:#1A1A2E;padding:12px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;color:#F87171;border:1px solid #2A2A3E;">' + 
        err.message + '</pre></div></div>';
    }
  </script>

  <!-- ── Visual Polish: Scroll entrance animations (runs after React mounts) ── -->
  <script>
    (function() {
      function runEntranceAnimations() {
        // Target top-level section and direct children of main/article
        var targets = document.querySelectorAll(
          'section, main > div > div, article > div, [data-section], .animate-enter'
        );
        if (!targets.length) return;
        targets.forEach(function(el, i) {
          // Skip elements already animated or very small ones (nav items, icons)
          if (el.getBoundingClientRect().height < 40) return;
          el.classList.add('animate-enter');
          var delay = Math.min(i * 65, 400); // cap at 400ms stagger
          setTimeout(function() { el.classList.add('visible'); }, delay + 80);
        });
      }

      // Run after React has had time to mount (100ms is enough for sync renders)
      setTimeout(runEntranceAnimations, 120);

      // Also wire up IntersectionObserver for elements that scroll into view
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('visible');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.12 });

        setTimeout(function() {
          document.querySelectorAll('.animate-enter:not(.visible)').forEach(function(el) {
            io.observe(el);
          });
        }, 200);
      }
    })();
  </script>
</body>
</html>`;
}

// ── Extract Clean React Code from Raw LLM Output ─────────────────────────────
// BUG FIX #4: Utility to get clean, copyable React component code
function extractReactCode(raw) {
  // Strip code fences
  let code = raw.replace(/```(javascript|jsx|react|html)?\n?/g, '').replace(/```\n?/g, '').trim();
  // Strip leading stray language tags
  code = code.replace(/^(tsx|typescript|jsx|javascript|html)\b\s*\n/i, '').trim();

  // Strip natural language preamble that LLMs often prepend before actual code
  // e.g. "Here's the corrected React component for your dark-themed social media feed..."
  const lines = code.split('\n');
  let codeStartIndex = 0;
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const trimmed = lines[i].trim();
    // A line is "code" if it starts with a JS/JSX keyword, comment, or JSX tag
    if (/^(function |const |let |var |import |export |\/\/|\/\*|\*|React\.|window\.|document\.|class |return |if |for |while |switch |try |throw |async |await |<[A-Z]|<div|<span|<p |<section|<header|<main|<footer|<nav|<ul|<ol|<li|<img|<a |<button|\(|{|\[)/.test(trimmed) || trimmed === '') {
      codeStartIndex = i;
      break;
    }
    // If this line looks like natural language (contains spaces, starts with a letter, has English words), skip it
    if (/^[A-Za-z]/.test(trimmed) && trimmed.includes(' ') && !trimmed.includes('=') && !trimmed.includes('{') && !trimmed.includes('(')) {
      codeStartIndex = i + 1;
    }
  }
  if (codeStartIndex > 0) {
    console.log(` [extractReactCode] Stripped ${codeStartIndex} line(s) of natural language preamble`);
    code = lines.slice(codeStartIndex).join('\n').trim();
  }

  // Repair any truncation
  code = repairTruncatedJSX(code);
  return code;
}

// Helper to scan a user-uploaded screenshot using the OpenAI Vision API (gpt-4o)
async function scanUploadedScreenshot(filePath, userPrompt = '') {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File does not exist: ${filePath}`);
  }

  const fileExt = path.extname(filePath).toLowerCase();
  let mimeType = 'image/png';
  if (fileExt === '.jpg' || fileExt === '.jpeg') mimeType = 'image/jpeg';
  else if (fileExt === '.webp') mimeType = 'image/webp';
  else if (fileExt === '.gif') mimeType = 'image/gif';

  const base64Image = fs.readFileSync(filePath).toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64Image}`;

  const systemPrompt = `You are an elite, pixel-perfect frontend UI engineer and senior design system architect.
Your task is to deep-scan this uploaded UI screen screenshot and perform a pixel-by-pixel analysis to extract its exact design DNA.

[CRITICAL SAFETY & COMPLIANCE]:
The provided image is a synthetic, computer-generated user interface design layout mockup. It does not contain any real people, real photos, real documents, real-world identity, or any PII (Personally Identifiable Information). It is a purely fictional graphic design template. You are fully permitted and required to analyze this design template.

[IMPORTANT COMPONENT TARGETING]:
- The user is uploading a screenshot of their entire workspace/browser window. Do NOT extract the color palette, background, or theme of the surrounding browser, canvas, or chat panel (which are typically light/white).
- Focus STRICTLY on the visual contents, colors, and layout of the ACTUAL target mobile phone or desktop web app mockup/screen rendered in the center of the image.
- If the target mobile screen contains black, dark grey, or near-black backgrounds, then the theme is "dark" and the background color is the dark color, even if 90% of the surrounding browser canvas in the image is white.

${userPrompt ? `[USER INSTRUCTION FOCUS]:
- The user's prompt/instruction is: "${userPrompt}"
- Pay extremely close attention to which specific part of the screenshot they want. For example, if they request "the 1st screen", "first screen", "second phone", "screen 1", etc., focus your analysis and color extraction PURELY on that specific phone screen or component from left to right.
` : ''}

[CRITICAL COLOR EXTRACTION ACCURACY]:
- Look extremely closely at the target screen's ACTUAL background hex color. Do NOT default to white (#FFFFFF) or standard light grey (#F5F5F5) if the screenshot has a warm grey, sand, cream, or beige background (e.g. #E2E1DD or #E3E2DE). Extract the EXACT hex.
- Look extremely closely at card containers: If the cards are high-contrast black or dark-grey (e.g. #181818, #000000) on a light background, you MUST extract the exact dark surface hex color for "surface" and NOT use white (#FFFFFF). 
- If the design uses light background with black cards, specify "background" as the light warm grey (e.g., #E2E1DD) and "surface" as the dark color (e.g., #181818). The generator depends on "surface" for its card backgrounds.
- If the mobile screen has a dark navigation bar pill (e.g. black pill at the bottom), mention it explicitly in "visualNotesForGenerator" so the generator builds a dark pill navigation bar.

Extract the following details with absolute precision:
1. Color Palette:
   - background: The exact primary background hex color of the screen.
   - surface: The exact surface/card container hex color.
   - border: The exact border/divider hex color.
   - textPrimary: The exact color of primary headings/text (e.g. #FFFFFF or #111111).
   - textSecondary: The exact color of secondary text/subheadings.
   - accent: The primary brand/accent hex color (e.g. CTA buttons, active states, active icons).
   - accentSecondary: Any supporting/gradient accent hex color.
   - success: Success indicators or positive trend colors.
   - warning: Warning indicators.
   - error: Destructive actions or negative trend colors.
   - theme: "dark" if the background is dark, "light" if the background is light.
2. Typography:
   - headingFont: The inferred font style family for headings/large titles (choose a clean, modern sans-serif like 'Inter', 'Geist', 'Plus Jakarta Sans', or 'Outfit' that matches the design aesthetic).
   - bodyFont: The inferred body font style.
3. Visual Component Styling:
   - borderRadius: The exact curved border-radius used for cards/containers (e.g., '12px', '16px', '24px' or Tailwind 'rounded-xl', 'rounded-2xl').
   - padding: Inferred spacing/padding inside cards and lists (e.g. '16px', '24px').
   - shadow: The style of box-shadow used (e.g., subtle, glow/neon, sharp, or none).
   - borderStyle: The border styling (e.g. '1px solid rgba(255,255,255,0.08)' or similar).
4. Layout & Structure DNA:
   - layoutPattern: Precise architectural structure of the layout (e.g. 'sidebar with top header', 'bottom tab navigation with card grid', 'full bleed hero section with horizontal list scrolling').
   - structuralSpec: A comprehensive, step-by-step hierarchical description of the layout's structural containers from top to bottom. Describe exact order, container shapes, width specifications (e.g. full-width cards, two columns side-by-side, 3-column actions button rows, vertical stacked lists, vertical bar chart card), relative margins/spacing, and relative ordering of elements. This will guide the generator to build an identical structure instead of falling back to default grids.
   - navigationType: The primary navigation pattern ('bottom-tab', 'sidebar', or 'top-tab').
   - activeTabStyle: Describe how active tabs are visually indicated (e.g., 'accent colored text with active dot', 'solid accent background pill', 'subtle underline').
5. Specific UI Components & Details:
   - uiComponents: A comprehensive list of specific UI elements seen in the screenshot (e.g., 'line chart', 'data table', 'avatar list', 'search bar', 'card containers', 'transaction list', 'stat cards').
   - designDetails: Deep aesthetic details observed (e.g. 'glassmorphism blur overlay', 'grainy noise gradient backgrounds', 'subtle vertical divider lines', 'monochrome clean icons').
6. Content & Context DNA:
   - language: The primary language of the text in the screenshot (e.g., 'English', 'Tamil', 'Spanish', 'French').
   - contentDomain: The specific topic/domain of the app based on the visible content (e.g., 'Astrology App', 'Government Schemes Portal', 'E-commerce', 'Crypto Dashboard').
7. System Prompt Instructions:
   - visualNotesForGenerator: Write a highly detailed, 3-4 sentence direct visual instruction for the HTML generator so it replicates this exact design language. Cite the colors, spacing, radius, card borders, language, content domain, and aesthetic tone from the screenshot.

Output ONLY valid JSON matching this structure:
{
  "palette": {
    "background": "#hex",
    "surface": "#hex",
    "border": "#hex",
    "textPrimary": "#hex",
    "textSecondary": "#hex",
    "accent": "#hex",
    "accentSecondary": "#hex",
    "success": "#hex",
    "warning": "#hex",
    "error": "#hex",
    "theme": "dark" | "light"
  },
  "typography": {
    "headingFont": "string",
    "bodyFont": "string"
  },
  "styling": {
    "borderRadius": "string",
    "padding": "string",
    "shadow": "string",
    "borderStyle": "string"
  },
  "layout": {
    "layoutPattern": "string",
    "structuralSpec": "string",
    "navigationType": "string",
    "activeTabStyle": "string"
  },
  "content": {
    "language": "string",
    "contentDomain": "string"
  },
  "uiComponents": ["string"],
  "designDetails": ["string"],
  "visualNotesForGenerator": "string"
}`;

  const contentParts = [
    { type: 'text', text: 'Analyze this UI screen screenshot and output the design system DNA in valid JSON format.' },
    { type: 'image_url', image_url: { url: dataUrl } }
  ];

  console.log(`DeepSeek Vision: Analyzing UI screenshot reference: ${filePath}`);
  const result = await callVisionAPI(systemPrompt, contentParts, 1500);
  
  let data;
  try {
    const cleaned = result.replace(/```json/g, '').replace(/```/g, '').trim();
    data = JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse Vision scan JSON response:', result);
    throw new Error('Vision scan response was not valid JSON');
  }
  return data;
}

// Helper to apply visual screenshot design system overrides
async function applyVisualScanOverrides(uploadedImagePath, intent, colors, fonts, analysis, consistencySpec, preScannedDesign = null, requirementsLedger = null) {
  if (!uploadedImagePath && !preScannedDesign) return { colors, fonts, consistencySpec };
  
  try {
    console.log(` Visual Scan: applying overrides...`);
    const design = preScannedDesign || await scanUploadedScreenshot(uploadedImagePath, intent?.searchQuery);
    console.log(' Visual Scan success:', JSON.stringify(design, null, 2));
    
    // Explicit theme/accent checks in requirementsLedger (Priority 1: Explicit user requirements)
    const explicitAccent = requirementsLedger?.visualRequirements?.accent;
    const explicitTheme = requirementsLedger?.visualRequirements?.theme;
    
    if (explicitAccent || (explicitTheme && explicitTheme !== 'auto')) {
      console.log(' Skipping visual scan palette override because explicit colors/theme are requested in prompt');
    } else if (design.palette) {
      colors = {
        background: design.palette.background,
        surface: design.palette.surface,
        border: design.palette.border || (design.palette.theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
        textPrimary: design.palette.textPrimary,
        textSecondary: design.palette.textSecondary,
        accent: design.palette.accent,
        accentSecondary: design.palette.accentSecondary || design.palette.accent,
        success: design.palette.success || '#22C55E',
        warning: design.palette.warning || '#F59E0B',
        error: design.palette.error || '#EF4444'
      };
      intent.theme = design.palette.theme || intent.theme;
    }
    
    // Explicit font checks in requirementsLedger (Priority 1: Explicit user requirements)
    const explicitFont = requirementsLedger?.visualRequirements?.style?.find(s => s.toLowerCase().includes('font') || s.toLowerCase().includes('sans') || s.toLowerCase().includes('serif'));
    if (explicitFont) {
      console.log(' Skipping visual scan font override because explicit typography is requested in prompt');
    } else if (design.typography) {
      fonts = {
        heading: design.typography.headingFont || fonts.heading,
        body: design.typography.bodyFont || fonts.body
      };
    }
    
    if (design.styling) {
      if (!analysis.visualNotes) analysis.visualNotes = '';
      analysis.visualNotes += `
[MANDATORY REPLICATION OF SCANNED UI SCREEN]:
- Card radius / border-radius: ${design.styling.borderRadius}
- Container padding: ${design.styling.padding}
- Border style: ${design.styling.borderStyle}
- Inferred box-shadow style: ${design.styling.shadow}
- Layout architecture pattern: ${design.layout?.layoutPattern}
- Detailed structural spec layout to replicate EXACTLY (from top to bottom): ${design.layout?.structuralSpec || ''}
- Specific design detail features to include: ${(design.designDetails || []).join(', ')}
- Text Language to use: ${design.content?.language || 'English'}
- Context / Content Domain: ${design.content?.contentDomain || 'Generic Application'}
- Visual scanner directives: ${design.visualNotesForGenerator}`;
      
      // Inject consistency parameters
      if (!consistencySpec) {
        consistencySpec = {
          appName: "Consistent UI",
          navigation: {
            tabs: design.layout?.navigationType === 'bottom-tab' ? ["Home", "Analytics", "Settings"] : ["Dashboard"]
          },
          cardRadius: design.styling.borderRadius || "12px",
          borderStyle: design.styling.borderStyle || "1px solid rgba(0,0,0,0.08)"
        };
      } else {
        consistencySpec.cardRadius = design.styling.borderRadius || consistencySpec.cardRadius;
        consistencySpec.borderStyle = design.styling.borderStyle || consistencySpec.borderStyle;
      }
    }
    
  } catch (err) {
    console.warn('[Warning] Visual Scan overrides failed:', err.message);
  }
  
  return { colors, fonts, consistencySpec };
}

// ══════════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════════

// POST /api/agentic-ui/generate
// GET /api/agentic-ui/quota — Return user's remaining agentic UI generations
router.get('/quota', (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    const quota = getAgenticQuota(user);
    res.json({
      used: quota.used,
      limit: quota.isUnlimited ? 'Unlimited' : quota.limit,
      remaining: quota.isUnlimited ? 'Unlimited' : quota.remaining,
      isUnlimited: quota.isUnlimited,
      plan: user.role
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get quota' });
  }
});

function selectDeepSeekModel(prompt, designChoices, useReasoner) {
  if (useReasoner === true) return 'deepseek-reasoner';
  if (useReasoner === false) return 'deepseek-chat';

  const promptLower = ((prompt || '') + ' ' + (designChoices?.designStyle || '')).toLowerCase();
  if (
    promptLower.includes('think') ||
    promptLower.includes('reason') ||
    promptLower.includes('pro') ||
    promptLower.includes('r1') ||
    promptLower.includes('cot') ||
    promptLower.includes('thinking')
  ) {
    return 'deepseek-reasoner';
  }
  return 'deepseek-chat';
}

router.post('/generate', async (req, res) => {
  req.socket.setTimeout(600000);
  const modelToUse = selectDeepSeekModel(req.body.prompt, req.body.designChoices, req.body.useReasoner);
  return modelStorage.run(modelToUse, async () => {
    try {
      const { prompt, platform, theme, isFollowUp, previousContext, designChoices, uploadedImagePath, preScannedDesign: cachedScanFromClient, visualAssetMode, requestId, generationOutputMode } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    const safetyCheck = checkPromptSafety(prompt);
    if (!safetyCheck.isSafe) {
      console.warn(`Prompt safety violation! Term: "${safetyCheck.triggerTerm}", Prompt: "${prompt}"`);
      return res.status(400).json({
        error: 'safety_violation',
        message: 'InspoAI safety guidelines prohibit generating explicit, adult, or inappropriate user interfaces. Please modify your prompt and try again.'
      });
    }

    if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DeepSeek API key not configured' });

    const user = req.user;
    if (user) {
      const quota = getAgenticQuota(user);
      if (!quota.isUnlimited && quota.remaining <= 0) {
        const msg = quota.isTrialExpired 
          ? "Your 7-day free trial has expired. Please upgrade your plan to continue generating screens."
          : `You have used all ${quota.limit} AgenticUI generations on your ${user.role} plan. Upgrade to generate more.`;
        return res.status(402).json({
          error: 'generation_limit_reached',
          message: msg,
          quota
        });
      }
    }
    let clarificationData = null;
    let completedScreens = [];
    let completionMeta = null;
    let finalColors = null;
    let finalFonts = null;
    let finalReferences = null;
    let finalScanWarning = null;

    await runV3Pipeline({
      prompt, platform, theme, isFollowUp, previousContext, designChoices, uploadedImagePath, cachedScanFromClient, visualAssetModeInput: visualAssetMode, requestId, generationOutputMode
    }, {
      sendStatus: (step) => {},
      sendClarification: (question, intent, scan, warning) => {
        clarificationData = {
          status: 'clarification_needed',
          question,
          intent,
          preScannedDesign: scan,
          scanWarning: warning
        };
      },
      sendScreenStart: (index, title) => {},
      sendScreenComplete: (index, html, reactCode) => {
        completedScreens.push({ index, html, reactCode, title: `Screen ${index + 1}` });
      },
      sendComplete: (meta, screens, colors, fonts, references, scanWarning) => {
        completionMeta = meta;
        finalColors = colors;
        finalFonts = fonts;
        finalReferences = references;
        finalScanWarning = scanWarning;
      },
      sendError: (errInfo) => {
        const msg = typeof errInfo === 'object' ? errInfo.message : errInfo;
        throw new Error(msg);
      }
    });

    if (clarificationData) {
      return res.json(clarificationData);
    }

    if (req.user && completionMeta?.successfulScreenCount > 0) {
      deductAgenticCredit(req.user).catch(e => console.warn('Credit deduction failed:', e.message));
    }

    res.json({
      status: 'success',
      html: completedScreens[0]?.html || '',
      screens: completedScreens,
      designBrief: { fonts: finalFonts, colors: finalColors, device: platform, theme },
      references: (finalReferences || []).slice(0, 5).map(r => ({
        name: r.site_name || r.title,
        thumbnail: r.thumbnail || r.src
      })),
      meta: {
        duration: completionMeta?.duration,
        screenCount: completedScreens.length,
        qaScore: completionMeta?.qaScore,
        visualAssetMode: completionMeta?.visualAssetMode
      },
      scanWarning: finalScanWarning || undefined
    });

    } catch (err) {
      console.error('[Error] Agentic UI error:', err);
      res.status(500).json({ error: err.message || 'Generation failed' });
    }
  });
});

// GET /api/agentic-ui-test/dna — Design DNA catalog for the style picker UI
router.get('/dna', (req, res) => {
  res.json({
    status: 'success',
    dna: DESIGN_DNA.map(d => ({
      id: d.id,
      name: d.name,
      theme: d.theme,
      bestFor: d.bestFor,
      tokens: d.tokens,
      fonts: { display: d.fonts.display, body: d.fonts.body }
    }))
  });
});

// POST /api/agentic-ui-test/retheme — instant global restyle, zero LLM calls
router.post('/retheme', (req, res) => {
  try {
    const { screens, overrides } = req.body;
    if (!Array.isArray(screens) || !screens.length) {
      return res.status(400).json({ error: 'screens array is required' });
    }
    if (!overrides || typeof overrides !== 'object') {
      return res.status(400).json({ error: 'overrides object is required (dnaId, palette, headingFont, bodyFont, iconSet)' });
    }
    const started = Date.now();
    const result = rethemeScreens(screens, overrides);
    const rethemedCount = result.filter(s => s.rethemed).length;
    console.log(`[v3] Retheme: ${rethemedCount}/${screens.length} screens in ${Date.now() - started}ms`);
    res.json({ status: 'success', screens: result, rethemedCount, durationMs: Date.now() - started });
  } catch (err) {
    console.error('[Error] Retheme error:', err);
    res.status(500).json({ error: err.message || 'Retheme failed' });
  }
});

// POST /api/agentic-ui-test/suggest-palette
router.post('/suggest-palette', async (req, res) => {
  try {
    const { prompt, platform, theme, selectedSkill, visualAssetMode } = req.body;
    if (!prompt) return res.status(400).json({ error: 'prompt is required' });
    
    console.log(`[Suggest Palette] Thinking palette for: "${prompt.slice(0, 50)}..."`);
    const resolvedTheme = theme || 'dark';
    const palette = await brainGeneratePalette({
      prompt,
      platform: platform || 'ios',
      theme: resolvedTheme,
      selectedSkill: selectedSkill || null,
      visualAssetMode: visualAssetMode || 'mixed'
    });
    
    res.json({
      status: 'success',
      palette: {
        ...palette,
        source: 'ai'
      }
    });
  } catch (err) {
    console.warn('[Warning] [Suggest Palette] Failed, falling back to presets:', err.message);
    const fallback = (req.body.theme === 'light') ? {
      name: 'Light Minimal',
      theme: 'light',
      background: '#FAFAFA',
      surface: '#FFFFFF',
      primary: '#3B82F6',
      accent: '#3B82F6',
      accent2: '#10B981',
      supporting: '#F59E0B',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      border: 'rgba(0,0,0,0.06)',
      source: 'ai'
    } : {
      name: 'Dark Slate',
      theme: 'dark',
      background: '#090A0F',
      surface: '#12131C',
      primary: '#6C5CE7',
      accent: '#6C5CE7',
      accent2: '#00D2FF',
      supporting: '#A855F7',
      textPrimary: '#F5F5F7',
      textSecondary: '#8B8D97',
      border: 'rgba(255,255,255,0.08)',
      source: 'ai'
    };
    res.json({
      status: 'success',
      palette: fallback
    });
  }
});

// POST /api/agentic-ui/generate-stream — SSE streaming for multi-screen
router.post('/generate-stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (typeof res.flush === 'function') res.flush();
  };

  const modelToUse = selectDeepSeekModel(req.body.prompt, req.body.designChoices, req.body.useReasoner);
  return modelStorage.run(modelToUse, async () => {
    try {
    const user = req.user;
    if (user) {
      const quota = getAgenticQuota(user);
      if (!quota.isUnlimited && quota.remaining <= 0) {
        const msg = quota.isTrialExpired 
          ? "Your 7-day free trial has expired. Please upgrade your plan to continue generating screens."
          : `You have used all ${quota.limit} AgenticUI generations on your ${user.role} plan. Upgrade to generate more.`;
        sendEvent({
          event: 'error',
          code: 'generation_limit_reached',
          message: msg,
          quota
        });
        res.end();
        return;
      }
    }

    const { prompt, platform, theme, isFollowUp, previousContext, designChoices, uploadedImagePath, preScannedDesign, visualAssetMode, requestId, generationOutputMode } = req.body;
    
    const safetyCheck = checkPromptSafety(prompt);
    if (!safetyCheck.isSafe) {
      sendEvent({
        event: 'error',
        code: 'safety_violation',
        message: 'InspoAI safety guidelines prohibit generating explicit, adult, or inappropriate user interfaces. Please modify your prompt and try again.'
      });
      res.end();
      return;
    }

    await runV3Pipeline({
      prompt, platform, theme, isFollowUp, previousContext, designChoices, uploadedImagePath, cachedScanFromClient: preScannedDesign, visualAssetModeInput: visualAssetMode, requestId, generationOutputMode
    }, {
      sendStatus: (step) => {
        sendEvent({ event: 'status', step });
      },
      sendClarification: (question, intent, scan, warning) => {
        sendEvent({ event: 'clarification', question, intent, preScannedDesign: scan, scanWarning: warning });
        res.end();
      },
      sendScreenStart: (index, title) => {
        sendEvent({ event: 'screen_start', index, title });
      },
      sendScreenPartial: (index, html, title) => {
        sendEvent({ event: 'screen_partial', index, html, title });
      },
      sendScreenComplete: (index, html, reactCode, title) => {
        const screen = { index, html, reactCode, title };
        if (!isValidGeneratedScreen(screen)) {
          sendEvent({
            event: 'screen_error',
            index: index ?? 0,
            message: 'The generated screen did not contain valid HTML.'
          });
        } else {
          sendEvent({
            event: 'screen_done',
            index: screen.index,
            title: screen.title,
            html: screen.html,
            reactCode: screen.reactCode || null
          });
        }
      },
      sendComplete: (meta, screens, colors, fonts, references, scanWarning) => {
        const validScreens = normalizeGeneratedScreens(screens);
        if (validScreens.length === 0) {
          sendEvent({
            event: 'error',
            code: 'no_valid_screens',
            message: 'No valid screens could be generated. Please try again.'
          });
          res.end();
          return;
        }

        if (req.user && validScreens.length > 0) {
          deductAgenticCredit(req.user).catch(e => console.warn('Credit deduction failed:', e.message));
        }
        sendEvent({
          event: 'complete',
          duration: (meta.duration || 0) * 1000,
          requestedScreenCount: meta.requestedScreenCount,
          successfulScreenCount: validScreens.length,
          failedScreenCount: Math.max(meta.requestedScreenCount - validScreens.length, 0),
          screenCount: validScreens.length,
          productName: meta.productName,
          creativeConcept: meta.creativeConcept,
          visualAssetMode: meta.visualAssetMode,
          paletteName: meta.paletteName,
          selectedSkillName: meta.selectedSkillName,
          sharedComponentsGenerated: meta.sharedComponentsGenerated,
          illustrationsGenerated: meta.illustrationsGenerated,
          qaScore: meta.qaScore,
          designBrief: {
            fonts, colors, device: platform, theme,
            // v3 session design memory — lets add-screen/iterate stay on-system
            engine: meta.engine || undefined,
            dnaId: meta.dnaId || undefined,
            appChrome: meta.appChrome || undefined,
            productName: meta.productName || undefined,
            creativeConcept: meta.creativeConcept || undefined
          },
          references: references.slice(0, 5).map(r => ({ name: r.site_name || r.title, thumbnail: r.thumbnail || r.src })),
          scanWarning
        });
        res.end();
      },
      sendError: (errInfo) => {
        const message = typeof errInfo === 'object' ? errInfo.message : errInfo;
        const stage = typeof errInfo === 'object' ? errInfo.stage : 'unknown';
        sendEvent({
          event: 'error',
          code: 'generation_failed',
          stage,
          message: message || 'Generation failed unexpectedly.'
        });
        res.end();
      }
    });

  } catch (err) {
    console.error('Agentic UI stream generation failed:', {
      message: err.message,
      stack: err.stack
    });
    sendEvent({
      event: 'error',
      code: 'generation_failed',
      stage: 'initializing',
      message: err.message || 'Generation failed unexpectedly.'
    });
    res.end();
  }
  });
});

// POST /api/agentic-ui/iterate — Modify existing HTML
router.post('/iterate', async (req, res) => {
  req.socket.setTimeout(600000);
  const modelToUse = selectDeepSeekModel(req.body.instruction, req.body.designBrief, req.body.useReasoner);
  return modelStorage.run(modelToUse, async () => {
    try {
      const { currentHTML, instruction, designBrief } = req.body;
      if (!currentHTML || !instruction) return res.status(400).json({ error: 'currentHTML and instruction required' });

      // ── Content Moderation and Safety Filter ──
      const safetyCheck = checkPromptSafety(instruction);
      if (!safetyCheck.isSafe) {
        console.warn(`Prompt safety violation in iterate! Term: "${safetyCheck.triggerTerm}", Prompt: "${instruction}"`);
        return res.status(400).json({
          error: 'safety_violation',
          message: 'InspoAI safety guidelines prohibit generating explicit, adult, or inappropriate user interfaces. Please modify your prompt and try again.'
        });
      }

      // ── Credit check ──
      const user = req.user;
      if (user) {
        const quota = getAgenticQuota(user);
        if (!quota.isUnlimited && quota.remaining <= 0) {
          const msg = quota.isTrialExpired 
            ? "Your 7-day free trial has expired. Please upgrade your plan to continue generating screens."
            : `You have used all ${quota.limit} AgenticUI generations on your ${user.role} plan. Upgrade to generate more.`;
          return res.status(402).json({
            error: 'generation_limit_reached',
            message: msg,
            quota
          });
        }
      }

      // ── v3 documents get the patch-based HTML iterate path ──
      const v3Result = await iterateV3({ currentHTML, instruction }).catch(err => {
        console.warn('[Warning] [v3] iterate failed, falling back to legacy path:', err.message);
        return null;
      });
      if (v3Result) {
        return res.json({ status: 'success', html: v3Result.html, reactCode: null });
      }

      // Extract JSX code from currentHTML if it's wrapped in the Babel shell
      const match = currentHTML.match(/\/\/ LLM Generated Component Code:\s*([\s\S]*?)\s*\/\/ Dynamic Mount Execution/);
      const currentReactCode = match ? match[1].trim() : currentHTML;

      const theme = designBrief?.intent?.theme || (currentHTML.includes('dark') ? 'dark' : 'light');
      const systemPrompt = `You are an elite React developer and UI designer. The user has an existing React + Tailwind CSS component and wants modifications.
Apply the user's instruction to the React JSX code. Output ONLY the modified complete React component code, no markdown wrappers, no explanations.

CRITICAL RULES:
1. Output ONLY the React component code. Do NOT include HTML wrappers, body tags, doctype, or CDN scripts.
2. The main component MUST be named "App" and exported as the default:
   export default function App() { ... }
3. You can import standard icons from 'lucide-react' at the top:
   import * as Lucide from 'lucide-react';
4. You can import Recharts components if you need interactive charts:
   import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
5. Use Tailwind CSS classes for all styling (use 'className="..."' instead of 'class="..."').
6. Use React state (useState, useEffect) to add rich interactivity: active tab states, sidebar collapse/expand, modal toggles, hovered items, transaction filters, etc.
7. Keep the same structure, fonts, colors, and layout unless the user specifically asks to change them. Only change what the user asks for.
8. LOGO RULE: Ensure the logo uses the provided logoUrl from the design brief (or a matching brand logo) rather than generating custom SVG paths or plain text logos. Render it cleanly as <img src={...} className="h-8 w-8 object-contain" alt="Logo" />.

CURRENT DESIGN SYSTEM: ${JSON.stringify(designBrief || {})}`;

      // BUG FIX #3: Increased max_tokens from 8000 to 12000 to prevent truncation
      const rawJSX = await callDeepSeek(systemPrompt, `CURRENT REACT CODE:\n${currentReactCode}\n\nINSTRUCTION: ${instruction}`, 12000);
      const extracted = extractReactCode(rawJSX);
      const verifiedCode = await brainVerifyAndFix(extracted, designBrief || {});
      const sanitizedCode = sanitizeReactCode(verifiedCode);
      const html = cleanHTML(sanitizedCode, designBrief || {});

      res.json({ status: 'success', html, reactCode: sanitizedCode });
    } catch (err) {
      console.error('[Error] Iteration error:', err);
      res.status(500).json({ error: err.message || 'Iteration failed' });
    }
  });
});

// POST /api/agentic-ui/add-screen — Add a NEW screen with the SAME design system
router.post('/add-screen', async (req, res) => {
  req.socket.setTimeout(600000);
  const modelToUse = selectDeepSeekModel(req.body.screenDescription, req.body.designBrief, req.body.useReasoner);
  return modelStorage.run(modelToUse, async () => {
    try {
      const { screenDescription, designBrief, existingHTML, platformOverride } = req.body;
      if (!screenDescription) return res.status(400).json({ error: 'screenDescription is required' });

    // ── Content Moderation and Safety Filter ──
    const safetyCheck = checkPromptSafety(screenDescription);
    if (!safetyCheck.isSafe) {
      console.warn(`Prompt safety violation in add-screen! Term: "${safetyCheck.triggerTerm}", Prompt: "${screenDescription}"`);
      return res.status(400).json({
        error: 'safety_violation',
        message: 'InspoAI safety guidelines prohibit generating explicit, adult, or inappropriate user interfaces. Please modify your prompt and try again.'
      });
    }

    if (!DEEPSEEK_API_KEY) return res.status(500).json({ error: 'DeepSeek API key not configured' });

    // ── Credit check ──
    const user = req.user;
    if (user) {
      const quota = getAgenticQuota(user);
      if (!quota.isUnlimited && quota.remaining <= 0) {
        const msg = quota.isTrialExpired 
          ? "Your 7-day free trial has expired. Please upgrade your plan to continue generating screens."
          : `You have used all ${quota.limit} AgenticUI generations on your ${user.role} plan. Upgrade to generate more.`;
        return res.status(402).json({
          error: 'generation_limit_reached',
          message: msg,
          quota
        });
      }
    }

    // ── v3 session design memory: new screens follow the CURRENT document's
    //    DNA (including any retheme) and the saved app chrome ──
    const v3Added = await addScreenV3({ screenDescription, existingHTML, designBrief, platformOverride }).catch(err => {
      console.warn('[Warning] [v3] add-screen failed, falling back to legacy:', err.message);
      return null;
    });
    if (v3Added) {
      if (req.user) deductAgenticCredit(req.user).catch(() => {});
      return res.json({ status: 'success', html: v3Added.html, reactCode: null, title: v3Added.title, meta: { duration: 0 } });
    }

    const startTime = Date.now();
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`+ ADD SCREEN: "${screenDescription}"`);
    console.log(`${'─'.repeat(50)}`);

    // Use the existing design brief (colors, fonts, theme) — skip Brain Calls 1 & 2
    const brief = designBrief || {};
    const fonts = brief.fonts || { heading: 'Inter', body: 'Inter' };
    const colors = brief.colors || {
      background: '#0F1117', surface: '#1A1D27', border: '#2A2D37',
      textPrimary: '#F5F5F7', textSecondary: '#8B8D97',
      accent: '#6C5CE7', accentSecondary: '#00D2FF',
      success: '#34D399', warning: '#FBBF24', error: '#EF4444'
    };

    // Determine platform using platformOverride (frontend determined) or screenDescription keyword analysis
    let platform = platformOverride;
    const descLower = screenDescription.toLowerCase();
    if (descLower.includes('ios') || descLower.includes('iphone') || descLower.includes('mobile') || descLower.includes('phone') || descLower.includes('android')) {
      platform = 'ios';
    } else if (descLower.includes('tablet') || descLower.includes('ipad')) {
      platform = 'tablet';
    } else if (descLower.includes('web') || descLower.includes('desktop') || descLower.includes('website') || descLower.includes('computer')) {
      platform = 'web';
    }

    if (!platform) {
      platform = brief.device || 'ios';
    }

    const theme = brief.theme || 'dark';
    const device = DEVICE_SPECS[platform] || DEVICE_SPECS.ios;

    // Fetch minimal icons for the new screen type
    console.log(`  [0ms] Fetching icons for "${screenDescription}"...`);
    const iconNames = ['arrow-left', 'eye', 'lock', 'user', 'mail', 'check', 'close', 'key'];
    const icons = await fetchIcons(iconNames, 'solar');
    const avatars = getAvatarUrls(3);
    console.log(`  [${Date.now() - startTime}ms] [Success] Icons ready`);

    // Extract logos and generate logoUrl
    const appName = brief.consistencySpec?.appName || brief.intent?.mentionedBrands?.[0] || 'App';
    const logoUrl = brief.logoUrl || Object.values(brief.brandLogos || {})[0]?.url || getPlaceholderLogo(appName);

    // Build design brief for brainCompose — same design DNA as existing screens
    const composeBrief = {
      device, fonts, colors, icons, avatars,
      chart: null,
      sections: [screenDescription],
      references: [],
      intent: {
        screenType: screenDescription,
        industry: brief.industry || 'general',
        platform,
        theme,
        sections: [screenDescription],
        mentionedBrands: brief.intent?.mentionedBrands || []
      },
      layoutPattern: `Create a brand new "${screenDescription}" screen that visually matches the existing app design.`,
      visualNotes: existingHTML
        ? 'IMPORTANT: A sibling screen from this same app exists. Match its visual style EXACTLY — same spacing, same border radius, same font sizes, same color distribution, same component style.'
        : '',
      stockImages: [],
      brandLogos: brief.brandLogos || {},
      consistencySpec: brief.consistencySpec || null,
      activeTabIndex: 0,
      logoUrl
    };

    // Go straight to compose — skip understand/analyze (we already have the design system)
    console.log(`  [${Date.now() - startTime}ms] Composing "${screenDescription}" HTML...`);
    const rawHTML = await brainCompose(composeBrief);
    const extracted = extractReactCode(rawHTML);
    const verifiedCode = await brainVerifyAndFix(extracted, composeBrief);
    const sanitizedCode = sanitizeReactCode(verifiedCode);
    const html = cleanHTML(sanitizedCode, composeBrief);

    const duration = Date.now() - startTime;
    console.log(`  [${duration}ms] [Success] New screen generated in ${(duration / 1000).toFixed(1)}s`);
    console.log(`${'─'.repeat(50)}\n`);

    res.json({
      status: 'success',
      html,
      reactCode: sanitizedCode,
      title: screenDescription,
      meta: { duration }
    });

    // Deduct credit after successful response (non-blocking)
    if (req.user) deductAgenticCredit(req.user).catch(e => console.warn('Credit deduction failed:', e.message));

  } catch (err) {
    console.error('[Error] Add screen error:', err);
    res.status(500).json({ error: err.message || 'Add screen failed' });
  }
  });
});

// ══════════════════════════════════════════════════════════════════════
// PERSISTENCE ROUTES
// ══════════════════════════════════════════════════════════════════════

// Helper: save a generation to Supabase (fire-and-forget, non-blocking)
async function saveGeneration(userId, data) {
  if (!supabaseAdmin) {
    console.error('[Error] [Save] supabaseAdmin not initialized');
    return null;
  }
  try {
    console.log(` [Save] Attempting to save for user: ${userId}`);
    
    // Ensure sessionId is a valid UUID format to prevent Supabase constraint errors
    let validSessionId = undefined;
    if (data.sessionId) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(data.sessionId)) {
        validSessionId = data.sessionId.toLowerCase();
      } else {
        // Create a deterministic UUID from the string using MD5 hash (UUID v3 format)
        const hash = crypto.createHash('md5').update(data.sessionId).digest('hex');
        validSessionId = [
          hash.substring(0, 8),
          hash.substring(8, 12),
          '3' + hash.substring(13, 16), // version 3
          '8' + hash.substring(17, 20), // variant 1
          hash.substring(20, 32)
        ].join('-');
        console.log(`[Save] Converted session string "${data.sessionId}" to deterministic UUID: "${validSessionId}"`);
      }
    }

    const { data: row, error } = await supabaseAdmin
      .from('ui_generations')
      .insert({
        user_id: userId,
        prompt: data.prompt || '',
        platform: data.platform || 'ios',
        theme: data.theme || 'dark',
        screen_type: data.screenType || '',
        industry: data.industry || '',
        html: data.html,
        title: data.title || '',
        design_brief: {
          ...(data.designBrief || {}),
          reactCode: data.reactCode || null
        },
        references_used: data.references || [],
        vision_notes: data.visionNotes || '',
        canvas_x: data.canvasX ?? 60,
        canvas_y: data.canvasY ?? 60,
        canvas_width: data.canvasWidth ?? 393,
        canvas_height: data.canvasHeight ?? 892,
        session_id: validSessionId,
        timing_ms: data.timingMs || 0
      })
      .select('id, session_id')
      .single();
    if (error) {
      console.warn('[Warning] [Save] Failed to save generation:', error.message);
      return null;
    }
    console.log(`[Success] [Save] Success! Saved generation ${row.id} (session ${row.session_id}) for user ${userId}`);
    return row;
  } catch (err) {
    console.warn('[Warning] [Save] Error:', err.message);
    return null;
  }
}

// DEBUG: GET /api/agentic-ui/debug-last-rows — Dump last 5 rows for diagnosis
router.get('/debug-last-rows', async (req, res) => {
  try {
    const { data: rows, error } = await supabaseAdmin
      .from('ui_generations')
      .select('id, user_id, prompt, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    res.json({ rows, error });
  } catch (err) {
    res.json({ error: err.message });
  }
});

// GET /api/agentic-ui/sessions — Load user's generation history
router.get('/sessions', async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    
    if (!supabaseAdmin) {
      console.error('[Error] [Sessions] supabaseAdmin is not initialized');
      return res.json({ sessions: [] });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('ui_generations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('[Error] [Sessions] Supabase error:', error.message);
      throw error;
    }


    // Group by session_id + group close-by same-prompt rows as virtual sessions
    const sessionMap = {};
    // Sort chronological first so grouping logic handles sequences naturally
    const sortedRows = [...(rows || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    for (const row of sortedRows) {
      let matchedSessionId = null;
      const rowTime = new Date(row.created_at).getTime();

      // Look for an existing session from same user with the same prompt created within 3 minutes
      for (const sid of Object.keys(sessionMap)) {
        const session = sessionMap[sid];
        const sessionTime = new Date(session.createdAt).getTime();
        const isCloseInTime = Math.abs(rowTime - sessionTime) < 3 * 60 * 1000; // 3 minutes
        
        // Match prompts
        const isSamePrompt = session.screens[0]?.prompt === row.prompt;

        if (isCloseInTime && isSamePrompt) {
          matchedSessionId = sid;
          break;
        }
      }

      const sid = matchedSessionId || row.session_id;

      if (!sessionMap[sid]) {
        sessionMap[sid] = {
          sessionId: sid,
          createdAt: row.created_at,
          designBrief: row.design_brief,
          screens: []
        };
      }
      sessionMap[sid].screens.push({
        id: row.id,
        html: row.html,
        reactCode: row.design_brief?.reactCode || null,
        title: row.title,
        prompt: row.prompt,
        platform: row.platform,
        theme: row.theme,
        screenType: row.screen_type,
        canvasX: row.canvas_x,
        canvasY: row.canvas_y,
        canvasWidth: row.canvas_width,
        canvasHeight: row.canvas_height,
        createdAt: row.created_at
      });
    }

    const sessions = Object.values(sessionMap).sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.json({ sessions });
  } catch (err) {
    console.error('[Error] Load sessions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agentic-ui/save — Save a generated screen
router.post('/save', async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    const row = await saveGeneration(userId, req.body);
    if (!row) return res.status(500).json({ error: 'Failed to save' });
    res.json({ status: 'success', id: row.id, sessionId: row.session_id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agentic-ui/update-position — Update canvas card position
router.put('/update-position', async (req, res) => {
  try {
    const { generationId, canvasX, canvasY, canvasWidth, canvasHeight } = req.body;
    if (!generationId || !supabaseAdmin) return res.status(400).json({ error: 'generationId required' });

    const { error } = await supabaseAdmin
      .from('ui_generations')
      .update({
        canvas_x: canvasX,
        canvas_y: canvasY,
        canvas_width: canvasWidth,
        canvas_height: canvasHeight
      })
      .eq('id', generationId)
      .eq('user_id', req.user.uid || req.user.id);

    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/agentic-ui/update-html — Persist inline text edits made on the canvas
router.put('/update-html', async (req, res) => {
  try {
    const { generationId, html } = req.body;
    if (!generationId || !html || !supabaseAdmin) return res.status(400).json({ error: 'generationId and html required' });

    const { error } = await supabaseAdmin
      .from('ui_generations')
      .update({ html })
      .eq('id', generationId)
      .eq('user_id', req.user.uid || req.user.id);

    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/agentic-ui/generation/:id — Delete a saved generation
router.delete('/generation/:id', async (req, res) => {
  try {
    const userId = req.user.uid || req.user.id;
    if (!supabaseAdmin) return res.status(500).json({ error: 'No database' });

    const { error } = await supabaseAdmin
      .from('ui_generations')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', userId);

    if (error) throw error;
    res.json({ status: 'success' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/agentic-ui/shared/:sessionId — Public: load all screens for a shared session (no auth required)
router.get('/shared/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!supabaseAdmin) return res.status(500).json({ error: 'No database' });

    const { data: rows, error } = await supabaseAdmin
      .from('ui_generations')
      .select('id, html, title, prompt, platform, theme, screen_type, canvas_x, canvas_y, canvas_width, canvas_height, created_at, design_brief, user_id')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Session not found' });

    const screens = rows.map(row => ({
      id: row.id,
      html: row.html,
      reactCode: row.design_brief?.reactCode || null,
      title: row.title,
      prompt: row.prompt,
      platform: row.platform,
      theme: row.theme,
      screenType: row.screen_type,
      canvasX: row.canvas_x,
      canvasY: row.canvas_y,
      canvasWidth: row.canvas_width,
      canvasHeight: row.canvas_height,
      createdAt: row.created_at
    }));

    const ownerId = rows[0].user_id;
    let ownerRole = 'free';
    if (ownerId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', ownerId)
        .maybeSingle();
      if (profile) {
        ownerRole = profile.role || 'free';
      }
    }

    res.json({ screens, sessionId, ownerRole });
  } catch (err) {
    console.error('[Error] Shared session error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agentic-ui/fix-error — Free error repair using DeepSeek (no credits deducted)
router.post('/fix-error', async (req, res) => {
  req.socket.setTimeout(600000);
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { reactCode, html, errorMessage, designBrief } = req.body;
    if (!reactCode && !html) return res.status(400).json({ error: 'reactCode or html is required' });

    // Extract React code from HTML if only the full HTML shell was provided
    let code = reactCode;
    if (!code && html) {
      const match = html.match(/\/\/ LLM Generated Component Code:\s*([\s\S]*?)\s*\/\/ Dynamic Mount Execution/);
      code = match ? match[1].trim() : '';
    }
    if (!code || code.length < 20) {
      return res.status(400).json({ error: 'Could not extract React component code from provided input' });
    }

    console.log(`\n[Fix Error] Starting free error repair for user ${user.id || user.uid}`);
    if (errorMessage) console.log(`  Error: ${errorMessage.slice(0, 120)}`);

    const stockImages = designBrief?.stockImages || [];
    let stockImgsList = stockImages.map(img => img.url);
    if (stockImgsList.length === 0) {
      stockImgsList = [
        ...CURATED_AURA_ASSETS.abstract.slice(0, 3),
        ...CURATED_AURA_ASSETS.background.slice(0, 3),
        ...CURATED_AURA_ASSETS.headshot.slice(0, 3),
        ...CURATED_AURA_ASSETS.architecture.slice(0, 3)
      ];
    }
    const allowedImagesSnippet = stockImgsList.map((url, i) => `IMAGE ${i + 1}: ${url}`).join('\n');

    const systemPrompt = `You are an elite React code repair specialist. Your ONLY job is to fix broken React + Tailwind CSS component code so it compiles and renders correctly in a Babel standalone browser environment.

CRITICAL RULE:
You MUST PRESERVE the exact functionality, UI sections, labels, text content, layout, and visual theme of the input React code. Your job is ONLY to fix compilation/runtime bugs (such as undefined variables, incorrect imports, TypeScript annotations, mismatched brackets, or illegal constructors). Do NOT change the topic of the app or replace the component with a different design (e.g., if the user code is for a Fintech or E-commerce dashboard, do NOT replace it with a plant app or anything else). Keep all original text, content, headings, and lists intact. Do NOT delete components from the file unless they are duplicates.

MANDATORY IMAGE RULE:
You MUST ONLY use image URLs from the ALLOWED IMAGES list below. DO NOT use or introduce any external image URLs (such as Unsplash, Lorem Pixel, or placeholders) under any circumstances. If the code contains any external image URLs, replace them with URLs from the ALLOWED IMAGES list.

ALLOWED IMAGES:
${allowedImagesSnippet}

ENVIRONMENT CONSTRAINTS (the code runs in a browser iframe with Babel standalone in ES module mode):
- The root component MUST be named "App" — no "export default" keyword
- Tailwind CSS is available via CDN (className="...")
- PRE-IMPORTED GLOBALS (already in scope — REMOVE any import for these): React, useState, useEffect, useRef, useCallback, useMemo, useContext, useReducer, useLayoutEffect, createContext, Fragment, forwardRef, memo, lazy, Suspense, Lucide (all icons — use as Lucide.IconName), Recharts (all chart components), motion, AnimatePresence, useAnimation, useMotionValue, useTransform, useSpring, useScroll, useInView (framer-motion)
- KEEP THESE AS EXPLICIT IMPORTS (they resolve via import map — do NOT remove): @radix-ui/*, clsx, tailwind-merge, three, @react-three/fiber, @react-three/drei

COMMON BUGS TO FIX — check and fix ALL of these:
1. TYPESCRIPT: Remove EVERY type annotation — interfaces, type aliases, parameter types (x: string), return types (=> void), generic syntax (<T>), type assertions (as Type, as const), satisfies keyword, non-null assertions (!), optional parameter markers (?:), import type statements, enum declarations
2. BANNED LUCIDE ICONS: Replace with valid equivalents: Activity→TrendingUp, Sparkles→Wand2, Sparkle→Wand2, WandSparkles→Wand2, Heart→Circle, Star→Circle, Bolt→Lightbulb, Zap→Lightbulb, Flame→Circle, CircleCheckBig→BadgeCheck, CircleCheck→BadgeCheck, CheckCircle→BadgeCheck, CheckCircle2→BadgeCheck, House→Home
3. NON-EXISTENT LUCIDE ICONS: Validate every Lucide.IconName or const { IconName } = Lucide against the actual lucide-react v0.300.0 set. Replace hallucinated icons with the nearest real one (use Circle as last resort)
4. DYNAMIC TAILWIND: Replace bg-[\${variable}] with style={{ backgroundColor: variable }}, text-[\${var}] with style={{ color: var }}, etc.
5. JSX IN DATA ARRAYS: Never put <Lucide.Home/> inside arrays/objects. Store as string iconName:"Home", render via: const Icon = Lucide[item.iconName]; <Icon/>
6. UNCLOSED SYNTAX: Ensure all JSX tags, {}, [], () are balanced and closed
7. UNDEFINED VARIABLES: Every variable, function, and hook used in JSX must be defined above it
8. RECHARTS: The data prop must be a non-empty array of objects. Valid children only: XAxis, YAxis, CartesianGrid, Tooltip, Legend, Line, Bar, Area, Cell, Pie, etc.
9. IMPORT STATEMENTS: Remove import statements for react, react-dom, lucide-react, recharts, framer-motion, and motion/react — these are pre-loaded globals. KEEP imports for @radix-ui/*, clsx, tailwind-merge, three, @react-three/fiber, @react-three/drei — these resolve via the import map and must stay.
10. EXPORT DEFAULT: Remove the "export default" keyword — just declare the function

Output ONLY the fixed React component code. No markdown, no code fences, no explanations.`;

    const userPrompt = `${errorMessage ? `RUNTIME ERROR MESSAGE:\n${errorMessage}\n\n` : ''}BROKEN REACT CODE TO FIX:\n${code}`;

    console.log(`  [Fix Error] Calling DeepSeek fixer...`);
    const fixedRaw = await callDeepSeek(systemPrompt, userPrompt, 12000);

    const finalCode = await brainVerifyAndFix(fixedRaw, designBrief || {});

    const finalCheck = compileCheck(finalCode);

    if (!finalCheck.success) {
      return res.status(422).json({
        status: 'failed',
        error: 'The component could not be repaired.',
        compilerError: finalCheck.error
      });
    }

    const fixedHtml = cleanHTML(finalCode, designBrief || {});

    console.log(`[Success] [Fix Error] Repair complete — code length: ${finalCode.length} chars`);

    // NO credit deduction — this endpoint is always free
    return res.json({
      status: 'success',
      html: fixedHtml,
      reactCode: finalCode
    });
  } catch (err) {
    console.error('[Error] [Fix Error] Error:', err.message);
    res.status(500).json({ error: err.message || 'Fix failed' });
  }
});

export default router;
export { fetchStockImages, compileCheck, fixInvalidLucideIcons, sanitizeReactCode };
