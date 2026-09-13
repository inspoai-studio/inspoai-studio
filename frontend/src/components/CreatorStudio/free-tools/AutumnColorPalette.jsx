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
    label: "True Autumn",
    defaultPalette: ["#8B4513", "#A0522D", "#CD853F", "#DEB887", "#D2B48C", "#F5DEB3", "#B8860B", "#DAA520"],
    generate: () => generatePaletteColors(8, [20, 50], [40, 90], [20, 70]),
    accents: [{
      color: "#EEE0B1",
      label: "Warm Cream"
    }, {
      color: "#C86B28",
      label: "Rich Rust"
    }, {
      color: "#4A5D23",
      label: "Forest Green"
    }],
    fontLabel: "Merriweather + Open Sans"
  },
  soft: {
    label: "Soft Autumn",
    defaultPalette: ["#D9BDB0", "#E6D3C8", "#BCA99F", "#A08E84", "#8C7A71", "#7A8272", "#9E9084", "#6B5B53"],
    generate: () => generatePaletteColors(8, [20, 50], [20, 50], [40, 70]),
    accents: [{
      color: "#E5D3B3",
      label: "Soft Gold"
    }, {
      color: "#8F6A5B",
      label: "Muted Rose"
    }, {
      color: "#758471",
      label: "Sage Green"
    }],
    fontLabel: "Lora + Nunito"
  },
  deep: {
    label: "Deep Autumn",
    defaultPalette: ["#3E2723", "#4E342E", "#5D4037", "#6D4C41", "#795548", "#8D6E63", "#4A148C", "#311B92"],
    generate: () => generatePaletteColors(8, [0, 40], [30, 80], [10, 40]),
    accents: [{
      color: "#D4AF37",
      label: "Metallic Gold"
    }, {
      color: "#800000",
      label: "Maroon"
    }, {
      color: "#002E20",
      label: "Deep Pine"
    }],
    fontLabel: "Playfair Display + Lato"
  },
  dark: {
    label: "Dark Autumn",
    defaultPalette: ["#2d1b19", "#3e2723", "#4e342e", "#5d4037", "#8c3123", "#1a2421", "#212121", "#e3c28d"],
    generate: () => generatePaletteColors(8, [0, 50], [30, 90], [5, 30]),
    accents: [{
      color: "#F0E6D2",
      label: "Vintage Cream"
    }, {
      color: "#8B0000",
      label: "Dark Blood Red"
    }, {
      color: "#1A1A1A",
      label: "Almost Black"
    }],
    fontLabel: "EB Garamond + Inter"
  }
};
const PRE_MADE_PALETTES = {
  true: [{
    name: "True Autumn Spice",
    colors: ["#D35400", "#E67E22", "#F39C12", "#F1C40F", "#C0392B", "#9A7D0A", "#7E5109", "#A04000"]
  }, {
    name: "True Autumn Harvest",
    colors: ["#FAD7A1", "#F5CBA7", "#EDBB99", "#E59866", "#DC7633", "#D35400", "#BA4A00", "#873600"]
  }],
  soft: [{
    name: "Soft Autumn Moss",
    colors: ["#6B705C", "#A5A58D", "#B5B682", "#D4A373", "#E9EDC9", "#FAEDCD", "#FEFAE0", "#CCD5AE"]
  }, {
    name: "Soft Autumn Clay",
    colors: ["#8A6B5D", "#A88B7D", "#C2A799", "#DDBCAE", "#E8D3C8", "#F2E8E3", "#D4C5BD", "#A08E84"]
  }],
  deep: [{
    name: "Deep Autumn Bark",
    colors: ["#3E2723", "#4E342E", "#5D4037", "#6D4C41", "#795548", "#8D6E63", "#A1887F", "#BCAAA4"]
  }, {
    name: "Deep Autumn Wine",
    colors: ["#4A148C", "#6A1B9A", "#7B1FA2", "#8E24AA", "#9C27B0", "#AB47BC", "#BA68C8", "#CE93D8"]
  }],
  dark: [{
    name: "Dark Autumn Midnight",
    colors: ["#2d1b19", "#3e2723", "#4e342e", "#5d4037", "#8c3123", "#1a2421", "#212121", "#e3c28d"]
  }, {
    name: "Dark Autumn Espresso",
    colors: ["#1A100C", "#2D1D15", "#412A1E", "#563A2A", "#6C4B37", "#845D44", "#9D7053", "#B78464"]
  }]
};
const FAQ_ITEMS = [{
  q: "What are the four autumn color sub-types?",
  a: "True Autumn (rich, warm, saturated), Soft Autumn (muted, dusty, low contrast), Deep Autumn (dark, earthy, shadowed), and Dark Autumn (the deepest, bordering on winter). All share warm undertones."
}, {
  q: "What colors make up a true autumn palette?",
  a: "True Autumn includes warm rust, deep gold, olive green, terracotta, chocolate brown, and mustard yellow — all highly saturated and without any grey softening."
}, {
  q: "What is the difference between deep and dark autumn?",
  a: "Deep Autumn saturates its dark earth tones with rich pigment (like eggplant, forest green). Dark Autumn pushes further into literal black-browns. Both are heavy and dramatic, with Dark Autumn being slightly cooler."
}, {
  q: "Can I use autumn colors for a modern tech startup brand?",
  a: "Yes, but selectively. Dark Autumn or Deep Autumn tones (dark espresso, forest green, maroon) can feel premium and distinctly different from typical blue-dominated tech palettes. Avoid the rusty-orange shades for tech contexts."
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
                <p className="text-xs text-muted-foreground mb-1 font-medium text-foreground/80">{typeData.fontLabel}</p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className="text-base text-foreground leading-tight">Classic Grounded Header</div>
                <div className="text-xs text-muted-foreground mt-0.5">Sturdy, readable body</div>
            </div>

            <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Sample UI Preview</h3>
                <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                    <div className="h-2" style={{
          background: currentPalette[0]
        }} />
                    <div className="p-3 bg-white">
                        <div className="w-2/3 h-2.5 rounded-full mb-2" style={{
            background: currentPalette[2]
          }} />
                        <div className="w-full h-1.5 rounded-full bg-neutral-100 mb-1" />
                        <div className="w-3/4 h-1.5 rounded-full bg-neutral-100 mb-3" />
                        <button className="text-white px-3 py-1 rounded-full text-[10px] font-semibold" style={{
            background: currentPalette[4]
          }}>
                            Explore →
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
export default function AutumnColorPalette() {
  const tabs = [{
    id: "true",
    label: "True Autumn",
    content: <SubTypeTool typeId="true" />
  }, {
    id: "soft",
    label: "Soft Autumn",
    content: <SubTypeTool typeId="soft" />
  }, {
    id: "deep",
    label: "Deep Autumn",
    content: <SubTypeTool typeId="deep" />
  }, {
    id: "dark",
    label: "Dark Autumn",
    content: <SubTypeTool typeId="dark" />
  }];
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Autumn Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Autumn Color Palette Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "Winter Color Palette",
    href: "/free-tools/winter-color-palette"
  }]}>
            <SEO title="Autumn Color Palette Generator | Free HEX & PNG" description="Generate beautiful autumn color palettes: true autumn, soft autumn, deep autumn, dark autumn. Earthy, rich, warm colors. Free." keywords="autumn color palette, true autumn colors, soft autumn palette, deep autumn, warm color schemes" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Autumn Color <span className="inspo-gradient-text">Palette</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate earthy, rich, and warm tones across all four autumn sub-types. Download PNG or copy hex codes instantly.
                    </p>
                </div>

                <section className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 flex flex-col items-center mb-16">
                    <TabsUI tabs={tabs} defaultTabId="true" />
                </section>

                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-4">Explore autumn <span>sub-types</span></h2>
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
                                                View full Soft Autumn <ArrowRight size={12} />
                                            </span> : <span className="text-xs text-muted-foreground font-medium">Part of {SUB_TYPES[type].label}</span>}
                                    </div>)}
                            </React.Fragment>)}
                    </div>
                </section>

                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        An autumn color palette is defined entirely by its warmth and grounding earthiness. There are absolutely no cool blues or icy pinks here. Instead, autumn relies on the rich, robust colors of harvest: deep golds, burnt oranges, olive greens, and heavy espresso browns.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Autumn color palette <span>sub-types</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        True Autumn is the absolute standard: warm, rich, and perfectly balanced. <span className="text-primary hover:underline" style={{ cursor: "default" }}>Soft Autumn</span> is muted and dusty, blending with the summer season. Deep Autumn and Dark Autumn are the heaviest, bordering on winter with maximum depth, shadow, and contrast.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">True autumn color <span>palette</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        True autumn is the quintessential fall aesthetic — vibrant, spicy, and incredibly rich. Think pumpkin patches, turning maple leaves, and golden hour sunshine. Brands that want to appear artisanal and grounded use True Autumn (e.g., premium coffee roasters, rustic outdoor gear).
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Autumn colors for design and <span>branding</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        If your brand needs to evoke trust, tradition, organic growth, or artisanal quality, Autumn is your season. Food and beverage industries (especially coffee, whiskey, and organic groceries) heavily depend on deep reds, burnt oranges, and olive greens.
                    </p>
                </section>

                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}