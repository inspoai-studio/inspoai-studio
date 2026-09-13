/**
 * agentic-v3/patterns.js
 *
 * Section pattern library — hand-written structural Tailwind HTML references.
 * Patterns use the semantic token classes (bg-base, bg-surface, text-ink,
 * text-muted, border-line, bg-accent, ...) so they work under every DNA.
 *
 * The composer receives 2-4 matched patterns as STRUCTURAL references —
 * it adapts them (content, proportions, DNA rules), it does not paste them.
 */

const P = {};

P['nav-desktop'] = {
  match: ['nav', 'navbar', 'header', 'menu'],
  platforms: ['web', 'tablet'],
  html: `
<header class="sticky top-0 z-40 border-b border-line bg-base/90 backdrop-blur-sm">
  <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
    <a class="flex items-center gap-2.5 font-display text-lg font-semibold text-ink" href="#">
      <span class="grid h-7 w-7 place-items-center rounded-card bg-ink text-[13px] font-bold text-base">V</span>
      Vantage
    </a>
    <nav class="hidden items-center gap-8 text-sm text-muted md:flex">
      <a class="text-ink" href="#">Product</a><a class="hover:text-ink" href="#">Pricing</a>
      <a class="hover:text-ink" href="#">Customers</a><a class="hover:text-ink" href="#">Docs</a>
    </nav>
    <div class="flex items-center gap-3">
      <a class="hidden text-sm text-muted hover:text-ink sm:block" href="#">Sign in</a>
      <a class="rounded-card bg-ink px-4 py-2 text-sm font-medium text-base" href="#">Get started</a>
    </div>
  </div>
</header>`
};

P['hero-split'] = {
  match: ['hero', 'landing', 'above the fold', 'header section'],
  platforms: ['web', 'tablet'],
  html: `
<section class="mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-2">
  <div>
    <p class="mb-5 text-xs font-medium uppercase tracking-[0.2em] text-muted">Label · Category</p>
    <h1 class="font-display text-5xl leading-[1.05] tracking-tight text-ink lg:text-6xl">
      Concrete outcome-first headline, seven words max
    </h1>
    <p class="mt-6 max-w-md text-lg leading-relaxed text-muted">One sentence of real value proposition. Specific, no buzzwords, mentions who it is for.</p>
    <div class="mt-9 flex flex-wrap items-center gap-4">
      <a class="rounded-card bg-accent px-6 py-3.5 text-sm font-semibold text-accentInk" href="#">Primary action</a>
      <a class="rounded-card border border-line px-6 py-3.5 text-sm font-medium text-ink" href="#">Secondary</a>
    </div>
    <div class="mt-10 flex items-center gap-6 border-t border-line pt-6 text-sm text-muted">
      <span><strong class="font-semibold text-ink">4,200+</strong> teams</span>
      <span><strong class="font-semibold text-ink">99.98%</strong> uptime</span>
    </div>
  </div>
  <div class="relative">
    <!-- product visual: real screenshot-style card or large photo, NOT abstract blobs -->
    <div class="rounded-card border border-line bg-surface p-4">[detailed product UI mock or image]</div>
  </div>
</section>`
};

P['hero-centered'] = {
  match: ['hero', 'landing', 'announcement', 'launch'],
  platforms: ['web', 'tablet'],
  html: `
<section class="relative mx-auto max-w-4xl px-6 pb-20 pt-28 text-center">
  <a class="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-medium text-muted" href="#">
    <span class="h-1.5 w-1.5 rounded-full bg-accent"></span> Announcement or version tag <iconify-icon icon="lucide:arrow-right"></iconify-icon>
  </a>
  <h1 class="font-display text-6xl leading-[1.02] tracking-tight text-ink">Big claim, then the <em class="italic">one word</em> that matters</h1>
  <p class="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">Supporting sentence with a concrete detail or number that makes it credible.</p>
  <div class="mt-9 flex items-center justify-center gap-4">
    <a class="rounded-card bg-accent px-7 py-3.5 text-sm font-semibold text-accentInk" href="#">Start free</a>
    <a class="text-sm font-medium text-ink underline underline-offset-4" href="#">View demo</a>
  </div>
</section>`
};

P['logo-band'] = {
  match: ['logos', 'trusted by', 'social proof', 'clients', 'partners'],
  platforms: ['web', 'tablet'],
  html: `
<section class="border-y border-line bg-surface">
  <div class="mx-auto max-w-7xl px-6 py-10">
    <p class="mb-6 text-center text-xs uppercase tracking-[0.2em] text-muted">Trusted by teams at</p>
    <div class="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
      <!-- Logos are TEXT WORDMARKS (images break) — vary the treatment per name for realism -->
      <span class="font-display text-lg font-semibold tracking-tight text-muted">Fieldnote</span>
      <span class="font-mono text-sm font-semibold uppercase tracking-[0.15em] text-muted">HALCYON</span>
      <span class="font-display text-lg font-medium italic text-muted">Marlowe&amp;Co</span>
      <!-- 5-6 wordmarks fitting the product's customer profile -->
    </div>
  </div>
</section>`
};

P['feature-bento'] = {
  match: ['features', 'bento', 'capabilities', 'benefits', 'what you get'],
  platforms: ['web', 'tablet'],
  html: `
<section class="mx-auto max-w-7xl px-6 py-24">
  <div class="mb-14 max-w-2xl">
    <p class="mb-4 text-xs font-medium uppercase tracking-[0.2em] text-muted">Features</p>
    <h2 class="font-display text-4xl tracking-tight text-ink">Section headline that states a benefit</h2>
  </div>
  <div class="grid gap-4 md:grid-cols-3">
    <div class="rounded-card border border-line bg-surface p-8 md:col-span-2">
      <!-- big cell: headline + inline product detail (mini table / chart / mock rows) -->
      <h3 class="font-display text-xl font-medium text-ink">Flagship capability</h3>
      <p class="mt-2 max-w-sm text-sm leading-relaxed text-muted">Two lines that explain the mechanism, not the vibe.</p>
      <div class="mt-6 rounded-card border border-line bg-base p-4">[embedded mini-UI: rows, code, or chart]</div>
    </div>
    <div class="rounded-card border border-line bg-surface p-8">
      <iconify-icon class="text-2xl text-accent" icon="lucide:shield-check"></iconify-icon>
      <h3 class="mt-4 font-display text-xl font-medium text-ink">Second feature</h3>
      <p class="mt-2 text-sm leading-relaxed text-muted">Concrete sentence with a number: sync in 40ms, or 14 integrations.</p>
    </div>
    <!-- + 3 more cells varying col-span for rhythm: 1,1,1 then 1,2 -->
  </div>
</section>`
};

P['stats-band'] = {
  match: ['stats', 'metrics', 'numbers', 'impact', 'results'],
  platforms: ['web', 'tablet'],
  html: `
<section class="border-y border-line">
  <div class="mx-auto grid max-w-7xl divide-line px-6 sm:grid-cols-3 sm:divide-x">
    <div class="py-12 sm:px-10 sm:first:pl-0">
      <p class="font-display text-5xl tracking-tight text-ink">38%</p>
      <p class="mt-2 text-sm text-muted">shorter close cycles, measured across 214 finance teams</p>
    </div>
    <!-- 3 stats total; each number precise (38%, 4.9/5, $2.1B), never round marketing numbers -->
  </div>
</section>`
};

P['pricing-3col'] = {
  match: ['pricing', 'plans', 'tiers', 'subscription'],
  platforms: ['web', 'tablet'],
  html: `
<section class="mx-auto max-w-6xl px-6 py-24">
  <div class="mb-14 text-center">
    <h2 class="font-display text-4xl tracking-tight text-ink">Pricing that scales with you</h2>
    <p class="mt-3 text-muted">Start free. No credit card.</p>
  </div>
  <div class="grid gap-5 lg:grid-cols-3">
    <div class="rounded-card border border-line bg-surface p-8">
      <h3 class="text-sm font-semibold text-ink">Starter</h3>
      <p class="mt-4 font-display text-4xl text-ink">$0<span class="text-base text-muted">/mo</span></p>
      <p class="mt-1 text-sm text-muted">For individuals trying it out</p>
      <a class="mt-6 block rounded-card border border-line py-2.5 text-center text-sm font-medium text-ink" href="#">Choose Starter</a>
      <ul class="mt-6 space-y-3 text-sm text-muted">
        <li class="flex gap-2.5"><iconify-icon class="mt-0.5 text-accent" icon="lucide:check"></iconify-icon>3 projects</li>
        <!-- 4-5 SPECIFIC features per tier -->
      </ul>
    </div>
    <!-- middle tier: border-accent ring-1 ring-accent, small "Most popular" pill, bg-accent CTA -->
    <!-- third tier: like first -->
  </div>
</section>`
};

P['testimonial-grid'] = {
  match: ['testimonials', 'reviews', 'quotes', 'customers say'],
  platforms: ['web', 'tablet'],
  html: `
<section class="mx-auto max-w-7xl px-6 py-24">
  <h2 class="mb-12 font-display text-4xl tracking-tight text-ink">What teams are saying</h2>
  <div class="columns-1 gap-5 md:columns-3 [&>figure]:mb-5 [&>figure]:break-inside-avoid">
    <figure class="rounded-card border border-line bg-surface p-7">
      <blockquote class="text-[15px] leading-relaxed text-ink">"Specific, believable quote mentioning an actual workflow detail and a number. Two to three sentences."</blockquote>
      <figcaption class="mt-5 flex items-center gap-3">
        <img alt="" class="h-9 w-9 rounded-full" src="https://api.dicebear.com/9.x/notionists/svg?seed=Priya&backgroundColor=e2dcd2"/>
        <div><p class="text-sm font-medium text-ink">Priya Raman</p><p class="text-xs text-muted">Head of Ops, Northwind</p></div>
      </figcaption>
    </figure>
    <!-- 5-6 cards, varied lengths for masonry rhythm -->
  </div>
</section>`
};

P['cta-band'] = {
  match: ['cta', 'call to action', 'get started', 'closing'],
  platforms: ['web', 'tablet'],
  html: `
<section class="mx-auto max-w-7xl px-6 pb-24">
  <div class="rounded-card bg-ink px-8 py-16 text-center">
    <h2 class="font-display text-4xl tracking-tight text-base">Closing line that echoes the hero promise</h2>
    <p class="mx-auto mt-3 max-w-md text-muted">One short push. Mention the free tier or the time-to-value.</p>
    <a class="mt-8 inline-block rounded-card bg-accent px-7 py-3.5 text-sm font-semibold text-accentInk" href="#">Get started free</a>
  </div>
</section>`
};

P['footer-mega'] = {
  match: ['footer'],
  platforms: ['web', 'tablet'],
  html: `
<footer class="border-t border-line bg-surface">
  <div class="mx-auto grid max-w-7xl gap-10 px-6 py-16 md:grid-cols-5">
    <div class="md:col-span-2">
      <p class="font-display text-lg font-semibold text-ink">Vantage</p>
      <p class="mt-3 max-w-xs text-sm leading-relaxed text-muted">One-line company description.</p>
    </div>
    <div>
      <p class="text-xs font-semibold uppercase tracking-wider text-ink">Product</p>
      <ul class="mt-4 space-y-2.5 text-sm text-muted"><li><a href="#">Overview</a></li><li><a href="#">Pricing</a></li><li><a href="#">Changelog</a></li></ul>
    </div>
    <!-- Company / Resources / Legal columns -->
  </div>
  <div class="border-t border-line py-6 text-center text-xs text-muted">© 2026 Vantage Inc. All rights reserved.</div>
</footer>`
};

P['dashboard-shell'] = {
  match: ['dashboard', 'app shell', 'sidebar', 'admin', 'workspace', 'console'],
  platforms: ['web', 'tablet'],
  html: `
<div class="flex h-screen overflow-hidden bg-base" x-data="{ page: 'overview' }">
  <aside class="hidden w-60 shrink-0 flex-col border-r border-line md:flex">
    <div class="flex h-16 items-center gap-2.5 px-5 font-display font-semibold text-ink">
      <span class="grid h-7 w-7 place-items-center rounded-card bg-ink text-[13px] text-base">V</span> Vantage
    </div>
    <nav class="flex-1 space-y-0.5 px-3 py-2 text-sm">
      <a class="flex items-center gap-3 rounded-card bg-raised px-3 py-2 font-medium text-ink" href="#">
        <iconify-icon icon="lucide:layout-dashboard"></iconify-icon>Overview</a>
      <a class="flex items-center gap-3 rounded-card px-3 py-2 text-muted hover:bg-raised hover:text-ink" href="#">
        <iconify-icon icon="lucide:folder"></iconify-icon>Projects
        <span class="ml-auto rounded-full bg-raised px-2 text-xs">12</span></a>
      <!-- 5-7 items; group with a mt-6 label: text-xs uppercase text-muted px-3 -->
    </nav>
    <div class="border-t border-line p-4">
      <div class="flex items-center gap-3">
        <img alt="" class="h-8 w-8 rounded-full" src="https://api.dicebear.com/9.x/notionists/svg?seed=Marcus"/>
        <div class="text-xs"><p class="font-medium text-ink">Marcus Chen</p><p class="text-muted">marcus@vantage.io</p></div>
      </div>
    </div>
  </aside>
  <main class="flex-1 overflow-y-auto">
    <header class="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-line bg-base/90 px-8 backdrop-blur-sm">
      <h1 class="font-display text-lg font-semibold text-ink">Overview</h1>
      <div class="flex items-center gap-3">
        <button class="rounded-card border border-line bg-surface px-3 py-2 text-sm text-muted">⌘K Search</button>
        <button class="rounded-card bg-accent px-4 py-2 text-sm font-medium text-accentInk">New project</button>
      </div>
    </header>
    <div class="p-8">[page content: stat cards row, then chart + table]</div>
  </main>
</div>`
};

P['stat-cards'] = {
  match: ['kpi', 'stat cards', 'metrics row', 'overview cards', 'summary'],
  platforms: ['web', 'tablet', 'ios'],
  html: `
<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <div class="rounded-card border border-line bg-surface p-5">
    <div class="flex items-center justify-between">
      <p class="text-sm text-muted">Monthly revenue</p>
      <iconify-icon class="text-muted" icon="lucide:trending-up"></iconify-icon>
    </div>
    <p class="mt-3 font-display text-3xl tracking-tight text-ink tabular-nums">$48,290</p>
    <p class="mt-1.5 text-xs text-muted"><span class="font-medium text-green-600">+12.4%</span> vs last month</p>
  </div>
  <!-- 4 cards, all with real-sounding metrics; one may embed a tiny sparkline canvas -->
</div>`
};

P['data-table'] = {
  match: ['table', 'transactions', 'list', 'records', 'invoices', 'orders', 'users list'],
  platforms: ['web', 'tablet'],
  html: `
<div class="overflow-hidden rounded-card border border-line bg-surface">
  <div class="flex items-center justify-between border-b border-line px-5 py-4">
    <h3 class="text-sm font-semibold text-ink">Recent transactions</h3>
    <div class="flex gap-2">
      <button class="rounded-card border border-line px-3 py-1.5 text-xs font-medium text-muted">Filter</button>
      <button class="rounded-card border border-line px-3 py-1.5 text-xs font-medium text-muted">Export</button>
    </div>
  </div>
  <table class="w-full text-sm">
    <thead><tr class="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
      <th class="px-5 py-3 font-medium">Counterparty</th><th class="px-5 py-3 font-medium">Date</th>
      <th class="px-5 py-3 font-medium">Status</th><th class="px-5 py-3 text-right font-medium">Amount</th>
    </tr></thead>
    <tbody class="divide-y divide-line">
      <tr class="hover:bg-raised/50">
        <td class="flex items-center gap-3 px-5 py-3.5"><span class="grid h-8 w-8 place-items-center rounded-card bg-raised text-xs font-semibold text-ink">AC</span><span class="font-medium text-ink">Acme Corp</span></td>
        <td class="px-5 py-3.5 text-muted">Jun 28, 2026</td>
        <td class="px-5 py-3.5"><span class="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Paid</span></td>
        <td class="px-5 py-3.5 text-right font-mono text-ink tabular-nums">$12,480.00</td>
      </tr>
      <!-- 6-8 rows, varied statuses & realistic names/amounts -->
    </tbody>
  </table>
</div>`
};

P['chart-card'] = {
  match: ['chart', 'graph', 'analytics', 'trend', 'revenue chart'],
  platforms: ['web', 'tablet', 'ios'],
  html: `
<div class="rounded-card border border-line bg-surface p-5">
  <div class="mb-4 flex items-center justify-between">
    <div><h3 class="text-sm font-semibold text-ink">Revenue</h3><p class="text-xs text-muted">Last 6 months</p></div>
    <div class="flex rounded-card border border-line p-0.5 text-xs" x-data="{ r: '6M' }">
      <template x-for="p in ['1M','6M','1Y']"><button :class="r===p ? 'bg-raised text-ink' : 'text-muted'" @click="r=p" class="rounded-[calc(theme(borderRadius.card)-2px)] px-2.5 py-1 font-medium" x-text="p"></button></template>
    </div>
  </div>
  <div class="h-56"><canvas id="revChart"></canvas></div>
</div>
<script>
new Chart(document.getElementById('revChart'), {
  type: 'line',
  data: { labels: ['Jan','Feb','Mar','Apr','May','Jun'],
    datasets: [{ data: [28400,31200,29800,36500,41200,48290], borderColor: 'ACCENT_HEX', borderWidth: 2,
      pointRadius: 0, tension: 0.35, fill: true,
      backgroundColor: (c)=>{const g=c.chart.ctx.createLinearGradient(0,0,0,220);g.addColorStop(0,'ACCENT_HEX22');g.addColorStop(1,'ACCENT_HEX00');return g;} }]},
  options: { plugins:{legend:{display:false}}, maintainAspectRatio:false,
    scales:{ x:{grid:{display:false},ticks:{color:'MUTED_HEX',font:{size:11}}},
             y:{grid:{color:'LINE_HEX'},border:{display:false},ticks:{color:'MUTED_HEX',font:{size:11},callback:v=>'$'+(v/1000)+'k'}}}}
});
</script>`
};

P['settings-form'] = {
  match: ['settings', 'form', 'profile edit', 'account', 'preferences'],
  platforms: ['web', 'tablet'],
  html: `
<div class="mx-auto max-w-2xl space-y-8">
  <section class="rounded-card border border-line bg-surface">
    <div class="border-b border-line px-6 py-4"><h3 class="text-sm font-semibold text-ink">Profile</h3><p class="text-xs text-muted">How you appear across the workspace.</p></div>
    <div class="space-y-5 p-6">
      <div class="grid gap-1.5">
        <label class="text-sm font-medium text-ink">Full name</label>
        <input class="rounded-card border border-line bg-base px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent" value="Marcus Chen"/>
      </div>
      <div class="flex items-center justify-between rounded-card border border-line bg-base px-4 py-3.5">
        <div><p class="text-sm font-medium text-ink">Email notifications</p><p class="text-xs text-muted">Weekly digest and mentions</p></div>
        <button :class="on ? 'bg-accent' : 'bg-raised'" @click="on=!on" class="relative h-6 w-11 rounded-full transition-colors" x-data="{ on: true }">
          <span :class="on ? 'translate-x-5' : 'translate-x-0.5'" class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"></span>
        </button>
      </div>
    </div>
    <div class="flex justify-end gap-3 border-t border-line px-6 py-4">
      <button class="rounded-card border border-line px-4 py-2 text-sm font-medium text-ink">Cancel</button>
      <button class="rounded-card bg-accent px-4 py-2 text-sm font-medium text-accentInk">Save changes</button>
    </div>
  </section>
</div>`
};

P['mobile-shell'] = {
  match: ['mobile', 'app screen', 'ios', 'phone', 'tab bar'],
  platforms: ['ios'],
  html: `
<div class="flex min-h-screen flex-col bg-base">
  <div class="flex items-center justify-between px-6 pb-1 pt-3 text-[13px] font-semibold text-ink">
    <span>9:41</span>
    <span class="flex items-center gap-1.5"><iconify-icon icon="lucide:signal"></iconify-icon><iconify-icon icon="lucide:wifi"></iconify-icon><iconify-icon icon="lucide:battery-full"></iconify-icon></span>
  </div>
  <header class="px-6 pb-4 pt-2">
    <p class="text-[13px] font-medium uppercase tracking-wide text-muted">Thursday, Jul 2</p>
    <div class="flex items-end justify-between">
      <h1 class="font-display text-[32px] font-bold tracking-tight text-ink">Today</h1>
      <img alt="" class="h-9 w-9 rounded-full" src="https://api.dicebear.com/9.x/notionists/svg?seed=Amelia"/>
    </div>
  </header>
  <main class="flex-1 space-y-4 overflow-y-auto px-4 pb-28">[cards / lists / content]</main>
  <nav class="fixed inset-x-0 bottom-0 border-t border-line bg-surface/95 pb-7 pt-2 backdrop-blur">
    <div class="mx-auto flex max-w-md justify-around">
      <a class="flex flex-col items-center gap-1 text-accent" href="#"><iconify-icon class="text-[22px]" icon="lucide:house"></iconify-icon><span class="text-[10px] font-medium">Home</span></a>
      <a class="flex flex-col items-center gap-1 text-muted" href="#"><iconify-icon class="text-[22px]" icon="lucide:compass"></iconify-icon><span class="text-[10px] font-medium">Explore</span></a>
      <!-- 4-5 tabs, exactly one active -->
    </div>
  </nav>
</div>`
};

P['mobile-list'] = {
  match: ['list', 'inbox', 'feed', 'messages', 'history', 'activity'],
  platforms: ['ios'],
  html: `
<section class="mx-2 overflow-hidden rounded-card bg-surface">
  <a class="flex items-center gap-3.5 px-4 py-3 active:bg-raised" href="#">
    <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent"><iconify-icon class="text-[18px]" icon="lucide:leaf"></iconify-icon></span>
    <span class="flex-1 border-b border-line pb-3">
      <span class="flex items-baseline justify-between"><span class="text-[15px] font-medium text-ink">Row title</span><span class="text-xs text-muted">2h ago</span></span>
      <span class="mt-0.5 block text-[13px] text-muted">Secondary line with real detail</span>
    </span>
    <iconify-icon class="shrink-0 text-muted" icon="lucide:chevron-right"></iconify-icon>
  </a>
  <!-- 5-8 rows; last row's inner span gets border-b-0 -->
</section>`
};

P['mobile-onboarding'] = {
  match: ['onboarding', 'welcome', 'intro', 'get started', 'splash'],
  platforms: ['ios'],
  html: `
<div class="flex min-h-screen flex-col bg-base px-6 pb-10 pt-16">
  <div class="flex justify-end"><button class="text-sm font-medium text-muted">Skip</button></div>
  <div class="flex flex-1 flex-col items-center justify-center text-center">
    <div class="mb-10 grid h-56 w-56 place-items-center rounded-full bg-raised">
      <!-- hero visual: large image in organic mask OR icon composition; never emoji -->
    </div>
    <h1 class="font-display text-[28px] font-bold leading-tight tracking-tight text-ink">Benefit-first headline<br/>in two lines</h1>
    <p class="mt-3 max-w-[17rem] text-[15px] leading-relaxed text-muted">One supporting sentence that is concrete about what happens next.</p>
  </div>
  <div class="mb-8 flex justify-center gap-2">
    <span class="h-1.5 w-6 rounded-full bg-ink"></span><span class="h-1.5 w-1.5 rounded-full bg-line"></span><span class="h-1.5 w-1.5 rounded-full bg-line"></span>
  </div>
  <button class="h-13 w-full rounded-2xl bg-accent py-4 text-[15px] font-semibold text-accentInk">Continue</button>
</div>`
};

P['chat-panel'] = {
  match: ['chat', 'conversation', 'assistant', 'messaging', 'support'],
  platforms: ['web', 'tablet', 'ios'],
  html: `
<div class="flex h-full flex-col">
  <div class="flex-1 space-y-5 overflow-y-auto p-5">
    <div class="flex justify-end"><div class="max-w-[75%] rounded-card rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accentInk">User message, casual and specific.</div></div>
    <div class="flex gap-3">
      <span class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-xs font-bold text-base">V</span>
      <div class="max-w-[75%] rounded-card rounded-bl-sm border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-ink">Reply with substance — a list, a suggestion, a real answer.</div>
    </div>
  </div>
  <div class="border-t border-line p-4">
    <div class="flex items-center gap-2 rounded-card border border-line bg-surface px-4 py-2.5">
      <input class="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted" placeholder="Message..."/>
      <button class="grid h-8 w-8 place-items-center rounded-card bg-accent text-accentInk"><iconify-icon icon="lucide:arrow-up"></iconify-icon></button>
    </div>
  </div>
</div>`
};

P['auth-screen'] = {
  match: ['login', 'signup', 'sign in', 'sign up', 'auth', 'register'],
  platforms: ['web', 'tablet', 'ios'],
  html: `
<div class="grid min-h-screen bg-base lg:grid-cols-2">
  <div class="flex items-center justify-center px-6 py-16">
    <div class="w-full max-w-sm">
      <span class="mb-10 inline-grid h-9 w-9 place-items-center rounded-card bg-ink font-bold text-base">V</span>
      <h1 class="font-display text-3xl tracking-tight text-ink">Welcome back</h1>
      <p class="mt-2 text-sm text-muted">Sign in to your workspace.</p>
      <button class="mt-8 flex w-full items-center justify-center gap-2.5 rounded-card border border-line bg-surface py-2.5 text-sm font-medium text-ink">
        <img alt="" class="h-4 w-4" src="https://www.google.com/favicon.ico"/> Continue with Google
      </button>
      <div class="my-6 flex items-center gap-4 text-xs text-muted"><span class="h-px flex-1 bg-line"></span>or<span class="h-px flex-1 bg-line"></span></div>
      <div class="space-y-4">
        <div class="grid gap-1.5"><label class="text-sm font-medium text-ink">Email</label>
          <input class="rounded-card border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent" placeholder="you@company.com"/></div>
        <button class="w-full rounded-card bg-accent py-2.5 text-sm font-semibold text-accentInk">Sign in</button>
      </div>
    </div>
  </div>
  <div class="hidden bg-ink lg:block">[brand side: quote, product shot, or full-bleed image]</div>
</div>`
};

P['dashboard-widgets'] = {
  match: ['dashboard', 'analytics', 'gauge', 'donut', 'kpi', 'widgets', 'overview', 'metrics', 'revenue', 'stats'],
  platforms: ['web', 'tablet'],
  html: `
<!-- Widget trio: gauge doughnut + chunky rounded bars + assistant panel. -->
<div class="grid gap-5 lg:grid-cols-3">
  <div class="rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div class="mb-4 flex items-center justify-between">
      <h3 class="font-display text-[15px] font-semibold text-ink">Revenue split</h3>
      <button class="text-muted"><iconify-icon icon="lucide:ellipsis"></iconify-icon></button>
    </div>
    <div class="relative mx-auto h-44 w-44">
      <canvas id="gaugeChart"></canvas>
      <div class="absolute inset-0 grid place-items-center text-center">
        <div><p class="font-display text-3xl font-bold tracking-tight text-ink tabular-nums">$483K</p>
        <p class="text-xs text-muted">Total revenue</p></div>
      </div>
    </div>
    <div class="mt-5 flex justify-center gap-5 text-xs text-muted">
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full" style="background:#3B82F6"></i>Online</span>
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full" style="background:#34C08B"></i>Retail</span>
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full" style="background:#F4C542"></i>Wholesale</span>
    </div>
  </div>
  <div class="rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div class="mb-1 flex items-center justify-between">
      <h3 class="font-display text-[15px] font-semibold text-ink">Order statistics</h3>
      <span class="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-600">+26% ↗</span>
    </div>
    <p class="mb-4 font-display text-3xl font-bold tracking-tight text-ink tabular-nums">6,357</p>
    <div class="h-44"><canvas id="barsChart"></canvas></div>
  </div>
  <div class="rounded-card bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
    <div class="mb-4 flex items-center gap-2.5">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-accent/10 text-accent"><iconify-icon class="text-lg" icon="lucide:sparkle"></iconify-icon></span>
      <h3 class="font-display text-[15px] font-semibold text-ink">Ask me anything</h3>
    </div>
    <div class="space-y-3">
      <button class="w-full rounded-2xl bg-blue-50 p-3.5 text-left"><p class="text-sm font-semibold text-blue-700">Revenue</p><p class="mt-0.5 text-xs leading-relaxed text-blue-600/80">How this month compares to your goal.</p></button>
      <button class="w-full rounded-2xl bg-green-50 p-3.5 text-left"><p class="text-sm font-semibold text-green-700">Profit</p><p class="mt-0.5 text-xs leading-relaxed text-green-600/80">Current margin and efficiency.</p></button>
      <button class="w-full rounded-2xl bg-pink-50 p-3.5 text-left"><p class="text-sm font-semibold text-pink-700">Spending</p><p class="mt-0.5 text-xs leading-relaxed text-pink-600/80">Where most expenses are going.</p></button>
    </div>
  </div>
</div>
<script>
new Chart(document.getElementById('gaugeChart'), { type: 'doughnut',
  data: { labels: ['Online','Retail','Wholesale'], datasets: [{ data: [58,27,15],
    backgroundColor: ['#3B82F6','#34C08B','#F4C542'], borderWidth: 4, borderColor: '#FFFFFF', borderRadius: 8 }]},
  options: { cutout: '76%', plugins: { legend: { display: false } }, maintainAspectRatio: false } });
new Chart(document.getElementById('barsChart'), { type: 'bar',
  data: { labels: ['25','26','27','28','29','30'],
    datasets: [
      { data: [420,510,560,440,530,470], backgroundColor: 'INK_HEX', borderRadius: 8, borderSkipped: false, barPercentage: 0.55 },
      { data: [280,350,300,260,340,310], backgroundColor: '#F4C542', borderRadius: 8, borderSkipped: false, barPercentage: 0.55 }
    ]},
  options: { plugins: { legend: { display: false } }, maintainAspectRatio: false,
    scales: { x: { grid: { display: false }, ticks: { color: 'MUTED_HEX', font: { size: 11 } } },
              y: { display: false } } } });
</script>`
};

export const PATTERNS = P;

/**
 * Pick the most relevant patterns for one screen.
 * `sections` = array of section descriptors from the brief; `screenText` = name+purpose.
 */
export function matchPatterns(sections = [], screenText = '', platform = 'web', max = 4) {
  const hay = `${sections.join(' ')} ${screenText}`.toLowerCase();
  const scored = [];
  for (const [id, p] of Object.entries(PATTERNS)) {
    if (!p.platforms.includes(platform)) continue;
    let score = 0;
    for (const kw of p.match) if (hay.includes(kw)) score += kw.length > 4 ? 2 : 1;
    if (score > 0) scored.push({ id, p, score });
  }
  scored.sort((a, b) => b.score - a.score);
  let picked = scored.slice(0, max);
  // Sensible defaults so the composer always has structural references
  if (picked.length === 0) {
    const ids = platform === 'ios' ? ['mobile-shell', 'mobile-list'] : ['dashboard-shell', 'stat-cards'];
    picked = ids.map(id => ({ id, p: PATTERNS[id], score: 0 }));
  }
  return picked.map(({ id, p }) => `── PATTERN "${id}" (structural reference — adapt, don't copy) ──${p.html}`).join('\n\n');
}
