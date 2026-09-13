/**
 * agentic-v3/test-run.mjs — dev harness.
 *
 * Runs the v3 pipeline directly (no express/auth) and saves each screen
 * as HTML + a Chrome screenshot for visual review.
 *
 * Usage:
 *   node --env-file=.env agentic-v3/test-run.mjs "prompt here" [outDir] [--platform=web|ios] [--theme=light|dark]
 */

import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const prompt = args.find(a => !a.startsWith('--')) || 'A modern SaaS analytics dashboard. you decide';
const outDir = args.filter(a => !a.startsWith('--'))[1] || path.join(process.cwd(), 'agentic-v3', 'out');
const platform = (args.find(a => a.startsWith('--platform=')) || '').split('=')[1] || null;
const theme = (args.find(a => a.startsWith('--theme=')) || '').split('=')[1] || null;

const { runV3Pipeline } = await import('./pipeline.js');

fs.mkdirSync(outDir, { recursive: true });
const screens = [];
let failed = false;

console.log(`\n▶ v3 test run\n  prompt: ${prompt}\n  out: ${outDir}\n`);
const t0 = Date.now();

await runV3Pipeline(
  { prompt, platform, theme, isFollowUp: true, previousContext: null, designChoices: null, visualAssetModeInput: null, requestId: 'test' },
  {
    sendStatus: (s) => console.log(`  · ${s}`),
    sendClarification: (q) => { console.log(`\n Clarification requested (unexpected in test):\n${q}`); failed = true; },
    sendScreenStart: () => {},
    sendScreenComplete: (index, html, _react, title) => {
      const file = path.join(outDir, `screen-${index}-${String(title || '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.html`);
      fs.writeFileSync(file, html);
      screens.push({ index, file, title });
      console.log(`  [OK] screen ${index} "${title}" → ${path.basename(file)} (${(html.length / 1024).toFixed(1)} KB)`);
    },
    sendComplete: (meta) => console.log(`\n[Success] complete in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, JSON.stringify(meta, null, 2)),
    sendError: (e) => { console.error('\n[Error] error:', e); failed = true; }
  }
);

if (failed || !screens.length) process.exit(1);

// ── Screenshots via local Chrome ──
try {
  const puppeteer = (await import('puppeteer-core')).default;
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new'
  });
  const isMobile = platform === 'ios' || screens.some(s => fs.readFileSync(s.file, 'utf8').includes('inspoai-platform" content="ios"'));
  const viewport = isMobile ? { width: 390, height: 844, deviceScaleFactor: 2 } : { width: 1440, height: 900, deviceScaleFactor: 2 };

  for (const s of screens.sort((a, b) => a.index - b.index)) {
    const page = await browser.newPage();
    await page.setViewport(viewport);
    await page.goto(`file://${s.file}`, { waitUntil: 'networkidle0', timeout: 45000 }).catch(() => {});
    await new Promise(r => setTimeout(r, 1800)); // fonts/charts settle
    const png = s.file.replace(/\.html$/, '.png');
    await page.screenshot({ path: png, fullPage: !isMobile });
    console.log(`   ${path.basename(png)}`);
    await page.close();
  }
  await browser.close();
} catch (e) {
  console.warn('[Warning] screenshot step skipped:', e.message);
}
