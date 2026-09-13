/**
 * agentic-v3/signatures.js
 *
 * Signature templates — hand-crafted "mega prompt" art directions that go far
 * beyond a DNA token set: they lock a full page architecture, signature
 * techniques (masked-image mosaics, liquid glass, cinematic heroes) and an
 * image treatment.
 *
 * Each signature carries its own real DNA (so retheme, tokens and the
 * existing dnaId plumbing all keep working) plus a spec block that REPLACES
 * the generic pattern references in the composer prompt. Reference imagery is
 * never hardcoded: image slots are resolved per generation through
 * Pollinations (free AI image gen) so every user gets imagery specific to
 * THEIR product under the same art direction.
 *
 * PRODUCT-FIRST RULE (learned the hard way): no splash screens, loaders or
 * counters — anything that hides content on load reads as "broken" in the
 * canvas and gates the user's goal. Motion comes from the shell's scroll
 * reveal, CSS Ken Burns pans and marquees — all non-blocking, all
 * deterministic. No multi-statement Alpine expressions (x-init with
 * `var ...` is a SyntaxError in Alpine's evaluator — this shipped a
 * stuck-at-0 splash once).
 */

const POLLINATIONS = 'https://image.pollinations.ai/prompt/';

/** Resolve a signature's image slots into concrete generated-image URLs. */
export function buildSignatureImages(sig, subject, seed = null) {
  const s = seed ?? (Date.now() % 100000);
  const style = sig.imageStyle || '';
  const out = {};
  for (const [i, slot] of sig.imageSlots.entries()) {
    const prompt = `${slot.prompt.replace(/\{SUBJECT\}/g, subject)}, ${style}`;
    out[slot.slot] = {
      url: `${POLLINATIONS}${encodeURIComponent(prompt)}?width=${slot.w}&height=${slot.h}&nologo=true&seed=${s + i}`,
      alt: slot.alt || slot.slot
    };
  }
  return out;
}

// ── Shared verbatim building blocks ─────────────────────────────────────────

// Liquid glass + ambient motion utilities. Fragments include this <style>
// verbatim; the classes are the signature's visual identity.
const FX_CSS = `<style>
.liquid-glass{background:rgba(255,255,255,0.01);background-blend-mode:luminosity;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);border:none;box-shadow:inset 0 1px 1px rgba(255,255,255,0.1);position:relative;overflow:hidden}
.liquid-glass::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1.4px;background:linear-gradient(180deg,rgba(255,255,255,0.45) 0%,rgba(255,255,255,0.15) 20%,rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.15) 80%,rgba(255,255,255,0.45) 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.liquid-glass-strong{background:rgba(255,255,255,0.01);background-blend-mode:luminosity;backdrop-filter:blur(50px);-webkit-backdrop-filter:blur(50px);border:none;box-shadow:4px 4px 4px rgba(0,0,0,0.05),inset 0 1px 1px rgba(255,255,255,0.15);position:relative;overflow:hidden}
.liquid-glass-strong::before{content:'';position:absolute;inset:0;border-radius:inherit;padding:1.4px;background:linear-gradient(180deg,rgba(255,255,255,0.5) 0%,rgba(255,255,255,0.2) 20%,rgba(255,255,255,0) 40%,rgba(255,255,255,0) 60%,rgba(255,255,255,0.2) 80%,rgba(255,255,255,0.5) 100%);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}
.v3-kenburns{animation:v3kb 26s ease-in-out infinite alternate}
@keyframes v3kb{from{transform:scale(1)}to{transform:scale(1.08)}}
.v3-marquee{display:flex;width:max-content;animation:v3mq 30s linear infinite}
@keyframes v3mq{to{transform:translateX(-50%)}}
</style>`;

// Hard product rules every signature spec carries.
const PRODUCT_RULES = `NON-NEGOTIABLE PRODUCT RULES:
- NO splash screens, loaders, counters or overlays that hide content on load. The page is fully readable the instant it renders — the document shell already animates sections in on scroll; never write your own entrance/scroll animation scripts.
- ALL text comes from the provided COPY for THIS product. The example wording in this spec describes structure only — its brands, industries and phrases must never appear in the output.
- Alpine only for simple toggles (x-data="{open:false}"). NEVER multi-statement x-init expressions (anything with var/let inside an Alpine attribute breaks the page).
- The hero/architecture image slots use ONLY the URLs listed in this spec. For ADDITIONAL content imagery the page needs (product shots, gallery tiles, portraits), generate more the same way: https://image.pollinations.ai/prompt/{URL-encoded photographic description naming this actual product}?width=800&height=800&nologo=true&seed={a different number per image} — NEVER an empty gray placeholder box where a photo belongs.`;

// Masked-card mosaic script (Masked Mosaic signature). offsetTop/offsetLeft
// (not getBoundingClientRect) so the shell's scroll-reveal transforms never
// skew the measurements.
const MASKED_CARD_SCRIPT = `<script>
(function () {
  function offsetWithin(el, ancestor) {
    var x = 0, y = 0;
    while (el && el !== ancestor) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
    return { x: x, y: y };
  }
  function layoutMasks() {
    document.querySelectorAll('[data-mask-section]').forEach(function (sec) {
      var url = sec.getAttribute('data-mask-image');
      var focal = parseFloat(sec.getAttribute('data-mask-focal') || '0.8');
      if (!url) return;
      var img = new Image();
      img.onload = function () {
        var W = sec.offsetWidth, H = sec.offsetHeight;
        var renderW = img.naturalWidth * (H / img.naturalHeight);
        var overflow = Math.max(0, renderW - W);
        var off = overflow * focal;
        sec.querySelectorAll('.masked-card').forEach(function (card) {
          var p = offsetWithin(card, sec);
          card.style.backgroundImage = "url('" + url + "')";
          card.style.backgroundSize = 'auto ' + H + 'px';
          card.style.backgroundRepeat = 'no-repeat';
          card.style.backgroundPosition = (-(p.x + off)) + 'px ' + (-p.y) + 'px';
        });
      };
      img.src = url;
    });
  }
  window.addEventListener('load', layoutMasks);
  window.addEventListener('resize', layoutMasks);
  setTimeout(layoutMasks, 400); setTimeout(layoutMasks, 1600);
})();
<\/script>`;

// ── Signature catalog ───────────────────────────────────────────────────────

export const SIGNATURES = [

  // 1 ── Masked Mosaic — shared-photo card mosaic, strict monochrome
  {
    id: 'sig-masked-mosaic',
    name: 'Masked Mosaic',
    platforms: ['web'],
    thumbnail: '/skills/sig-masked-mosaic.png',
    dna: {
      id: 'sig-masked-mosaic',
      name: 'Masked Mosaic',
      theme: 'light',
      bestFor: ['clinic', 'healthcare', 'dental', 'salon', 'wellness', 'studio', 'local business', 'service business', 'restaurant', 'gym'],
      tokens: {
        base: '#FFFFFF', surface: '#FFFFFF', raised: '#FAFAF9', line: '#E7E5E4',
        ink: '#0A0A0A', muted: '#57534E', accent: '#0A0A0A', accentInk: '#FFFFFF',
        accent2: '#A8A29E'
      },
      fonts: {
        display: 'Hanken Grotesk', body: 'Hanken Grotesk', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap'
      },
      radius: '1rem',
      shadow: 'none — depth comes from the shared-photo mosaic, glass panels and tone shifts, never drop shadows',
      rules: [
        'Strictly monochrome: black, white, and translucent white glass (bg-white/20 backdrop-blur-xl, bg-white/90 backdrop-blur-md). No accent hues anywhere.',
        'Typography is the design: heavy font-bold headlines at clamp() sizes with extremely tight leading (leading-[0.79] on the giant hero word, 0.9–1.05 elsewhere).',
        'Cards sit nearly seam-to-seam: gap-1.5 md:gap-2, rounded-xl md:rounded-2xl, overflow-hidden. Sections join with virtually no vertical gap.',
        'Full-viewport sections (h-screen flex flex-col) — each section is a self-contained composition.',
        'CTA buttons: white pill (px-8 py-5 bg-white rounded-full text-black font-bold) with hover:scale-105 transition-transform.',
        'NEVER use: colors, gradients, shadows, thin fonts, emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'photorealistic, bright airy interior, soft natural light, clean white and neutral tones, high-end commercial editorial photography, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_IMAGE', w: 1600, h: 900, alt: 'Hero environment', prompt: 'wide cinematic photograph of {SUBJECT}, welcoming modern space with a person, generous negative space on the left' },
      { slot: 'GALLERY_IMAGE', w: 1600, h: 900, alt: 'Gallery scene', prompt: 'wide photograph of {SUBJECT}, close-up human moment, joyful, shallow depth of field' },
      { slot: 'DETAIL_IMG_1', w: 800, h: 1000, alt: 'Detail one', prompt: 'detail photograph related to {SUBJECT}, tools or environment close-up, minimal composition' },
      { slot: 'DETAIL_IMG_2', w: 800, h: 1000, alt: 'Detail two', prompt: 'second detail photograph related to {SUBJECT}, different angle, hands at work, minimal composition' },
      { slot: 'PORTRAIT_IMAGE', w: 900, h: 1400, alt: 'Happy customer', prompt: 'vertical portrait photograph of a smiling person, customer of {SUBJECT}, genuine expression, clean background' }
    ],
    specBlock: (images, { productName = 'the product' } = {}) => `SIGNATURE TEMPLATE: "Masked Mosaic" (locked page architecture — follow it EXACTLY, adapting only content/copy to THIS product)

${PRODUCT_RULES}

THE SIGNATURE TECHNIQUE — MASKED CARDS:
Sections 1 and 2 each use ONE large photo shared across ALL cards in the section. Each card shows a different window into the same photo, forming a cohesive mosaic. Contract:
- The <section> gets: data-mask-section data-mask-image="<section's image URL>" data-mask-focal="0.8" plus relative overflow-hidden.
- Every card that reveals the photo gets class "masked-card" (plus rounded-xl md:rounded-2xl overflow-hidden relative). Do NOT set any background image on them yourself — the script positions the shared photo.
- Card text sits above the photo with relative z-10.
- Include this script ONCE at the very end of the fragment, VERBATIM:
${MASKED_CARD_SCRIPT}

IMAGES (generated for this product — use these EXACT URLs):
- HERO_IMAGE (section 1 shared photo): ${images.HERO_IMAGE.url}
- GALLERY_IMAGE (section 2 shared photo): ${images.GALLERY_IMAGE.url}
- DETAIL_IMG_1 / DETAIL_IMG_2 (section 3 <img>s): ${images.DETAIL_IMG_1.url} , ${images.DETAIL_IMG_2.url}
- PORTRAIT_IMAGE (section 3 tall <img>): ${images.PORTRAIT_IMAGE.url}

PAGE ARCHITECTURE (single page, in this order):
1) NAVBAR — fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 md:px-6 py-2 md:py-3 bg-white/80 backdrop-blur-md. Left: two-line stacked uppercase extrabold wordmark for "${productName}" (text-xl md:text-2xl tracking-tight leading-none, second line -mt-1.5) + tiny tagline (text-[9px] font-medium mt-1.5). Right (hidden md:flex items-center gap-6): "Menu" pill (px-6 py-3 bg-white rounded-full border border-black text-sm font-semibold hover:bg-black hover:text-white transition-colors) + one short bold utility text. Mobile (md:hidden): Alpine hamburger (x-data="{open:false}") — 3 absolute h-0.5 w-6 bg-black spans morphing to an X, plus a right slide-in panel (fixed inset-0 z-40; backdrop bg-black/20 backdrop-blur-sm; panel w-[85%] max-w-sm bg-white translate-x-full→translate-x-0 duration-500) with 5 text-4xl font-bold links and a full-width black pill CTA.
2) SECTION 1 — HERO: h-screen w-full overflow-hidden flex flex-col pt-24 px-3 md:px-5 pb-1.5 md:pb-2 gap-1.5 md:gap-2, masked with HERO_IMAGE. Three slim feature bars (masked-card, w-full h-14 md:h-20 shrink-0, centered bold claim text-lg md:text-3xl) + one main hero card (masked-card, flex-1 min-h-0): small semibold supporting line top-left; bottom-left tiny label + giant two-line headline at text-[clamp(3rem,11vw,11rem)] font-bold leading-[0.79] tracking-tight; bottom-right short white semibold line.
3) SECTION 2 — GALLERY/SERVICES: min-h-screen md:h-screen flex flex-col pt-1.5 md:pt-2 px-3 md:px-5 pb-1.5 md:pb-2 gap-1.5 md:gap-2, masked with GALLERY_IMAGE. Grid flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 md:grid-rows-[1fr_1fr_0.8fr] gap-1.5 md:gap-2 with 4 masked cards: (a) title + subtitle pinned to corners; (b) md:row-span-2 supporting sentence bottom-left + white pill CTA bottom-right; (c) giant two-line phrase at text-[clamp(3rem,7vw,6rem)] font-bold leading-[0.9]; (d) md:col-span-2 holding FOUR service sub-cards (flex-1 min-w-[calc(50%-4px)] md:min-w-0 rounded-xl md:rounded-2xl p-3 md:p-5 flex flex-col justify-between) — first active bg-white/90 backdrop-blur-md text-black, others bg-white/20 backdrop-blur-xl text-white; names text-xl md:text-4xl font-bold leading-[1.05]; first three get circled 01/02/03 badges (self-end w-12 h-12 rounded-full border).
4) SECTION 3 — DEEP-DIVE (no masking): min-h-screen md:h-screen grid grid-cols-1 md:grid-cols-2 gap-1.5 md:gap-2 px-3 md:px-5 pt-1.5 pb-1.5. LEFT column: heading card (rounded-2xl bg-raised p-5 md:p-7 flex-[1.2], H2 text-[clamp(3rem,7vw,6.5rem)] font-bold leading-[0.95]); two portrait images side-by-side (DETAIL_IMG_1/2, flex-1 rounded-2xl overflow-hidden, w-full h-full object-cover); consultation card (rounded-2xl bg-zinc-200 p-5 md:p-7 flex items-end justify-between, label + 3-line bold heading + white pill CTA). RIGHT column: tall image card (PORTRAIT_IMAGE object-cover) with two overlay cards pinned bottom (absolute bottom-5 left-5 right-5 flex gap-2): white card + glass card (bg-white/20 backdrop-blur-xl), each h-36 md:h-52 with 3-line bold mini-heading and a circled <iconify-icon icon="lucide:arrow-up-right"></iconify-icon>.`
  },

  // 2 ── Liquid Noir — dark Apple-style liquid glass landing
  {
    id: 'sig-liquid-noir',
    name: 'Liquid Noir',
    platforms: ['web'],
    thumbnail: '/skills/sig-liquid-noir.png',
    dna: {
      id: 'sig-liquid-noir',
      name: 'Liquid Noir',
      theme: 'dark',
      bestFor: ['agency', 'ai product', 'creative studio', 'web design', 'startup', 'saas', 'developer tool', 'automation', 'premium brand'],
      tokens: {
        base: '#000000', surface: '#0A0A0A', raised: '#141414', line: '#262626',
        ink: '#FFFFFF', muted: '#A3A3A3', accent: '#FFFFFF', accentInk: '#000000',
        accent2: '#8AA9CC'
      },
      fonts: {
        display: 'Instrument Serif', body: 'Barlow', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Barlow:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
      },
      radius: '1.5rem',
      shadow: 'none — glass borders and blur create all depth',
      rules: [
        'Pure black canvas. Every heading is font-display italic (Instrument Serif) at tracking-tight leading-[0.9]; body is Barlow font-light text-muted text-sm.',
        'Liquid glass is the identity: badges, nav, cards and buttons all use .liquid-glass / .liquid-glass-strong with rounded-full or rounded-2xl. No plain borders.',
        'Section rhythm: a small glass badge pill, then a serif italic heading, then muted subtext — repeated for every section.',
        'Imagery is dark and cinematic, always behind 200px black gradient fades (top and bottom) so sections melt into each other.',
        'One solid white pill CTA per screen maximum; every other button is glass.',
        'NEVER use: colored accents beyond the soft blue, drop shadows, light backgrounds, emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'dark moody cinematic 3d render, deep blacks, soft volumetric light, elegant abstract forms, subtle blue-grey glow, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_BG', w: 1600, h: 900, alt: 'Hero backdrop', prompt: 'wide abstract environment evoking {SUBJECT}, dark cinematic, glowing focal element center-right' },
      { slot: 'BAND_BG', w: 1600, h: 900, alt: 'How it works backdrop', prompt: 'dark atmospheric texture related to {SUBJECT}, flowing forms, depth of field' },
      { slot: 'DETAIL_1', w: 1200, h: 900, alt: 'Feature visual one', prompt: 'close-up cinematic detail representing {SUBJECT} capability, dramatic rim light' },
      { slot: 'DETAIL_2', w: 1200, h: 900, alt: 'Feature visual two', prompt: 'second cinematic detail for {SUBJECT}, different composition, cool tones' },
      { slot: 'CTA_BG', w: 1600, h: 900, alt: 'Closing backdrop', prompt: 'expansive dark horizon scene evoking the future of {SUBJECT}, small bright light source' }
    ],
    specBlock: (images) => `SIGNATURE TEMPLATE: "Liquid Noir" (locked page architecture — dark premium liquid-glass landing)

${PRODUCT_RULES}

Include this <style> block VERBATIM at the top of the fragment:
${FX_CSS}

IMAGES (use these EXACT URLs):
- HERO_BG: ${images.HERO_BG.url}
- BAND_BG: ${images.BAND_BG.url}
- DETAIL_1: ${images.DETAIL_1.url}
- DETAIL_2: ${images.DETAIL_2.url}
- CTA_BG: ${images.CTA_BG.url}

PAGE ARCHITECTURE (single page, bg-base, in this order):
1) NAVBAR — fixed top-4 inset-x-0 z-50 flex justify-center px-4: one liquid-glass rounded-full pill (px-2 py-2, inline-flex items-center gap-1) holding: a 9x9 rounded-full glass logo circle with a 2-letter serif italic monogram; 4-5 nav links (text-sm text-muted hover:text-ink px-4 py-2 rounded-full hover:bg-white/5); a solid bg-white text-black rounded-full px-5 py-2 text-sm font-medium CTA with <iconify-icon icon="lucide:arrow-up-right"></iconify-icon>.
2) HERO — relative min-h-screen overflow-hidden flex flex-col: HERO_BG as absolute inset-0 <img> object-cover opacity-60 with class v3-kenburns; a bottom fade div (absolute bottom-0 inset-x-0 h-72 bg-gradient-to-t from-base to-transparent). Content z-10 centered pt-44: glass badge pill (liquid-glass rounded-full px-3.5 py-1.5 text-xs, containing a bg-white text-black rounded-full px-2 py-0.5 "New"-style chip + short announcement); H1 at text-6xl md:text-7xl lg:text-[5.5rem] font-display italic leading-[0.85] tracking-[-3px] max-w-4xl; muted subtext max-w-xl; two CTAs: liquid-glass-strong rounded-full px-8 py-3.5 primary + text-only secondary with lucide:play icon.
3) PARTNERS — centered: glass badge "trusted by" style label, then a row of 5 customer wordmarks in font-display italic text-2xl md:text-3xl text-ink gap-12 (use CUSTOMER NAMES if provided).
4) HOW-IT-WORKS BAND — relative py-40 overflow-hidden: BAND_BG absolute inset-0 object-cover; 200px fades top AND bottom (bg-gradient-to-b/t from-base to-transparent); centered z-10: glass badge, serif italic heading, subtext, one glass CTA.
5) FEATURE ROWS — two alternating rows (lg:flex-row / lg:flex-row-reverse, gap-12, py-24): text side (H3 serif italic text-3xl md:text-4xl, muted paragraph, liquid-glass-strong pill button) + image side (DETAIL_1 / DETAIL_2 inside liquid-glass rounded-2xl overflow-hidden, img hover:scale-105 transition-transform duration-700).
6) FEATURE GRID — 4 cards, grid md:grid-cols-2 lg:grid-cols-4 gap-6: each liquid-glass rounded-2xl p-6 with an <iconify-icon> in a liquid-glass-strong w-10 h-10 rounded-full grid place-items-center circle, serif italic text-lg title, muted text-sm description.
7) STATS — one liquid-glass rounded-3xl p-12 md:p-16 panel, grid grid-cols-2 lg:grid-cols-4 gap-8 text-center: values text-5xl md:text-6xl font-display italic, labels text-muted text-sm.
8) TESTIMONIALS — 3 liquid-glass rounded-2xl p-8 cards: italic quote text-ink/80 text-sm, name font-medium text-sm, role text-muted text-xs.
9) CTA FOOTER — relative py-40 overflow-hidden: CTA_BG behind with fades like section 4; huge serif italic heading text-5xl md:text-7xl; subtext; liquid-glass-strong button + solid white button. Footer bar: mt-24 pt-8 border-t border-white/10 flex justify-between text-white/40 text-xs (copyright + 3 links).`
  },

  // 3 ── Serif Cinema — cinematic full-bleed hero, luxury/brand
  {
    id: 'sig-serif-cinema',
    name: 'Serif Cinema',
    platforms: ['web'],
    thumbnail: '/skills/sig-serif-cinema.png',
    dna: {
      id: 'sig-serif-cinema',
      name: 'Serif Cinema',
      theme: 'dark',
      bestFor: ['luxury', 'hospitality', 'travel', 'yacht', 'real estate', 'architecture', 'fashion', 'wellness brand', 'private club', 'jewelry'],
      tokens: {
        base: '#071219', surface: '#0C1B26', raised: '#12242F', line: '#1E3440',
        ink: '#F5F8FA', muted: '#94A7B3', accent: '#F5F8FA', accentInk: '#071219',
        accent2: '#7FA0B5'
      },
      fonts: {
        display: 'Instrument Serif', body: 'Inter', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&family=IBM+Plex+Mono:wght@400&display=swap'
      },
      radius: '1.25rem',
      shadow: 'none — light, photography and thin white/10 hairlines carry all depth',
      rules: [
        'Cinema, not commerce: one full-bleed photograph per band, always with a slow Ken Burns pan (v3-kenburns) and gradient fades into the base color.',
        'Headlines are enormous Instrument Serif at font-normal (never bold): text-6xl up to text-9xl, leading-[0.95], tracking-[-0.02em], with one or two words in italic text-ink/60 for contrast.',
        'Eyebrow labels: text-xs uppercase tracking-[0.3em] text-muted above every heading.',
        'Whitespace is the luxury: py-32 md:py-44 sections, max-w-6xl containers.',
        'Buttons: solid white pill (px-10 py-4 bg-white text-base-token rounded-full hover:scale-[1.03]) or ghost with border-white/20.',
        'NEVER use: bold display type, colored accents, glassmorphism cards everywhere, busy grids, emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'cinematic photography, dramatic natural light, muted film tones, editorial magazine still, shallow depth of field, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_BG', w: 1600, h: 1000, alt: 'Hero scene', prompt: 'breathtaking wide cinematic photograph of {SUBJECT}, golden hour or blue hour, vast scale, human presence small in frame' },
      { slot: 'FEATURE_BG', w: 1600, h: 900, alt: 'Featured scene', prompt: 'immersive photograph of the {SUBJECT} experience, rich atmosphere, motion implied' },
      { slot: 'SIDE_IMG', w: 1200, h: 900, alt: 'Detail scene', prompt: 'intimate detail photograph of {SUBJECT}, texture and craft, close focus' },
      { slot: 'CTA_BG', w: 1600, h: 900, alt: 'Closing scene', prompt: 'serene wide photograph evoking the promise of {SUBJECT}, horizon, calm' }
    ],
    specBlock: (images) => `SIGNATURE TEMPLATE: "Serif Cinema" (locked page architecture — cinematic luxury landing)

${PRODUCT_RULES}

Include this <style> block VERBATIM at the top of the fragment:
${FX_CSS}

IMAGES (use these EXACT URLs):
- HERO_BG: ${images.HERO_BG.url}
- FEATURE_BG: ${images.FEATURE_BG.url}
- SIDE_IMG: ${images.SIDE_IMG.url}
- CTA_BG: ${images.CTA_BG.url}

PAGE ARCHITECTURE (single page, bg-base, in this order):
1) HERO — relative h-screen overflow-hidden: HERO_BG absolute inset-0 <img> object-cover v3-kenburns; overlay bg-black/25; bottom fade h-64 bg-gradient-to-t from-base to-transparent. Nav (relative z-20, flex justify-between px-8 py-6 max-w-7xl mx-auto): wordmark in font-display text-3xl tracking-tight with a <sup class="text-xs">®</sup>; 5 links text-sm text-ink/70 hover:text-ink (hidden md:flex gap-8); one liquid-glass rounded-full px-6 py-2.5 text-sm CTA. Hero content (relative z-10, centered text-center, pt-28): eyebrow label; H1 text-5xl sm:text-7xl md:text-8xl font-display font-normal leading-[0.95] tracking-[-2px] max-w-5xl with 1-2 words in italic text-ink/60; subtext text-base sm:text-lg text-muted max-w-2xl mt-8 leading-relaxed; solid white pill CTA (px-14 py-5 rounded-full bg-white hover:scale-[1.03] transition-transform) mt-12, style color with text-[#071219]-equivalent via text-accentInk token class... use class "bg-white text-black".
2) MANIFESTO — py-32 md:py-44 max-w-4xl mx-auto px-6: eyebrow; a single large statement at text-3xl md:text-5xl font-display leading-[1.15] with italic muted phrases; thin border-t border-line divider above.
3) FEATURED BAND — px-6 max-w-6xl mx-auto: rounded-3xl overflow-hidden relative aspect-video with FEATURE_BG object-cover; gradient bg-gradient-to-t from-black/60 via-transparent; overlay content absolute bottom-0 inset-x-0 p-6 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6: a liquid-glass rounded-2xl p-6 md:p-8 max-w-md card (eyebrow + short paragraph) and a liquid-glass rounded-full px-8 py-3 button.
4) PHILOSOPHY — py-32 max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center: SIDE_IMG in rounded-3xl overflow-hidden aspect-[4/3]; right side two text blocks (eyebrow + paragraph each) separated by a w-full h-px bg-white/10 divider.
5) NUMBERS — py-24: three stats in a row (values text-5xl md:text-6xl font-display, labels eyebrow style), separated by vertical hairlines on desktop.
6) CTA — relative py-40 overflow-hidden: CTA_BG absolute inset-0 object-cover with top and bottom fades into base; centered z-10: eyebrow, serif heading text-5xl md:text-7xl with italic accent word, solid white pill CTA + ghost border-white/20 secondary. Footer: pt-8 border-t border-white/10 max-w-6xl mx-auto flex justify-between text-ink/40 text-xs, plus a small pulsing green availability dot (h-2 w-2 rounded-full bg-green-400 animate-pulse) with a short status line.`
  },

  // 4 ── Gradient Grow — colossal gradient headline, bold AI/SaaS
  {
    id: 'sig-gradient-grow',
    name: 'Gradient Grow',
    platforms: ['web'],
    thumbnail: '/skills/sig-gradient-grow.png',
    dna: {
      id: 'sig-gradient-grow',
      name: 'Gradient Grow',
      theme: 'dark',
      bestFor: ['ai startup', 'saas', 'developer tool', 'analytics', 'recruiting', 'automation', 'data platform', 'bold tech'],
      tokens: {
        base: '#06031A', surface: '#0D0926', raised: '#151033', line: '#251D4A',
        ink: '#F2F1F5', muted: '#8E8AA8', accent: '#6366F1', accentInk: '#FFFFFF',
        accent2: '#FCD34D'
      },
      fonts: {
        display: 'Geist', body: 'Geist', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
      },
      radius: '1rem',
      shadow: 'none — glow blobs and glass provide depth',
      rules: [
        'ONE colossal word (or two) is the entire hero: text-[clamp(6rem,18vw,13rem)] font-normal leading-[1.02] tracking-[-0.024em], with the key word gradient-filled (bg-clip-text text-transparent, linear-gradient to the left from indigo #6366f1 via purple #a855f7 to amber #fcd34d as an inline style).',
        'A huge blurred glow blob sits behind the hero content (absolute centered, ~900x500px, rounded-full, bg-accent/20 blur-[120px], pointer-events-none).',
        'Nav is full-width with a 1px gradient hairline below it (h-px bg-gradient-to-r from-transparent via-white/20 to-transparent).',
        'Glass pills (liquid-glass) for secondary buttons and logo chips; body text stays airy font-light.',
        'Logo marquee anchors the hero bottom: static claim on the left, infinite v3-marquee of wordmark chips on the right.',
        'NEVER use: busy multi-column heroes, more than one gradient element per viewport, borders on cards (use glass), emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'dark abstract 3d render, indigo and violet ambient glow, smooth flowing shapes, premium tech aesthetic, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_BG', w: 1600, h: 900, alt: 'Ambient backdrop', prompt: 'abstract dark scene evoking {SUBJECT}, soft glowing shapes rising, lots of negative space' },
      { slot: 'PRODUCT_BG', w: 1600, h: 1000, alt: 'Product ambience', prompt: 'dark abstract environment suggesting the power of {SUBJECT}, energy flowing upward' }
    ],
    specBlock: (images) => `SIGNATURE TEMPLATE: "Gradient Grow" (locked page architecture — colossal-headline dark SaaS hero)

${PRODUCT_RULES}

Include this <style> block VERBATIM at the top of the fragment:
${FX_CSS}

IMAGES (use these EXACT URLs):
- HERO_BG: ${images.HERO_BG.url}
- PRODUCT_BG: ${images.PRODUCT_BG.url}

PAGE ARCHITECTURE (single page, bg-base, in this order):
1) NAVBAR — w-full py-5 px-8 flex items-center justify-between: text wordmark left (font-medium tracking-tight); center links (hidden md:flex gap-8, two of them with <iconify-icon icon="lucide:chevron-down" class="text-xs"></iconify-icon>); right liquid-glass rounded-full px-4 py-2 text-sm "Sign up"-style button. Directly below: <div class="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>.
2) HERO — relative min-h-screen flex flex-col overflow-hidden: HERO_BG absolute inset-0 object-cover opacity-40 v3-kenburns; the glow blob (absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] rounded-full blur-[120px] pointer-events-none, background bg-accent/20). Centered content (flex-1 grid place-items-center z-10 text-center px-4): the colossal headline — ONE short product word plain text-ink plus ONE gradient word using <span class="bg-clip-text text-transparent" style="background-image:linear-gradient(to left,#6366f1,#a855f7,#fcd34d)">…</span>, at text-[clamp(6rem,18vw,13rem)] font-normal leading-[1.02] tracking-[-0.024em]; subtitle text-lg leading-8 max-w-md mx-auto text-muted opacity-80 mt-3 (two lines split with <br/>); CTA liquid-glass rounded-full px-8 py-5 text-base mt-8.
3) LOGO MARQUEE — pinned to hero bottom (pb-10, max-w-5xl mx-auto w-full flex items-center gap-12 z-10): left static text-muted text-sm two-line claim (whitespace-nowrap shrink-0); right overflow-hidden with a v3-marquee row of 6 brand chips DUPLICATED twice for a seamless loop — each chip = liquid-glass w-6 h-6 rounded-lg grid place-items-center first letter + name text-base font-semibold, gap-16 between chips.
4) PRODUCT BAND — relative py-32 overflow-hidden: PRODUCT_BG absolute inset-0 object-cover opacity-50 with 200px top/bottom fades to base; centered z-10 max-w-5xl: a liquid-glass rounded-2xl p-3 frame containing a HAND-CODED mini product interface (dashboard/table/editor relevant to THIS product, 20-30 lines, realistic data, text-[11px], pointer-events-none) — never a stock screenshot.
5) FEATURES — max-w-6xl mx-auto grid md:grid-cols-3 gap-6 py-24: three liquid-glass rounded-2xl p-8 cards, each with an iconify icon in a glass circle, font-medium title, muted description.
6) CTA + FOOTER — centered py-24: heading text-4xl md:text-6xl font-normal tracking-tight with one gradient word (same inline gradient), sub, one glass CTA; footer bar border-t border-white/10 pt-8 flex justify-between text-white/40 text-xs.`
  },

  // 5 ── Editorial Light — white editorial SaaS with serif accent + coded dashboard
  {
    id: 'sig-editorial-light',
    name: 'Editorial Light',
    platforms: ['web'],
    thumbnail: '/skills/sig-editorial-light.png',
    dna: {
      id: 'sig-editorial-light',
      name: 'Editorial Light',
      theme: 'light',
      bestFor: ['saas', 'productivity', 'hr', 'fintech', 'b2b platform', 'remote work', 'project management', 'newsletter', 'automation'],
      tokens: {
        base: '#FFFFFF', surface: '#FCFCFC', raised: '#F4F4F2', line: '#E8E8E4',
        ink: '#14161C', muted: '#6B7080', accent: '#14161C', accentInk: '#FFFFFF',
        accent2: '#6366F1'
      },
      fonts: {
        display: 'Geist', body: 'Geist', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Instrument+Serif:ital@0;1&family=IBM+Plex+Mono:wght@400&display=swap'
      },
      radius: '1.25rem',
      shadow: 'soft and expensive: shadow-[0_10px_40px_5px_rgba(194,194,194,0.25)] on the capture pill; shadow-[0_25px_80px_-12px_rgba(0,0,0,0.08)] on the dashboard frame',
      rules: [
        "The signature move: sans headline with EXACTLY ONE word swapped into Instrument Serif italic at ~1.2em via <em style=\"font-family:'Instrument Serif',serif\" class=\"italic font-normal\">…</em>.",
        'Headline: text-6xl md:text-[80px] font-medium tracking-[-0.04em] leading-[1.02], centered, ink on white.',
        'A soft pale backdrop image fades into pure white behind the hero (gradient overlay from transparent 25% to white 65%) — the page always ends up white.',
        'Primary CTA is glossy black: rounded-full bg-ink text-white with inner-shadow gloss shadow-[inset_-4px_-6px_25px_0px_rgba(201,201,201,0.08),inset_4px_4px_10px_0px_rgba(29,29,29,0.24)].',
        'Email capture pill: rounded-[40px] bg-[#fcfcfc] border border-line shadow-[0_10px_40px_5px_rgba(194,194,194,0.25)] with a transparent input + the glossy CTA inside.',
        'The product IS the hero visual: a frosted rounded-2xl dashboard frame (bg-white/40 border border-white/50) holding a fully hand-coded mini interface, clipped by the hero bottom.',
        'NEVER use: dark sections, glassmorphism-on-dark, more than one serif italic word per heading, emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'soft pale abstract, high key, airy light tones, gentle gradients of sky and cream, minimal, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_BG', w: 1600, h: 700, alt: 'Soft backdrop', prompt: 'soft abstract light atmosphere evoking calm productivity for {SUBJECT}, pale tones, airy' }
    ],
    specBlock: (images) => `SIGNATURE TEMPLATE: "Editorial Light" (locked page architecture — white editorial SaaS hero)

${PRODUCT_RULES}

IMAGES (use this EXACT URL):
- HERO_BG: ${images.HERO_BG.url}

PAGE ARCHITECTURE (single page, bg-base, in this order):
1) NAVBAR — flex items-center justify-between px-6 md:px-12 lg:px-20 py-5: wordmark text-xl font-semibold tracking-tight; right (hidden md:flex gap-8) 4 links text-sm text-muted hover:text-ink; glossy black pill CTA (rounded-full px-5 py-2.5 text-sm font-medium bg-ink text-white with the gloss inner shadows from the DNA rules).
2) HERO — relative overflow-hidden text-center pt-24 md:pt-32 pb-0: HERO_BG as absolute top-0 inset-x-0 h-[70%] <img> object-cover; over it a gradient div (absolute inset-0 bg-gradient-to-b from-transparent from-[25%] to-white to-[65%]). Content relative z-10 max-w-[1200px] mx-auto px-6 flex flex-col items-center gap-8:
   - Reviews badge: inline-flex items-center gap-2 text-sm text-muted — five <iconify-icon icon="lucide:star" class="text-amber-500 text-sm"></iconify-icon> + a "1,020+ reviews"-style claim from the copy.
   - Headline: text-6xl md:text-[80px] font-medium tracking-[-0.04em] leading-[1.02] with EXACTLY ONE word as <em style="font-family:'Instrument Serif',serif" class="italic font-normal text-[1.15em]">word</em>.
   - Description: text-lg text-[#373a46]/80 max-w-[554px] leading-relaxed.
   - Email capture pill: max-w-xl w-full rounded-[40px] bg-[#fcfcfc] border border-line shadow-[0_10px_40px_5px_rgba(194,194,194,0.25)] p-2 pl-6 flex items-center gap-3 — transparent input (placeholder from copy) + glossy black pill button "Create Free Account"-style with the inner-shadow gloss.
3) DASHBOARD PREVIEW — still inside the hero flow, mt-10 w-full max-w-5xl mx-auto: frosted frame (rounded-2xl p-3 md:p-4, bg-white/40 border border-white/50, shadow-[0_25px_80px_-12px_rgba(0,0,0,0.08)]) containing a HAND-CODED mini product interface for THIS product (top bar with logo + search + avatar; slim sidebar; greeting; stat cards with tabular-nums amounts and small green/red deltas; an SVG or Chart.js area chart in a h-20 wrapper; a 4-row table with status badges) — text-[11px] select-none pointer-events-none, realistic data, never an image. The hero section has overflow-hidden so the frame is clipped at the bottom edge.
4) LOGOS — py-16 text-center: small text-muted claim + row of 5-6 grayscale text wordmarks (font-semibold text-lg text-ink/40), gap-12.
5) FEATURES — max-w-6xl mx-auto grid md:grid-cols-3 gap-6 py-20: bg-raised rounded-2xl p-8 cards with icon chip (h-10 w-10 rounded-xl bg-white grid place-items-center border border-line), font-medium title, muted text-sm body.
6) CTA + FOOTER — py-24 text-center: heading with the single serif italic word again; one glossy black pill CTA; footer border-t border-line pt-8 flex justify-between text-muted text-xs max-w-6xl mx-auto.`
  },

  // 6 ── Neon Grotesk — Anton + neon cursive on deep space navy (web3/culture)
  {
    id: 'sig-neon-grotesk',
    name: 'Neon Grotesk',
    platforms: ['web'],
    thumbnail: '/skills/sig-neon-grotesk.png',
    dna: {
      id: 'sig-neon-grotesk',
      name: 'Neon Grotesk',
      theme: 'dark',
      bestFor: ['nft', 'web3', 'crypto', 'gaming', 'music', 'events', 'streetwear', 'creator', 'community', 'festival'],
      tokens: {
        base: '#010828', surface: '#071033', raised: '#0D1840', line: '#1B2B5E',
        ink: '#EFF4FF', muted: '#8B97C6', accent: '#6FFF00', accentInk: '#010828',
        accent2: '#B724FF'
      },
      fonts: {
        display: 'Anton', body: 'Space Grotesk', mono: 'IBM Plex Mono',
        googleUrl: 'https://fonts.googleapis.com/css2?family=Anton&family=Condiment&family=Space+Grotesk:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap'
      },
      radius: '2rem',
      shadow: 'none — glass borders and neon accents carry all depth',
      rules: [
        'All display type is Anton (font-display), UPPERCASE, leading-[1.05] mobile / leading-[1] desktop, sized 40px→90px responsive.',
        "The signature move: a hand-written accent phrase OVERLAYS each big heading — <span style=\"font-family:'Condiment',cursive\" class=\"absolute text-accent mix-blend-exclusion -rotate-1 opacity-90\">…</span>, positioned absolute to the heading's right or bottom-right, at 0.5-0.7x the heading size, normal-case.",
        'Body/meta text is Space Grotesk or IBM Plex Mono text-xs-sm uppercase, cream (text-ink) at various opacities; decorative ghost paragraphs at opacity-10 are encouraged.',
        'Cards are liquid-glass rounded-[32px] p-[18px] with inner media at rounded-[24px]; overlay bars are glass rounded-[20px].',
        'ONE neon element per section maximum beyond the cursive overlays: an underline bar (h-2 bg-accent) or a hover:text-accent state.',
        'The circular action button: w-12 h-12 rounded-full bg-gradient-to-br from-accent2 to-[#7c3aed] shadow-lg shadow-purple-500/50 hover:scale-110 transition with a white lucide:chevron-right icon.',
        'NEVER use: rounded-sm corners, serif fonts, light backgrounds, more than two accent colors, emoji, splash screens or loaders.'
      ]
    },
    imageStyle: 'dark cosmic space scene, deep navy nebula, cinematic 3d render, glowing luminous details, otherworldly, no text, no watermark',
    imageSlots: [
      { slot: 'HERO_BG', w: 1600, h: 900, alt: 'Hero cosmos', prompt: 'vast cosmic environment evoking {SUBJECT}, glowing central object, deep space' },
      { slot: 'ABOUT_BG', w: 1600, h: 900, alt: 'About cosmos', prompt: 'drifting through an abstract universe related to {SUBJECT}, calm, particles' },
      { slot: 'TILE_1', w: 900, h: 900, alt: 'Collection item 1', prompt: 'square hero object #1 for {SUBJECT}, floating luminous artifact, centered' },
      { slot: 'TILE_2', w: 900, h: 900, alt: 'Collection item 2', prompt: 'square hero object #2 for {SUBJECT}, different form and glow color, centered' },
      { slot: 'TILE_3', w: 900, h: 900, alt: 'Collection item 3', prompt: 'square hero object #3 for {SUBJECT}, crystalline structure, centered' },
      { slot: 'CTA_BG', w: 1600, h: 700, alt: 'Closing cosmos', prompt: 'wide cosmic horizon with a rising light, evoking joining {SUBJECT}' }
    ],
    specBlock: (images) => `SIGNATURE TEMPLATE: "Neon Grotesk" (locked page architecture — dark space culture landing)

${PRODUCT_RULES}

Include this <style> block VERBATIM at the top of the fragment:
${FX_CSS}

IMAGES (use these EXACT URLs):
- HERO_BG: ${images.HERO_BG.url}
- ABOUT_BG: ${images.ABOUT_BG.url}
- TILE_1 / TILE_2 / TILE_3: ${images.TILE_1.url} , ${images.TILE_2.url} , ${images.TILE_3.url}
- CTA_BG: ${images.CTA_BG.url}

PAGE ARCHITECTURE (single page, bg-base, max content width max-w-[1831px] mx-auto per section, in this order):
1) SECTION 1 — HERO (full viewport, rounded-b-[32px] overflow-hidden relative): HERO_BG absolute inset-0 object-cover v3-kenburns. Header (relative z-10 flex items-center justify-between px-6 md:px-10 pt-6): wordmark font-display uppercase text-base; centered nav pill (hidden lg:flex, liquid-glass rounded-[28px] px-[52px] py-[24px] gap-8) with 5 font-display uppercase text-[13px] links hover:text-accent transition-colors; right column (hidden lg:flex flex-col gap-3) of 3 liquid-glass w-14 h-14 rounded-[1rem] grid place-items-center buttons with lucide:mail / lucide:twitter / lucide:github iconify icons hover:bg-white/10. Hero content (relative z-10 mt-24 md:mt-32 px-6 md:px-10): H1 font-display uppercase text-[40px] sm:text-[60px] md:text-[75px] lg:text-[90px] leading-[1.05] md:leading-[1] max-w-[780px] lg:ml-32 over two/three lines, wrapped in a relative container with the Condiment cursive overlay phrase (per DNA rules) positioned absolute right-0 bottom-0 translate-y-1/2 text-2xl md:text-5xl.
2) SECTION 2 — ABOUT (full viewport relative overflow-hidden): ABOUT_BG absolute inset-0 object-cover. Top row (relative z-10 flex flex-col lg:flex-row justify-between gap-10 px-6 md:px-10 py-24): left H2 font-display uppercase text-[32px] md:text-[60px] with cursive overlay; right a font-mono text-sm md:text-base uppercase text-ink max-w-[266px] paragraph. Bottom row: two columns of the same mono paragraph repeated at opacity-10 as pure decoration (right column hidden lg:block).
3) SECTION 3 — COLLECTION GRID (solid bg-base py-24 px-6 md:px-10): header row flex justify-between items-end — left H2 font-display uppercase text-[32px] md:text-[60px] over two lines (second line indented ml-12 md:ml-32) with ONE word in cursive text-accent; right a "see all"-style composite button: big font-display word text-[32px] md:text-[60px] + two stacked smaller words, with an h-2 md:h-2.5 w-full bg-accent bar underneath. Grid (grid md:grid-cols-2 lg:grid-cols-3 gap-6 mt-16): three liquid-glass rounded-[32px] p-[18px] hover:bg-white/10 transition cards — square media (aspect-square rounded-[24px] overflow-hidden, TILE_n object-cover hover:scale-105 transition-transform duration-700) + overlay bar (liquid-glass rounded-[20px] px-5 py-4 mt-4 flex items-center justify-between): mono uppercase text-[11px] text-ink/70 label + text-base value, and the circular gradient action button from the DNA rules.
4) SECTION 4 — CTA (relative overflow-hidden): CTA_BG as w-full h-auto block <img>; overlay content absolute inset-0 flex flex-col justify-center items-end pr-[8%] lg:pr-[20%]: cursive accent phrase absolute top-[18%] left-[15%] text-2xl md:text-6xl text-accent mix-blend-exclusion; H2 font-display uppercase text-right text-[24px] md:text-[60px] leading-[1.05] of FOUR short punch lines (first line mb-4 md:mb-12). Bottom-left absolute left-[8%] bottom-[12%]: a vertical liquid-glass rounded-[1.25rem] overflow-hidden stack of 3 icon buttons (px-10 py-5 each, divided by border-b border-white/10, last one without). Footer bar below the image: py-8 px-6 md:px-10 flex justify-between text-ink/40 text-xs font-mono uppercase.`
  }
];

export function getSignature(id) {
  return SIGNATURES.find(s => s.id === id) || null;
}

function sigFitScore(sig, text = '') {
  const t = String(text).toLowerCase();
  let score = 0;
  for (const kw of sig.dna.bestFor) {
    const words = kw.split(/\s+/);
    if (words.some(w => w.length > 3 && t.includes(w))) score++;
  }
  return score;
}

/**
 * Style-question options for signatures (same shape as DNA options).
 * Ranked by prompt fit; capped so regular DNAs still get slots.
 */
export function signatureStyleOptions(prompt = '', limit = 2) {
  return [...SIGNATURES]
    .sort((a, b) => sigFitScore(b, prompt) - sigFitScore(a, prompt))
    .slice(0, limit)
    .map(s => ({
      label: s.name,
      dnaId: s.id,
      theme: s.dna.theme,
      thumbnail: s.thumbnail || null,
      swatch: { bg: s.dna.tokens.base, surface: s.dna.tokens.surface, ink: s.dna.tokens.ink, accent: s.dna.tokens.accent },
      fonts: { display: s.dna.fonts.display, body: s.dna.fonts.body }
    }));
}
