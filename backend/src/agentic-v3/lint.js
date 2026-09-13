/**
 * agentic-v3/lint.js
 *
 * Deterministic post-processing: zero LLM calls, zero cost.
 * Fixes what can be fixed mechanically, reports what needs a repair call.
 */

import * as cheerio from 'cheerio';

const IMAGE_HOST_ALLOWLIST = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'api.dicebear.com',
  'i.pravatar.cc',
  'cdn.brandfetch.io',
  'picsum.photos',
  'api.iconify.design',
  'image.pollinations.ai',
  'hoirqrkdgbmvpwutwuwj.supabase.co',
  'www.google.com',
  'upload.wikimedia.org'
];

// Emoji + pictographs (composer must use iconify icons instead)
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{1F000}-\u{1F02F}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu;

const SLOP_CLASS_RE = /\b(?:from|via|to|bg|text|border)-(?:purple|violet|fuchsia|pink|indigo)-\d{2,3}\b/g;
const PLACEHOLDER_RE = /\[(?:detailed |embedded |page content|cards \/|hero visual|brand side|\.\.\.)[^\]]*\]|lorem ipsum|Your (?:Text|Title|Content) Here/i;

/**
 * Lint + autofix a composed body fragment.
 * @returns {{ html: string, violations: string[], stats: object }}
 */
export function lintAndFix(bodyHtml, { dna, allowStars = false, fallbackImageSeed = 'inspo', platform = 'web' } = {}) {
  const violations = [];
  let html = String(bodyHtml || '');

  // If the model returned a full document despite instructions, unwrap it.
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1];
  html = html.replace(/<!DOCTYPE[^>]*>/gi, '').replace(/<\/?(?:html|head)[^>]*>/gi, '');
  // Model-authored <link>/<meta>/<title> belong to the shell, not the fragment
  html = html.replace(/<(?:link|meta|title)\b[^>]*>/gi, '');

  // Strip emoji (brutalist DNA may keep /●-style dingbats)
  const emojiFound = html.match(EMOJI_RE);
  if (emojiFound) {
    const keep = allowStars ? new Set(['★', '☆', '●', '○', '◆', '✓', '→', '←', '↗']) : new Set(['✓', '→', '←', '↗']);
    html = html.replace(EMOJI_RE, (m) => (keep.has(m) ? m : ''));
    const removed = emojiFound.filter(m => !keep.has(m));
    if (removed.length) violations.push(`removed ${removed.length} emoji (use iconify-icon instead)`);
  }

  if (PLACEHOLDER_RE.test(html)) {
    violations.push('placeholder text found (bracket stub or lorem ipsum) — must be replaced with real content');
  }

  // Literal strings from the reference patterns must not leak into output
  const PATTERN_LEAKS = ['Vantage', '4,200+', '99.98%', 'Priya Raman', 'Northwind', 'marcus@vantage.io', 'Marcus Chen', 'Acme Corp', 'shorter close cycles'];
  const leaked = PATTERN_LEAKS.filter(s => html.includes(s));
  if (leaked.length) {
    violations.push(`reference-pattern content leaked verbatim (${leaked.join(', ')}) — replace with content specific to THIS product`);
  }

  const slop = html.match(SLOP_CLASS_RE);
  if (slop && !/purple|violet|pink|indigo|fuchsia/.test(JSON.stringify(dna?.tokens || {}))) {
    violations.push(`off-DNA colors used: ${[...new Set(slop)].slice(0, 5).join(', ')} — replace with DNA token classes`);
  }

  // Mobile: fixed widths ≥ the 390px viewport guarantee horizontal overflow —
  // clamp them deterministically before the DOM pass.
  if (platform === 'ios') {
    let clamped = 0;
    html = html.replace(/\b(?:w|min-w)-\[(\d{3,})px\]/g, (m, px) => {
      if (Number(px) < 380) return m;
      clamped++;
      return 'w-full max-w-full';
    });
    if (clamped) violations.push(`clamped ${clamped} fixed width(s) ≥ 380px to w-full (mobile viewport is 390px)`);
  }

  const $ = cheerio.load(html, null, false);

  // Scripts: inline only; external must be chart/alpine (they're in the shell anyway)
  $('script[src]').each((_, el) => {
    const src = $(el).attr('src') || '';
    violations.push(`removed external script: ${src.slice(0, 80)}`);
    $(el).remove();
  });

  // Images: enforce host allowlist + alt
  let imgIdx = 0;
  $('img').each((_, el) => {
    const $el = $(el);
    const src = $el.attr('src') || '';
    imgIdx++;
    let ok = false;
    try { ok = src.startsWith('https://') && IMAGE_HOST_ALLOWLIST.includes(new URL(src).hostname); } catch {}
    if (!ok) {
      $el.attr('src', `https://picsum.photos/seed/${fallbackImageSeed}-${imgIdx}/1200/900`);
      violations.push(`replaced off-allowlist image src (${src.slice(0, 60) || 'empty'})`);
    }
    if (!$el.attr('alt')) $el.attr('alt', '');
    // Pollinations renders on demand and rate-limits bursts — lazy-load so
    // below-the-fold images don't all fire at once (in-viewport ones are
    // unaffected by loading=lazy).
    if (/image\.pollinations\.ai/.test($el.attr('src') || '') && !$el.attr('loading')) {
      $el.attr('loading', 'lazy');
    }
  });

  // Icons: ensure iconify names are prefixed
  $('iconify-icon').each((_, el) => {
    const $el = $(el);
    const name = $el.attr('icon') || '';
    if (name && !name.includes(':')) $el.attr('icon', `lucide:${name}`);
    if (!name) $el.attr('icon', 'lucide:circle');
  });

  // Dead links
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || /^javascript:/i.test(href)) $(el).attr('href', '#');
  });

  // Mobile edge padding: content containers must never touch the device
  // edges. Deterministic fix — add px-4 to unpadded scroll/main/wrapper containers.
  if (platform === 'ios') {
    // 1. Correct px-0 / pl-0 / pr-0 on headers, navs, mains, and top-level divs to px-4 / pl-4 / pr-4
    $('main, header, nav, body > div, [class*="overflow-y-auto"]').each((_, el) => {
      const $el = $(el);
      let cls = $el.attr('class') || '';
      let changed = false;
      if (/\bpx-0\b/.test(cls)) {
        cls = cls.replace(/\bpx-0\b/g, 'px-4');
        changed = true;
      }
      if (/\bpl-0\b/.test(cls)) {
        cls = cls.replace(/\bpl-0\b/g, 'pl-4');
        changed = true;
      }
      if (/\bpr-0\b/.test(cls)) {
        cls = cls.replace(/\bpr-0\b/g, 'pr-4');
        changed = true;
      }
      if (changed) {
        $el.attr('class', cls);
        violations.push('replaced edge-touching px-0/pl-0/pr-0 padding on mobile container');
      }
    });

    // 2. Apply fallback px-4 padding to unpadded containers
    $('main, header, nav, body > div, [class*="overflow-y-auto"]').each((_, el) => {
      const $el = $(el);
      const cls = $el.attr('class') || '';
      if (/\bpx-[1-9]|\bpx-\[|\bpl-[1-9]|\bmx-[1-9]/.test(cls)) return;
      
      // Skip if its children already carry horizontal padding/margin
      const kids = $el.children().toArray();
      const kidsPadded = kids.length > 0 && kids.every(k => /\bpx-[1-9]|\bmx-[1-9]|\bpx-\[/.test($(k).attr('class') || ''));
      if (kidsPadded) return;
      
      $el.attr('class', `${cls} px-4`.trim());
      violations.push('added missing px-4 edge padding to a mobile content container');
    });

    // 3. Correct status bar padding to px-4 if it was generated with px-6
    $('div').each((_, el) => {
      const $el = $(el);
      if (/9:41/.test($el.text()) || $el.find('iconify-icon[icon*="wifi"], iconify-icon[icon*="signal"], iconify-icon[icon*="battery"]').length > 0) {
        let cls = $el.attr('class') || '';
        if (/\bpx-6\b/.test(cls)) {
          $el.attr('class', cls.replace(/\bpx-6\b/g, 'px-4'));
          violations.push('adjusted status bar padding to px-4 for alignment');
        }
      }
    });

    // 4. Status-bar guard: an iOS screen must never start with content jammed
    // into the notch/rounded-corner zone. If no status bar is present,
    // prepend a deterministic one using DNA token classes (using px-4 for alignment).
    const hasStatusBar = /9:41|lucide:(?:wifi|signal|battery)/.test($.html());
    if (!hasStatusBar) {
      $.root().prepend(`<div class="flex items-center justify-between px-4 pt-3 pb-1 text-[13px] font-semibold text-ink"><span>9:41</span><span class="flex items-center gap-1.5"><iconify-icon icon="lucide:signal" class="text-[13px]"></iconify-icon><iconify-icon icon="lucide:wifi" class="text-[13px]"></iconify-icon><iconify-icon icon="lucide:battery-full" class="text-[15px]"></iconify-icon></span></div>`);
      violations.push('prepended missing iOS status bar (content was starting inside the notch zone)');
    }
  }

  const out = $.html();

  // Sanity: suspiciously short output usually means truncation or refusal
  if (out.replace(/\s+/g, ' ').length < 600) {
    violations.push('output suspiciously short — likely truncated or incomplete');
  }

  return {
    html: out,
    violations,
    stats: { chars: out.length, images: imgIdx }
  };
}

/** Violations that require an LLM repair pass (autofixes already applied). */
export function needsRepair(violations) {
  return violations.some(v =>
    v.startsWith('placeholder text') ||
    v.startsWith('off-DNA colors') ||
    v.startsWith('output suspiciously short') ||
    v.startsWith('reference-pattern content leaked')
  );
}
