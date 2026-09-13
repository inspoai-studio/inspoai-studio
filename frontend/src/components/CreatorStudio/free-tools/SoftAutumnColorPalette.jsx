import React, { useState } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { PaletteGenerator, FaqAccordion } from "./ColorPaletteUI";
import { generatePaletteColors } from "./colors";
const DEFAULT_PALETTE = ["#D9BDB0", "#E6D3C8", "#BCA99F", "#A08E84", "#8C7A71", "#7A8272", "#9E9084", "#6B5B53"];
const PRE_MADE_PALETTES = [{
  name: "Soft Autumn Moss",
  colors: ["#6B705C", "#A5A58D", "#B5B682", "#D4A373", "#E9EDC9", "#FAEDCD", "#FEFAE0", "#CCD5AE"]
}, {
  name: "Soft Autumn Clay",
  colors: ["#8A6B5D", "#A88B7D", "#C2A799", "#DDBCAE", "#E8D3C8", "#F2E8E3", "#D4C5BD", "#A08E84"]
}, {
  name: "Soft Autumn Sage",
  colors: ["#5F6F65", "#7D8C83", "#9AA9A1", "#B6C3BC", "#CED9D4", "#E5EDE9", "#9BA094", "#74786A"]
}, {
  name: "Soft Autumn Rose",
  colors: ["#9F7E79", "#BA9A95", "#D3B7B3", "#EAD4D1", "#F6E9E8", "#E6D3C8", "#C7AFA3", "#A5897E"]
}];
const FAQ_ITEMS = [{
  q: "What colors make up a soft autumn palette?",
  a: "A soft autumn palette includes muted olive greens, dusty roses, warm taupes, oatmeal, soft terracotta, and faded mustard. All colors have a warm undertone but are softened with grey."
}, {
  q: "Can soft autumn wear black and white?",
  a: "Stark black and pure white are generally too harsh for soft autumn. Instead of black, opt for warm charcoal, dark olive, or deep espresso. Instead of white, use cream, ivory, or oatmeal."
}, {
  q: "Is soft autumn warm or cool?",
  a: "Soft autumn is primarily warm, but it borders the summer season, meaning it is the most \"cool-leaning\" of all the autumn sub-types. However, its overall temperature remains gently warm."
}, {
  q: "What is the difference between soft autumn and soft summer?",
  a: "Both are muted (greyed-out) palettes. However, soft autumn has warm, golden/yellow undertones, while soft summer has cool, blue/grey undertones. Soft autumn feels earthy; soft summer feels watery."
}];
const ACCENT_COLORS = [{
  color: "#E5D3B3",
  label: "Soft Gold"
}, {
  color: "#8F6A5B",
  label: "Muted Rose"
}, {
  color: "#758471",
  label: "Sage Green"
}];
const COLOR_LIST = [{
  name: "Dusty Rose",
  hex: "#C28F8E"
}, {
  name: "Sage Green",
  hex: "#8A9A86"
}, {
  name: "Muted Clay",
  hex: "#B88673"
}, {
  name: "Oatmeal",
  hex: "#D9CDBF"
}, {
  name: "Soft Olive",
  hex: "#7A7B64"
}, {
  name: "Warm Taupe",
  hex: "#A89A92"
}, {
  name: "Faded Terracotta",
  hex: "#C47C68"
}, {
  name: "Pewter",
  hex: "#858688"
}];
export default function SoftAutumnColorPalette() {
  const [currentPalette, setCurrentPalette] = useState(DEFAULT_PALETTE);
  const handleGenerateNew = () => {
    const c = generatePaletteColors(8, [20, 50], [20, 50], [40, 70]);
    setCurrentPalette(c);
    return c;
  };
  const rightPanel = <div className="flex flex-col gap-5">
            {/* Accent Colors */}
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

            {/* Font Pairings */}
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Font Pairings</h3>
                <p className="text-xs text-muted-foreground mb-1"><strong className="text-foreground">Lora</strong> + <strong className="text-foreground">Nunito</strong></p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className="text-base text-foreground leading-tight">Gentle Elegance</div>
                <div className="text-xs text-muted-foreground mt-0.5">Soft, rounded body text</div>
            </div>

            {/* Sample UI Preview */}
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Sample UI Preview</h3>
                <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{
        background: currentPalette[1]
      }}>
                    {/* Mock app bar */}
                    <div className="px-3 py-2 flex items-center gap-1.5" style={{
          background: currentPalette[3]
        }}>
                        <div className="w-2 h-2 rounded-full bg-white/60" />
                        <div className="w-2 h-2 rounded-full bg-white/40" />
                        <div className="w-2 h-2 rounded-full bg-white/30" />
                    </div>
                    {/* Content */}
                    <div className="p-3">
                        <div className="w-2/3 h-2.5 rounded-full mb-2" style={{
            background: currentPalette[4]
          }} />
                        <div className="w-full h-1.5 rounded-full bg-black/10 mb-1.5" />
                        <div className="w-4/5 h-1.5 rounded-full bg-black/8 mb-1.5" />
                        <div className="w-3/5 h-1.5 rounded-full bg-black/6 mb-3" />
                        <button className="text-white px-3 py-1 rounded-full text-[10px] font-semibold" style={{
            background: currentPalette[5]
          }}>
                            Explore →
                        </button>
                    </div>
                </div>
            </div>
        </div>;
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Soft Autumn Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Soft Autumn Color Palette Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "CSS Gradient Generator",
    href: "/free-tools/css-gradient-generator"
  }]}>
            <SEO title="Soft Autumn Color Palette Generator | Free HEX & PNG" description="Generate beautiful, muted soft autumn color palettes. Earthy, gentle, warm-neutral colors. Export hex codes and PNGs for free." keywords="soft autumn color palette, muted autumn colors, earth tones palette, color generator" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                {/* Hero */}
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Soft Autumn Color <span className="inspo-gradient-text">Palette</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate muted, dusty, and gently warm earth tones. Export HEX codes or download your palette as a PNG instantly.
                    </p>
                </div>

                {/* Generator */}
                <section className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 mb-12">
                    <PaletteGenerator initialColors={currentPalette} onGenerateNew={handleGenerateNew} rightPanelContent={rightPanel} />
                </section>

                {/* Pre-made palettes */}
                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold mb-6">Pre-made soft autumn <span>palettes</span></h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {PRE_MADE_PALETTES.map(p => <button key={p.name} className="bg-card rounded-xl border border-border shadow-sm p-4 text-left hover:-translate-y-1 hover:shadow-md transition-all group" onClick={() => setCurrentPalette(p.colors)}>
                                <h4 className="font-medium text-sm mb-3 group-hover:text-primary transition-colors">{p.name}</h4>
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
                        A soft autumn color palette is characterized by its muted, dusty, and gently warm nature. Think of a landscape fading into late autumn: dried leaves, muted clay, soft sage green, and hazy sunsets. Unlike the vibrant True Autumn, Soft Autumn relies heavily on grey undertones to reduce harshness.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">What is a soft autumn color <span>palette</span>?</h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        In seasonal color analysis, soft autumn borders the summer season. It takes the earthy warmth of autumn but blends it with the soft, muted qualities of summer. The result is an incredibly elegant, understated, and highly sophisticated palette that lacks aggressive contrast.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-4">Soft autumn colors <span>list</span></h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
                        {COLOR_LIST.map(c => <div key={c.hex} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card">
                                <div className="w-7 h-7 rounded-md border border-black/10 shrink-0" style={{
              background: c.hex
            }} />
                                <div>
                                    <div className="text-xs font-semibold text-foreground leading-tight">{c.name}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{c.hex}</div>
                                </div>
                            </div>)}
                    </div>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Soft autumn vs true <span>autumn</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        True Autumn is rich, saturated, and highly contrasted (think deep rust, vibrant mustard, and dark olive). Soft Autumn is intentionally "faded." If you take a True Autumn color and mix a considerable amount of grey into it, you get a Soft Autumn color. The contrast level in Soft Autumn is inherently low to medium.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Colors to avoid for soft <span>autumn</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Because soft autumn colors are muted, they are easily overpowered by highly saturated or extremely dark colors. Soft autumns should avoid neon colors, stark black, optic white, and icy cool tones like magenta or cyan. These will completely wash out the delicate balance of the soft autumn aesthetic.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">How to use soft autumn colors in <span>design</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        In web design, soft autumn palettes are perfect for lifestyle brands, organic skincare, boutique coffee shops, and wellness apps. The low-contrast nature makes these colors incredibly easy on the eyes, encouraging users to linger on a page. Pair these colors with soft, imperfect organic shapes and high-quality photography featuring natural lighting.
                    </p>
                </section>

                {/* FAQ Accordion */}
                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}