import React, { useState } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { PaletteGenerator, FaqAccordion } from "./ColorPaletteUI";
import { generatePaletteColors } from "./colors";
const DEFAULT_PALETTE = ["#9098A3", "#A5AEBD", "#B6C0D2", "#C6D0E0", "#DCE4F0", "#E8EDF5", "#828994", "#707682"];
const PRE_MADE_PALETTES = [{
  name: "Soft Summer Haze",
  colors: ["#828C98", "#949DA9", "#A6B0BC", "#BAC3CF", "#CDD6E1", "#E2E8F0", "#5E6773", "#4A525D"]
}, {
  name: "Soft Summer Rose",
  colors: ["#9F8D98", "#B5A4AF", "#C7B7C2", "#D8CAD4", "#E8DCE4", "#F5EAF1", "#7A6874", "#63525D"]
}, {
  name: "Soft Summer Sage",
  colors: ["#8A9A95", "#9EAFA9", "#B1C2BB", "#C5D6CE", "#D9E8E1", "#EAF5F0", "#6A7A75", "#54645F"]
}, {
  name: "Soft Summer Lilac",
  colors: ["#928B9E", "#A49CB1", "#B6AFC3", "#C9C2D4", "#DBD5E6", "#EDE9F5", "#736C80", "#5A5467"]
}];
const FAQ_ITEMS = [{
  q: "What colors make up a soft summer palette?",
  a: "A soft summer palette includes dusty blue, heather gray, faded mauve, sea glass green, powder pink, slate, cocoa brown, and soft lavender. All are cool-toned and muted."
}, {
  q: "Is soft summer warm or cool?",
  a: "Soft summer is cool. Its grey undertones have blue or pink bases, making it distinctly cool — but very gently so, never icy or harsh."
}, {
  q: "What is the difference between soft summer and soft autumn?",
  a: "Both are muted palettes, but soft summer is cool (blue/grey undertones) while soft autumn is warm (yellow/golden undertones). Soft summer feels watery; soft autumn feels earthy."
}, {
  q: "Can I use soft summer colors for a website?",
  a: "Absolutely. Soft summer palettes are excellent for healthcare, beauty, wellness, and SaaS dashboards. The low-contrast, cool tones prevent eye strain and convey calm trustworthiness."
}];
const COLOR_LIST = [{
  name: "Dusty Blue",
  hex: "#8A9BA8"
}, {
  name: "Heather Gray",
  hex: "#9E9E9E"
}, {
  name: "Faded Mauve",
  hex: "#A88B9E"
}, {
  name: "Sea Glass",
  hex: "#8FABA3"
}, {
  name: "Powder Pink",
  hex: "#D4B8C1"
}, {
  name: "Slate",
  hex: "#5C6A78"
}, {
  name: "Cocoa Brown",
  hex: "#87726A"
}, {
  name: "Soft Lavender",
  hex: "#A5A0B5"
}];
const ACCENT_COLORS = [{
  color: "#E5E9F0",
  label: "Soft Silver"
}, {
  color: "#A28A94",
  label: "Faded Plum"
}, {
  color: "#758494",
  label: "Slate Blue"
}];
export default function SoftSummerColorPalette() {
  const [currentPalette, setCurrentPalette] = useState(DEFAULT_PALETTE);
  const handleGenerateNew = () => {
    const c = generatePaletteColors(8, [200, 300], [10, 40], [50, 80]);
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
                <p className="text-xs text-muted-foreground mb-1"><strong className="text-foreground">Playfair Display</strong> + <strong className="text-foreground">Lato</strong></p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className="text-base text-foreground leading-tight">Refined Quiet</div>
                <div className="text-xs text-muted-foreground mt-0.5">Clean, delicate body text</div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Sample UI Preview</h3>
                <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                    <div className="h-2" style={{
          background: currentPalette[0]
        }} />
                    <div className="p-3 bg-white">
                        <div className="flex gap-1.5 mb-2">
                            <div className="w-14 h-1.5 rounded-full" style={{
              background: currentPalette[2]
            }} />
                            <div className="w-10 h-1.5 rounded-full bg-neutral-200" />
                            <div className="w-8 h-1.5 rounded-full bg-neutral-200" />
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 mb-1" />
                        <div className="w-3/4 h-1.5 rounded-full bg-neutral-100 mb-3" />
                        <div className="flex gap-2">
                            <button className="text-white px-2 py-1 rounded-full text-[10px] font-semibold" style={{
              background: currentPalette[6]
            }}>
                                Learn More
                            </button>
                            <button className="text-foreground px-2 py-1 rounded-full text-[10px] font-semibold border border-border">
                                Skip
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>;
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Soft Summer Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Soft Summer Color Palette Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "CSS Gradient Generator",
    href: "/free-tools/css-gradient-generator"
  }]}>
            <SEO title="Soft Summer Color Palette Generator | Free HEX & PNG" description="Generate cool, muted, dusty soft summer color palettes. Slate blues, dusty roses, heather gray. Export hex codes and PNGs for free." keywords="soft summer color palette, muted summer colors, cool tones palette, color generator" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Soft Summer Color <span className="inspo-gradient-text">Palette</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate cool, cloudy, and highly muted soft summer tones. Export HEX codes or download your palette as a PNG instantly.
                    </p>
                </div>

                <section className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 mb-12">
                    <PaletteGenerator initialColors={currentPalette} onGenerateNew={handleGenerateNew} rightPanelContent={rightPanel} />
                </section>

                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold mb-6">Pre-made soft summer <span>palettes</span></h2>
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

                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A soft summer color palette is the most gentle, muted, and grey-infused of all the cool palettes. Think of a misty morning, slate roofs in the rain, seafoam, and faded denim. It completely avoids harsh contrast and high saturation, favoring colors that blend seamlessly into one another.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">What is a soft summer color <span>palette</span>?</h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        In the 12-season color system, soft summer is the transition between the coolness of summer and the warmth of autumn. It is defined precisely by its "softness" (low saturation) rather than its temperature, though it remains distinctly cool. Every color in a soft summer palette looks as though you have placed a frosted piece of glass over it.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-4">Soft summer colors <span>list</span></h2>
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

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Soft summer vs soft <span>autumn</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        These two seasons frequently confuse people because they represent the "soft" border between cool and warm. A Soft Summer is distinctly cool—its base greys have blue or pink undertones. A Soft Autumn is warm—its base greys have yellow or golden undertones. Soft summer colors will often feel "watery" while soft autumn colors feel "earthy."
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Colors to avoid for soft <span>summer</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Because soft summer requires low contrast, high-intensity color is its enemy. Avoid bright orange, neon pink, canary yellow, and stark, optic white. Harsh black is also generally too heavy; instead, soft summers should anchor their designs with deep charcoal or slate blue.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">How to use soft summer colors in <span>design</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        In digital design, soft summer palettes are excellent for conveying calm, trustworthiness, and quiet luxury. It is highly popular in modern SaaS dashboards to prevent eye strain, as well as in elegant wedding mood boards, spa branding, and modern editorial websites.
                    </p>
                </section>

                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}