/**
 * agentic-v3/runtime.js
 *
 * Deterministic HTML document shell. The model only writes <body> content;
 * the head (fonts, Tailwind config with DNA tokens, Alpine, icons, charts)
 * is generated here — identical across every screen of a set, and it can
 * never contain a model mistake.
 */

const TAILWIND_CDN = 'https://cdn.tailwindcss.com';
const ALPINE_CDN = 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js';
const ICONIFY_CDN = 'https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js';
const CHARTJS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js';
const LENIS_CDN = 'https://cdn.jsdelivr.net/npm/lenis@1.3.4/dist/lenis.min.js';

export function buildTailwindConfig(dna) {
  return {
    theme: {
      extend: {
        colors: {
          base: dna.tokens.base,
          surface: dna.tokens.surface,
          raised: dna.tokens.raised,
          line: dna.tokens.line,
          ink: dna.tokens.ink,
          muted: dna.tokens.muted,
          accent: dna.tokens.accent,
          accentInk: dna.tokens.accentInk,
          accent2: dna.tokens.accent2
        },
        fontFamily: {
          display: [dna.fonts.display, 'sans-serif'],
          body: [dna.fonts.body, 'sans-serif'],
          mono: [dna.fonts.mono, 'monospace']
        },
        borderRadius: { card: dna.radius }
      }
    }
  };
}

/**
 * Wrap model-generated body HTML in the full standalone document.
 * @param {object} dna       — design DNA preset
 * @param {string} bodyHtml  — inner body markup from the composer
 * @param {object} opts      — { title, platform, needsCharts }
 */
export function wrapScreen(dna, bodyHtml, opts = {}) {
  const { title = 'Screen', platform = 'web' } = opts;
  const needsCharts = opts.needsCharts ?? /new Chart\(|<canvas/i.test(bodyHtml);
  const cfg = JSON.stringify(buildTailwindConfig(dna));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<meta name="generator" content="inspoai-v3"/>
<meta name="inspoai-dna" content="${dna.id}"/>
<meta name="inspoai-platform" content="${platform}"/>
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="${dna.fonts.googleUrl}" rel="stylesheet"/>
<script src="${TAILWIND_CDN}"></script>
<script>tailwind.config = ${cfg};</script>
<script src="${ICONIFY_CDN}"></script>
${needsCharts ? `<script src="${CHARTJS_CDN}"></script>` : ''}
<script defer src="${ALPINE_CDN}"></script>
<style>
  html { -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  body { font-family: '${dna.fonts.body}', sans-serif; background: ${dna.tokens.base}; color: ${dna.tokens.ink}; }
  ${platform !== 'web' ? `/* Mobile/tablet guard: nothing may bleed past the device viewport */
  html, body { overflow-x: hidden; max-width: 100%; }` : `/* Canvas embed: the canvas auto-sizes the iframe to the page's full height,
  so 100vh sections would balloon with it (measure → grow → re-expand loop).
  When embedded, pin *-screen sections to a fixed desktop viewport instead. */
  .v3-embedded .h-screen { height: 900px !important; }
  .v3-embedded .min-h-screen { min-height: 900px !important; }`}
  ::selection { background: ${dna.tokens.accent}33; }
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: ${dna.tokens.line}; border-radius: 8px; border: 2px solid ${dna.tokens.base}; }
  ::-webkit-scrollbar-track { background: transparent; }
  iconify-icon { display: inline-block; vertical-align: middle; }
  /* Photos must never distort: cover-crop instead of stretch when a sized
     container disagrees with the image's aspect ratio (browser default is
     "fill"). Images without forced dimensions are unaffected. */
  img { object-fit: cover; }
  [x-cloak] { display: none !important; }
  input, textarea, select, button { font-family: inherit; }
  html { scroll-behavior: smooth; }
  /* Inline text editing (canvas editor only — the shell script arms it when embedded) */
  .v3-editing { outline: 2px dashed ${dna.tokens.accent}; outline-offset: 3px; border-radius: 4px; cursor: text !important; }
  /* Scroll-reveal (auto-applied by the shell script below) */
  @media (prefers-reduced-motion: no-preference) {
    .v3-reveal { opacity: 0; transform: translateY(22px); }
    .v3-reveal.v3-in { opacity: 1; transform: none; transition: opacity 0.65s cubic-bezier(0.22,1,0.36,1), transform 0.65s cubic-bezier(0.22,1,0.36,1); }
    a, button { transition: transform 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease, opacity 0.18s ease; }
  }
</style>
<script>
  // Embedded documents (canvas iframes): the canvas auto-sizes the iframe to
  // the page's full height, so any vh-based sizing would balloon with it
  // (measure -> grow -> re-expand loop). Pin EVERY vh-derived Tailwind class
  // to a fixed 900px reference viewport via inline styles (beats everything).
  // Real tabs (live preview, downloaded code) keep true viewport units.
  // AI-generated images (pollinations renders on demand) can time out or 502
  // under burst load: retry once with a cache-buster, then swap to a stock
  // fallback — a broken-image icon must never ship.
  document.addEventListener('error', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'IMG' || !el.src) return;
    var n = +(el.getAttribute('data-v3-retry') || 0);
    el.setAttribute('data-v3-retry', String(n + 1));
    if (n < 2) {
      // 429s need breathing room: 3s, then 8s, staggered per image
      var src = el.src.replace(/[?&]v3r=\d+/, '');
      var wait = (n === 0 ? 3000 : 8000) + Math.random() * 2000;
      setTimeout(function () { el.src = src + (src.indexOf('?') > -1 ? '&' : '?') + 'v3r=' + Date.now(); }, wait);
    } else {
      var h = 0, s = el.src;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
      el.src = 'https://picsum.photos/seed/v3' + h + '/1200/900';
    }
  }, true);

  window.__v3FixVh = function () {};
  if (window.self !== window.top) {
    document.documentElement.classList.add('v3-embedded');
    window.__v3FixVh = function () {
      var PX_PER_VH = 9; // 900px reference viewport
      document.querySelectorAll('[class]').forEach(function (el) {
        el.classList.forEach(function (c) {
          var m;
          if (/^h-(screen|dvh|svh|lvh)$/.test(c)) el.style.setProperty('height', '900px', 'important');
          else if (/^min-h-(screen|dvh|svh|lvh)$/.test(c)) el.style.setProperty('min-height', '900px', 'important');
          else if (/^max-h-(screen|dvh|svh|lvh)$/.test(c)) el.style.setProperty('max-height', '900px', 'important');
          else if ((m = c.match(/^h-\[(\d+)(?:d|s|l)?vh\]$/))) el.style.setProperty('height', (m[1] * PX_PER_VH) + 'px', 'important');
          else if ((m = c.match(/^min-h-\[(\d+)(?:d|s|l)?vh\]$/))) el.style.setProperty('min-height', (m[1] * PX_PER_VH) + 'px', 'important');
          else if ((m = c.match(/^max-h-\[(\d+)(?:d|s|l)?vh\]$/))) el.style.setProperty('max-height', (m[1] * PX_PER_VH) + 'px', 'important');
        });
        // Inline style="...vh" from the model gets the same treatment
        var st = el.getAttribute('style');
        if (st && /\d(?:d|s|l)?vh\b/.test(st)) {
          el.setAttribute('style', st.replace(/(\d+(?:\.\d+)?)(?:d|s|l)?vh\b/g, function (_, n) { return (parseFloat(n) * PX_PER_VH) + 'px'; }));
        }
      });
    };
    addEventListener('DOMContentLoaded', window.__v3FixVh);

    // Inline text editing: double-click any pure-text element to edit it in
    // place. On commit the new text is posted to the canvas, which patches the
    // stored document (the live DOM already shows the edit — no reload).
    var v3EditEl = null, v3EditOrig = '', v3EditOrigHtml = '', v3EditIdx = 0;
    var v3Norm = function (s) { return String(s || '').replace(/\\s+/g, ' ').trim(); };
    // Editable = text with at most <br> line breaks inside (multi-line
    // headlines) — anything with real child markup keeps its styling safe.
    var v3Editable = function (el) {
      if (!v3Norm(el.textContent)) return false;
      for (var i = 0; i < el.children.length; i++) {
        if (el.children[i].tagName !== 'BR') return false;
      }
      return true;
    };
    function v3EndEdit(commit) {
      var el = v3EditEl; if (!el) return; v3EditEl = null;
      el.removeAttribute('contenteditable');
      el.classList.remove('v3-editing');
      if (!commit) { el.innerHTML = v3EditOrigHtml; return; }
      if (el.innerHTML === v3EditOrigHtml) return;
      parent.postMessage({
        type: 'v3-edit',
        tag: el.tagName.toLowerCase(),
        origText: v3EditOrig,
        newText: el.textContent,
        newHtml: el.innerHTML,
        matchIndex: v3EditIdx
      }, '*');
    }
    document.addEventListener('dblclick', function (e) {
      var t = e.target && e.target.closest && e.target.closest('h1,h2,h3,h4,h5,h6,p,a,button,span,li,td,th,dt,dd,blockquote,figcaption,label,legend,summary');
      if (!t || t === v3EditEl) return;
      if (!v3Editable(t)) return;
      e.preventDefault(); e.stopPropagation();
      if (v3EditEl) v3EndEdit(true);
      v3EditEl = t; v3EditOrig = t.textContent; v3EditOrigHtml = t.innerHTML;
      // Which duplicate is this? (e.g. two "Learn more" buttons) — lets the
      // canvas patch the right one in the source document.
      var same = [].filter.call(document.querySelectorAll(t.tagName), function (n) {
        return v3Editable(n) && v3Norm(n.textContent) === v3Norm(v3EditOrig);
      });
      v3EditIdx = Math.max(0, [].indexOf.call(same, t));
      try { t.contentEditable = 'plaintext-only'; } catch (_) { t.contentEditable = 'true'; }
      t.classList.add('v3-editing');
      t.focus();
    }, true);
    document.addEventListener('focusout', function (e) { if (v3EditEl && e.target === v3EditEl) v3EndEdit(true); }, true);
    document.addEventListener('keydown', function (e) {
      if (!v3EditEl) return;
      if (e.key === 'Escape') { e.preventDefault(); v3EndEdit(false); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); v3EditEl.blur(); }
    }, true);
    // While editing a link/button, a click must not navigate or toggle anything
    document.addEventListener('click', function (e) {
      if (v3EditEl && v3EditEl.contains(e.target)) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }
  // Live-build channel: the canvas injects streamed body updates without
  // reloading the document (a reload would re-fetch Tailwind/fonts each time).
  addEventListener('message', (e) => {
    if (e.data && e.data.type === 'v3-body' && typeof e.data.html === 'string') {
      document.body.innerHTML = e.data.html;
      window.__v3FixVh();
    } else if (e.data && e.data.type === 'v3-html' && typeof e.data.html === 'string') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(e.data.html, 'text/html');
        
        // 1. Update body contents
        document.body.innerHTML = doc.body.innerHTML;
        document.body.className = doc.body.className;
        if (doc.body.style.cssText) {
          document.body.style.cssText = doc.body.style.cssText;
        }
        
        // 2. Update Tailwind config dynamically
        const configScript = doc.querySelector('script:not([src])');
        if (configScript && window.tailwind) {
          try {
            const match = configScript.innerHTML.match(/tailwind\.config\s*=\s*([\s\S]*)/);
            if (match) {
              const configObj = new Function('return ' + match[1].trim())();
              tailwind.config = configObj;
            }
          } catch (err) {
            console.error('Tailwind config re-evaluation failed:', err);
          }
        }
        
        // 3. Update Google Fonts link
        const oldFontLink = document.querySelector('link[href*="fonts.googleapis.com"]');
        const newFontLink = doc.querySelector('link[href*="fonts.googleapis.com"]');
        if (oldFontLink && newFontLink) {
          oldFontLink.href = newFontLink.href;
        }
        
        // 4. Update head style tag (scrollbars, selection colors)
        const oldStyle = document.querySelector('style');
        const newStyle = doc.querySelector('style');
        if (oldStyle && newStyle) {
          oldStyle.innerHTML = newStyle.innerHTML;
        }
        window.__v3FixVh();
      } catch (err) {
        console.error('v3-html instant retheme failed:', err);
      }
    }
  });
</script>
<script>
  // Framer-motion-style entrance: top-level sections/cards fade-slide in with
  // a stagger as they scroll into view; on marketing pages each section's own
  // content (headlines, copy, images, cards) staggers in too. Deterministic —
  // never model-written.
  addEventListener('DOMContentLoaded', () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // App chrome (sidebars, navs, tab bars, headers) must NEVER be animated —
    // only page content. In app shells animate the main column's children;
    // on marketing pages animate top-level sections.
    const isAppShell = !!document.querySelector('aside, [class*="h-screen"]');
    let targets;
    if (isAppShell) {
      const main = document.querySelector('main') || document.body;
      targets = Array.from(main.children).filter(el => !['HEADER', 'NAV', 'ASIDE'].includes(el.tagName));
      // If main has a single content wrapper, animate its children instead
      if (targets.length === 1 && targets[0].children.length > 1) targets = Array.from(targets[0].children);
    } else {
      const roots = document.querySelectorAll('body > section, body > footer, body > div > section, body > div > footer, main > section');
      targets = roots.length > 1 ? Array.from(roots) : [];
    }
    // Marketing sections: stagger the section's content row-by-row. Descend
    // through single-wrapper containers to the real content children.
    const markChildren = (section) => {
      let root = section;
      while (root.children.length === 1 && root.children[0].children.length) root = root.children[0];
      const kids = Array.from(root.children).filter(k => !['SCRIPT', 'STYLE'].includes(k.tagName)).slice(0, 10);
      if (kids.length < 2) return;
      kids.forEach((k, i) => {
        k.classList.add('v3-reveal');
        k.style.transitionDelay = Math.min(i * 80, 480) + 'ms';
      });
    };
    let order = 0;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        setTimeout(() => {
          el.classList.add('v3-in');
          el.querySelectorAll('.v3-reveal').forEach(k => k.classList.add('v3-in'));
        }, (order++ % 4) * 90);
        io.unobserve(el);
      }
    }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(el => {
      if (['SCRIPT', 'STYLE', 'NAV', 'ASIDE', 'HEADER'].includes(el.tagName)) return;
      el.classList.add('v3-reveal');
      if (!isAppShell) markChildren(el);
      io.observe(el);
    });
    // Safety: anything hidden but already inside the viewport after 1.5s
    // becomes visible. Below-the-fold content stays armed so the reveal
    // still plays when the user scrolls to it.
    setTimeout(() => {
      document.querySelectorAll('.v3-reveal:not(.v3-in)').forEach(el => {
        const r = el.getBoundingClientRect();
        if (r.top < innerHeight && r.bottom > 0) el.classList.add('v3-in');
      });
    }, 1500);
    // Buttery inertia scrolling (Lenis) on marketing pages — app shells keep
    // native scrolling for their inner panels.
    if (!isAppShell && document.body.scrollHeight > innerHeight * 1.2) {
      const s = document.createElement('script');
      s.src = '${LENIS_CDN}';
      s.onload = () => {
        try {
          document.documentElement.style.scrollBehavior = 'auto'; // Lenis replaces CSS smooth scroll
          const lenis = new Lenis({ duration: 1.1, smoothWheel: true, anchors: true });
          const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
          requestAnimationFrame(raf);
        } catch (err) { /* native scrolling still works */ }
      };
      document.head.appendChild(s);
    }
  });
</script>
</head>
<body class="font-body">
${bodyHtml}
</body>
</html>`;
}

export function escapeHtml(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Extract the inner body content back out of a v3 document (for iterate). */
export function extractBody(html = '') {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return m ? m[1].trim() : html;
}

export function isV3Document(html = '') {
  return html.includes('name="generator" content="inspoai-v3"');
}

export function dnaIdFromDocument(html = '') {
  const m = html.match(/name="inspoai-dna" content="([a-z0-9-]+)"/i);
  return m ? m[1] : null;
}
