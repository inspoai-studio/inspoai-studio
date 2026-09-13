import React from "react";

import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { PaletteGenerator, FaqAccordion } from "./ColorPaletteUI";
import { TabsUI } from "./TabsUI";
import { generatePaletteColors } from "./colors";
import { ArrowRight } from "lucide-react";
const SUB_TYPES = {
  true: {
    label: "True Summer",
    defaultPalette: ["#6B8E9F", "#8AADBE", "#A3C3D3", "#BEDAE8", "#D7F0FC", "#B3D1E8", "#738E9E", "#5A7688"],
    generate: () => generatePaletteColors(8, [180, 240], [20, 60], [40, 80]),
    accents: [{
      color: "#D6E8F0",
      label: "Icy Blue"
    }, {
      color: "#9BA8BB",
      label: "Periwinkle"
    }, {
      color: "#E8D8DC",
      label: "Dusty Pink"
    }],
    fontLabel: "Cormorant Garamond + Lato"
  },
  soft: {
    label: "Soft Summer",
    defaultPalette: ["#9098A3", "#A5AEBD", "#B6C0D2", "#C6D0E0", "#DCE4F0", "#E8EDF5", "#828994", "#707682"],
    generate: () => generatePaletteColors(8, [200, 300], [10, 40], [50, 80]),
    accents: [{
      color: "#E5E9F0",
      label: "Soft Silver"
    }, {
      color: "#A28A94",
      label: "Faded Plum"
    }, {
      color: "#758494",
      label: "Slate Blue"
    }],
    fontLabel: "Playfair Display + Lato"
  },
  cool: {
    label: "Cool Summer",
    defaultPalette: ["#4E6D8C", "#5D7EA6", "#6C8EBF", "#8AACD9", "#94B0C8", "#A3BDD8", "#3F5C78", "#3A566E"],
    generate: () => generatePaletteColors(8, [200, 260], [30, 60], [40, 75]),
    accents: [{
      color: "#D3E0F0",
      label: "Powder Blue"
    }, {
      color: "#7B9CBA",
      label: "Steel Blue"
    }, {
      color: "#E8D4D8",
      label: "Cool Pink"
    }],
    fontLabel: "Inter + Space Grotesk"
  },
  light: {
    label: "Light Summer",
    defaultPalette: ["#CAD4E0", "#D4DCE8", "#DFE7F0", "#E9EFF7", "#F1F5FA", "#CDD7E4", "#B8C5D4", "#A3B3C4"],
    generate: () => generatePaletteColors(8, [200, 280], [15, 45], [70, 92]),
    accents: [{
      color: "#F5F8FC",
      label: "Pale Ghost"
    }, {
      color: "#9BABBF",
      label: "Frosted Slate"
    }, {
      color: "#E0D8E4",
      label: "Whisper Lilac"
    }],
    fontLabel: "DM Serif Display + DM Sans"
  }
};
const PRE_MADE_PALETTES = {
  true: [{
    name: "True Summer Slate",
    colors: ["#6B8E9F", "#8AADBE", "#A3C3D3", "#BEDAE8", "#D7F0FC", "#B3D1E8", "#738E9E", "#5A7688"]
  }, {
    name: "True Summer Fog",
    colors: ["#8D9BAB", "#9EACC0", "#B0BED4", "#C2D0E8", "#D4E2F5", "#C8DAEF", "#7A89A0", "#697693"]
  }],
  soft: [{
    name: "Soft Summer Haze",
    colors: ["#828C98", "#949DA9", "#A6B0BC", "#BAC3CF", "#CDD6E1", "#E2E8F0", "#5E6773", "#4A525D"]
  }, {
    name: "Soft Summer Lilac",
    colors: ["#928B9E", "#A49CB1", "#B6AFC3", "#C9C2D4", "#DBD5E6", "#EDE9F5", "#736C80", "#5A5467"]
  }],
  cool: [{
    name: "Cool Summer Ocean",
    colors: ["#4E6D8C", "#5D7EA6", "#6C8EBF", "#8AACD9", "#94B0C8", "#A3BDD8", "#3F5C78", "#3A566E"]
  }, {
    name: "Cool Summer Dusk",
    colors: ["#614E6E", "#745C84", "#866C9B", "#977DB2", "#A98ECB", "#BAA0E2", "#4E3C5A", "#3D2C48"]
  }],
  light: [{
    name: "Light Summer Cloud",
    colors: ["#CAD4E0", "#D4DCE8", "#DFE7F0", "#E9EFF7", "#F1F5FA", "#CDD7E4", "#B8C5D4", "#A3B3C4"]
  }, {
    name: "Light Summer Veil",
    colors: ["#D4C8D8", "#D8D0DC", "#DDD8E0", "#E2E0E7", "#EAEAF2", "#D8D0E3", "#C3B5CD", "#AE9FBB"]
  }]
};
const FAQ_ITEMS = [{
  q: "What are the four summer color palette sub-types?",
  a: "True Summer (cool, muted, medium contrast), Soft Summer (very muted, hazy, dreamy), Cool Summer (icy, blue-leaning), and Light Summer (near-pastel, luminous). All share cool undertones."
}, {
  q: "What makes a soft summer palette different from other summers?",
  a: "Soft Summer is the most grey-infused of all summer sub-types. Every color appears as if filtered through frosted glass. It has the lowest contrast and feels almost ethereal."
}, {
  q: "Can I use summer palettes for professional design?",
  a: "Absolutely. Summer palettes are excellent for healthcare, wellness SaaS, beauty, and finance. The cool, muted tones convey trust, calm, and professional reliability without feeling cold or sterile."
}, {
  q: "What colors should summer palettes avoid?",
  a: "Avoid warm oranges, golden yellows, earthy browns, and high-saturation warm reds. These warm tones clash with summer's cool baseline and destroy the palette's signature softness."
}];
const SubTypeTool = ({
  typeId
}) => {
  const typeData = SUB_TYPES[typeId];
  const [currentPalette, setCurrentPalette] = React.useState(typeData.defaultPalette);
  const rightPanel = <div className="flex flex-col gap-5">
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Accent Colors</h3>
                <div className="flex items-center gap-2">
                    {typeData.accents.map(a => <div key={a.color} className="flex flex-col items-center gap-1">
                            <div className="w-9 h-9 rounded-full border border-border shadow-sm" style={{
            background: a.color
          }} title={a.label} />
                            <span className="text-[10px] text-muted-foreground text-center leading-tight">{a.label}</span>
                        </div>)}
                </div>
            </div>
            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Font Pairings</h3>
                <p className="text-xs font-medium text-foreground/80 mb-1">{typeData.fontLabel}</p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className="text-base text-foreground leading-tight">Refined, Gentle</div>
                <div className="text-xs text-muted-foreground mt-0.5">Clean, airy body text</div>
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
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 mb-1" />
                        <div className="w-3/4 h-1.5 rounded-full bg-neutral-100 mb-3" />
                        <button className="text-white px-3 py-1 rounded-full text-[10px] font-semibold" style={{
            background: currentPalette[6]
          }}>
                            Learn More
                        </button>
                    </div>
                </div>
            </div>
        </div>;
  return <PaletteGenerator initialColors={currentPalette} onGenerateNew={() => {
    const c = typeData.generate();
    setCurrentPalette(c);
    return c;
  }} rightPanelContent={rightPanel} />;
};
export default function SummerColorPalette() {
  const tabs = [{
    id: "true",
    label: "True Summer",
    content: <SubTypeTool typeId="true" />
  }, {
    id: "soft",
    label: "Soft Summer",
    content: <SubTypeTool typeId="soft" />
  }, {
    id: "cool",
    label: "Cool Summer",
    content: <SubTypeTool typeId="cool" />
  }, {
    id: "light",
    label: "Light Summer",
    content: <SubTypeTool typeId="light" />
  }];
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Summer Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Summer Color Palette Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "Autumn Color Palette",
    href: "/free-tools/autumn-color-palette"
  }]}>
            <SEO title="Summer Color Palette Generator | Free HEX & PNG" description="Generate beautiful summer color palettes: true summer, soft summer, cool summer, light summer. Cool, muted, elegant. Free." keywords="summer color palette, cool tones palette, soft summer colors, muted palette" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Summer Color <span className="inspo-gradient-text">Palette</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate cool, muted, and elegant tones across all four summer sub-types. Download PNG or copy hex codes instantly.
                    </p>
                </div>

                <section className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 flex flex-col items-center mb-16">
                    <TabsUI tabs={tabs} defaultTabId="true" />
                </section>

                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-4">Explore summer <span>sub-types</span></h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                        {Object.entries(PRE_MADE_PALETTES).map(([type, palettes]) => <React.Fragment key={type}>
                                {palettes.map(p => <div key={p.name} className="bg-card rounded-xl border border-border shadow-sm p-4">
                                        <h4 className="font-medium text-sm mb-3">{p.name}</h4>
                                        <div className="flex h-6 rounded overflow-hidden mb-3">
                                            {p.colors.map(c => <div key={c} className="flex-1" style={{
                  background: c
                }} />)}
                                        </div>
                                        {type === "soft" ? <span className="text-xs font-semibold text-primary hover:underline flex items-center gap-1" style={{ cursor: "default" }}>
                                                View full Soft Summer <ArrowRight size={12} />
                                            </span> : <span className="text-xs text-muted-foreground font-medium">Part of {SUB_TYPES[type].label}</span>}
                                    </div>)}
                            </React.Fragment>)}
                    </div>
                </section>

                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A summer color palette relies entirely on softness, muting, and cool undertones. Blues, lilacs, dusty roses, and seafoam greens — all filtered through a layer of grey. Summer strives towards harmony and avoiding jarring contrast.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Summer color palette <span>sub-types</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        True Summer is balanced: cool and muted, but with medium depth. <span className="text-primary hover:underline" style={{ cursor: "default" }}>Soft Summer</span> goes further with a hazy, dreamy quality. Cool Summer embraces distinctly icy, blue-leaning tones. Light Summer is the most ethereal — almost pastel.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Summer vs winter color <span>palettes</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Both are cool-toned, but winter colors are clear, saturated, and high-contrast. Summer colors are muted, soft, and low-contrast. Winter is bold. Summer is gentle. Visit the <span className="text-primary hover:underline" style={{ cursor: "default" }}>Winter Color Palette</span> generator for comparison.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Summer colors for UI <span>design</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        In web design and UI, summer palettes are incredibly versatile for healthcare, beauty, tech SaaS, and finance. The muted, cool tones communicate trustworthiness, calm, and clinical precision without feeling sterile.
                    </p>
                </section>

                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}