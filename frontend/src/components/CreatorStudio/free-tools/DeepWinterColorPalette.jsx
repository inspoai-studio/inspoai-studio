import React, { useState } from "react";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { PaletteGenerator } from "./ColorPaletteUI";
import { generatePaletteColors } from "./colors";
import { Moon } from "lucide-react";
import FreeToolLayout from "./FreeToolLayout";

const DEFAULT_PALETTE = ["#1A1A2E", "#16213E", "#0F3460", "#533483", "#8B0000", "#C70039", "#2C3E50", "#1B1B2F"];
const PRE_MADE_PALETTES = [{
  name: "Deep Winter Midnight",
  colors: ["#0B0B1A", "#121226", "#1A1A36", "#242447", "#09172E", "#0F2547", "#1A3666", "#2B5299"]
}, {
  name: "Deep Winter Jewel",
  colors: ["#2B0C28", "#4A1544", "#6B1D61", "#942784", "#1E0D2A", "#331548", "#4A1E69", "#6A2D96"]
}, {
  name: "Deep Winter Crimson",
  colors: ["#3D0000", "#5C0000", "#7A0000", "#A30000", "#240004", "#42000B", "#660013", "#8A001A"]
}, {
  name: "Deep Winter Sapphire",
  colors: ["#001021", "#002042", "#00326B", "#004799", "#001D2B", "#003A54", "#005980", "#007BAE"]
}, {
  name: "Deep Winter Plum",
  colors: ["#1F0815", "#380D25", "#521237", "#75194D", "#1C0A11", "#33121F", "#4D1B2D", "#6B253F"]
}, {
  name: "Deep Winter Onyx",
  colors: ["#0D0D0D", "#1A1A1A", "#262626", "#333333", "#080F12", "#111C21", "#1B2A31", "#263B45"]
}, {
  name: "Deep Winter Merlot",
  colors: ["#240A10", "#40111A", "#5E1826", "#852236", "#1B050B", "#300A13", "#4A111F", "#69172A"]
}, {
  name: "Deep Winter Arctic",
  colors: ["#08121C", "#0F2033", "#152E4B", "#1C416B", "#0C171A", "#152A2E", "#1F3E45", "#2B545C"]
}];
const FAQ_ITEMS = [{
  q: "What colors are in a deep winter palette?",
  a: "Deep winter includes midnight navy, jewel purple, dark crimson, charcoal, emerald, icy white, and black. All colors are cool-toned with high saturation and deep values."
}, {
  q: "What is the difference between deep winter and dark winter?",
  a: "They are very similar and often used interchangeably. Both refer to the darkest, most intense winter sub-type. Some color analysts distinguish them slightly, with dark winter leaning marginally warmer, but in practice the palettes overlap significantly."
}, {
  q: "What colors should deep winter avoid?",
  a: "Avoid pastels, warm earthy tones, muted colors, warm beige, and soft autumn shades. These dilute the bold, high-contrast nature of deep winter."
}, {
  q: "Is deep winter warm or cool?",
  a: "Deep winter is cool. It is the deepest, most saturated sub-type of the winter season. While it can include some warm-leaning jewel tones like ruby, the overall temperature is distinctly cool."
}, {
  q: "Can I use deep winter for luxury branding?",
  a: "Yes. Deep winter palettes are the go-to for luxury brands. The dark, rich tones communicate sophistication, exclusivity, and premium quality. Pair with metallic accents for maximum impact."
}];
const COLOR_LIST = [{
  name: "Midnight Navy",
  hex: "#1A1A2E"
}, {
  name: "Deep Indigo",
  hex: "#16213E"
}, {
  name: "Royal Blue",
  hex: "#0F3460"
}, {
  name: "Imperial Purple",
  hex: "#533483"
}, {
  name: "Dark Crimson",
  hex: "#8B0000"
}, {
  name: "Vivid Berry",
  hex: "#C70039"
}, {
  name: "Charcoal Slate",
  hex: "#2C3E50"
}, {
  name: "Obsidian",
  hex: "#1B1B2F"
}];
const ACCENT_COLORS = [{
  color: "#FFFFFF",
  label: "Stark White"
}, {
  color: "#C0C0C0",
  label: "Bright Silver"
}, {
  color: "#ADD8E6",
  label: "Ice Blue"
}];

export default function DeepWinterColorPalette({ onBack }) {
  const [currentPalette, setCurrentPalette] = useState(DEFAULT_PALETTE);
  const handleGenerateNew = () => {
    const c = generatePaletteColors(8, [200, 340], [40, 80], [10, 35]);
    setCurrentPalette(c);
    return c;
  };
  const rightPanel = <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Accent Colors</h3>
                <div className="flex items-center gap-2">
                    {ACCENT_COLORS.map(a => <div key={a.color} className="flex flex-col items-center gap-1">
                            <div className="w-9 h-9 rounded-full border border-border shadow-sm" style={{
            background: a.color
          }} title={a.label} />
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">{a.label}</span>
                        </div>)}
                </div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Font Pairings</h3>
                <p className="text-xs text-muted-foreground mb-1"><strong className="text-foreground">Bodoni Moda</strong> + <strong className="text-foreground">Inter</strong></p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className="text-base text-foreground leading-tight">Dramatic Luxury</div>
                <div className="text-xs text-muted-foreground mt-0.5">Clean modern tech body</div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Sample UI Preview</h3>
                <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                    <div className="h-2" style={{
          background: currentPalette[4]
        }} />
                    <div className="p-3 bg-white">
                        <div className="w-2/3 h-2.5 rounded-full mb-2 bg-neutral-200" style={{
            background: currentPalette[0]
          }} />
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 mb-1" />
                        <div className="w-3/4 h-1.5 rounded-full bg-neutral-100 mb-3" />
                        <button className="text-white px-3 py-1 rounded-full text-[10px] font-semibold border border-black/10 hover:bg-black/5" style={{
            background: currentPalette[5] || currentPalette[3]
          }}>
                            Read More
                        </button>
                    </div>
                </div>
            </div>
        </div>;
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Deep Winter Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Deep Winter Color Palette Generator" onBack={onBack}>
            <SEO title="Deep Winter Color Palette Generator | Free HEX & PNG" description="Generate deep winter color palettes with rich, bold, cool-toned colors. Midnight blue, jewel tones, dark crimson. Free hex codes and PNG export." keywords="deep winter color palette, dark winter colors, jewel tones palette, dark mode color generator" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Deep Winter Color{" "}
                        <span className="inspo-gradient-text">
                            Palette
                        </span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate rich, bold, and luxurious deep tones perfectly tuned for dark mode UI, premium branding, and dramatic interfaces.
                    </p>
                </div>

                {/* Generator */}
                <section className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 mb-16">
                    <PaletteGenerator initialColors={currentPalette} onGenerateNew={handleGenerateNew} isDarkHero={false} rightPanelContent={rightPanel} />
                </section>

                {/* Pre-made palettes */}
                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold text-foreground mb-6 border-b border-border pb-4">
                        Pre-made deep winter <span>palettes</span>
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                        {PRE_MADE_PALETTES.map(p => <button key={p.name} className="bg-card rounded-xl border border-border p-4 text-left hover:-translate-y-1 hover:border-accent hover:shadow-inspo transition-all group" onClick={() => setCurrentPalette(p.colors)}>
                                <h4 className="font-medium text-sm mb-3 text-foreground/90 group-hover:text-foreground transition-colors">{p.name}</h4>
                                <div className="flex h-8 rounded-md overflow-hidden">
                                    {p.colors.map(c => <div key={c} className="flex-1" style={{
              background: c
            }} />)}
                                </div>
                            </button>)}
                    </div>
                </section>

                {/* SEO Content */}
                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A deep winter color palette features rich, bold, cool-toned colors with maximum depth and intensity. Think midnight navy, jewel-toned purple, dark crimson, and charcoal black. These are the most dramatic colors in the seasonal system — perfect for luxury brands, premium tech products, and high-impact UI designs.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">What is a deep winter color <span>palette</span>?</h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        In seasonal color analysis, deep winter sits at the absolute darkest edge of the cool spectrum. It takes the icy clarity of a true winter palette and plunges it into shadow. The result is incredibly rich, striking, and undeniably luxurious.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-4">Deep winter colors <span>list</span></h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        {COLOR_LIST.map(c => <div key={c.hex} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                                <div className="w-7 h-7 rounded-md border border-border shrink-0" style={{
            background: c.hex
          }} />
                                <div>
                                    <div className="text-xs font-semibold text-foreground leading-tight">{c.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{c.hex}</div>
                                </div>
                            </div>)}
                    </div>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Colors to avoid for deep <span>winter</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Avoid pastels of any kind — they look washed out and weak against deep winter hues. Completely avoid warm, earthy, or yellow-based tones like mustard, soft camel, rust, or olive. These colors will clash violently with deep winter's cool baseline.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">How to use deep winter colors in <span>design</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        Deep winter palettes are the baseline for modern dark mode UI design. Midnight blues and charcoals make for incredibly legible, glare-free app backgrounds. In branding, deep winter translates immediately to "premium" — high-end law firms, luxury automotive, and exclusive beverage brands leverage these tones to project authority and wealth.
                    </p>
                </section>

                {/* FAQ */}
                <div className="bg-card rounded-3xl border border-border p-8 mt-16 shadow-inspo">
                    <h2 className="text-2xl font-display font-semibold text-foreground mb-6">Frequently asked <span>questions</span></h2>
                    <div className="divide-y divide-border">
                        {FAQ_ITEMS.map((item, i) => {
          const [open, setOpen] = useState(false);
          return <div key={i} className="py-4">
                                    <button className="w-full flex items-center justify-between gap-4 text-left group" onClick={() => setOpen(!open)}>
                                        <span className="font-semibold text-foreground/90 group-hover:text-foreground transition-colors">{item.q}</span>
                                        <span className={`text-muted-foreground text-lg transition-transform duration-200 shrink-0 ${open ? "rotate-180" : ""}`}>⌄</span>
                                    </button>
                                    {open && <p className="mt-3 text-muted-foreground leading-relaxed text-sm">{item.a}</p>}
                                </div>;
        })}
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}