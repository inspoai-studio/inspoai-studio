import React, { useState } from "react";

import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { PaletteGenerator, FaqAccordion } from "./ColorPaletteUI";
import { TabsUI } from "./TabsUI";
import { generatePaletteColors } from "./colors";
import { ArrowRight, Moon, Sun } from "lucide-react";
const SUB_TYPES = {
  true: {
    label: "True Winter",
    defaultPalette: ["#0D1B2A", "#1B263B", "#415A77", "#778DA9", "#E0E1DD", "#C0C0C0", "#2E86AB", "#F8F8FF"],
    generate: () => generatePaletteColors(8, [200, 240], [30, 80], [10, 95]),
    accents: [{
      color: "#FFFFFF",
      label: "Pure White"
    }, {
      color: "#000000",
      label: "True Black"
    }, {
      color: "#E32636",
      label: "Crimson"
    }],
    fontLabel: "Inter + Space Grotesk"
  },
  cool: {
    label: "Cool Winter",
    defaultPalette: ["#1B3B6F", "#065A82", "#1C7293", "#9EB3C2", "#C5D0D9", "#D9E1E8", "#21162C", "#14213D"],
    generate: () => generatePaletteColors(8, [200, 270], [40, 70], [20, 90]),
    accents: [{
      color: "#F0F8FF",
      label: "Alice Blue"
    }, {
      color: "#6A5ACD",
      label: "Slate Blue"
    }, {
      color: "#B0C4DE",
      label: "Steel Blue"
    }],
    fontLabel: "Raleway + Open Sans"
  },
  deep: {
    label: "Deep Winter",
    defaultPalette: ["#1A1A2E", "#16213E", "#0F3460", "#533483", "#8B0000", "#C70039", "#2C3E50", "#1B1B2F"],
    generate: () => generatePaletteColors(8, [200, 340], [40, 80], [10, 35]),
    accents: [{
      color: "#FFFFFF",
      label: "Stark White"
    }, {
      color: "#C0C0C0",
      label: "Silver"
    }, {
      color: "#ADD8E6",
      label: "Ice Blue"
    }],
    fontLabel: "Bodoni Moda + Inter"
  },
  bright: {
    label: "Bright Winter",
    defaultPalette: ["#FF0055", "#00F0FF", "#8A38FF", "#00FF66", "#FF00AA", "#1A1A1A", "#FFFFFF", "#FFFF00"],
    generate: () => generatePaletteColors(8, [0, 360], [80, 100], [40, 60]),
    accents: [{
      color: "#000000",
      label: "Jet Black"
    }, {
      color: "#F8F8FF",
      label: "Ghost White"
    }, {
      color: "#FFDF00",
      label: "Gold"
    }],
    fontLabel: "Outfit + DM Sans"
  }
};
const PRE_MADE_PALETTES = {
  true: [{
    name: "True Winter Arctic",
    colors: ["#0D1B2A", "#1B263B", "#415A77", "#778DA9", "#E0E1DD", "#C0C0C0", "#2E86AB", "#F8F8FF"]
  }, {
    name: "True Winter Zenith",
    colors: ["#0A1128", "#1282A2", "#034078", "#001F54", "#FEFCFB", "#DCE1DE", "#1F2041", "#4B3F72"]
  }],
  cool: [{
    name: "Cool Winter Glacier",
    colors: ["#1B3B6F", "#065A82", "#1C7293", "#9EB3C2", "#C5D0D9", "#D9E1E8", "#21162C", "#14213D"]
  }, {
    name: "Cool Winter Slate",
    colors: ["#2B2D42", "#8D99AE", "#EDF2F4", "#EF233C", "#D90429", "#1D3557", "#457B9D", "#A8DADC"]
  }],
  deep: [{
    name: "Deep Winter Obsidian",
    colors: ["#0B0B1A", "#121226", "#1A1A36", "#242447", "#09172E", "#0F2547", "#1A3666", "#2B5299"]
  }, {
    name: "Deep Winter Garnet",
    colors: ["#3D0000", "#5C0000", "#7A0000", "#A30000", "#240004", "#42000B", "#660013", "#8A001A"]
  }],
  bright: [{
    name: "Bright Winter Prism",
    colors: ["#FF0055", "#00F0FF", "#8A38FF", "#00FF66", "#FF00AA", "#1A1A1A", "#FFFFFF", "#FFFF00"]
  }, {
    name: "Bright Winter Electric",
    colors: ["#F72585", "#7209B7", "#3A0CA3", "#4361EE", "#4CC9F0", "#F8F9FA", "#212529", "#E83151"]
  }]
};
const FAQ_ITEMS = [{
  q: "What are the four winter color palette types?",
  a: "True Winter (bold, primary contrast), Cool Winter (icy, blue-based), Deep Winter (dark, jewel-toned), and Bright Winter (vivid, clear, high-energy). All share cool undertones and high clarity."
}, {
  q: "What colors are in a cool winter palette?",
  a: "Cool winter includes icy blue, silver, charcoal, cool pink, lavender, true white, navy, and blue-based red. All colors have a distinctly cool, blue undertone with high clarity."
}, {
  q: "What is the difference between winter and summer palettes?",
  a: "Both are cool-toned, but winter colors are clear, saturated, and high-contrast. Summer colors are muted, soft, and low-contrast. Winter is bold; summer is gentle."
}, {
  q: "What industries use winter color palettes?",
  a: "Winter palettes are common in technology, finance, healthcare, SaaS, automotive, and luxury fashion. The clean, high-contrast look conveys professionalism, innovation, and trust."
}, {
  q: "What is the best winter color for a website background?",
  a: "Deep navy (#0D1B2A) and near-black (#1B263B) work great for dark mode. Ghost white (#F8F8FF) and platinum (#E0E1DD) ideal for light mode. Both are classic winter background choices."
}];
const SubTypeTool = ({
  typeId,
  isDark
}) => {
  const typeData = SUB_TYPES[typeId];
  const [currentPalette, setCurrentPalette] = React.useState(typeData.defaultPalette);
  const rightPanel = <div className="flex flex-col gap-5">
            <div>
                <h3 className={`text-sm font-semibold mb-3 ${isDark ? "text-white" : "text-foreground"}`}>Accent Colors</h3>
                <div className="flex items-center gap-2">
                    {typeData.accents.map(a => <div key={a.color} className="flex flex-col items-center gap-1">
                            <div className={`w-9 h-9 rounded-full shadow-sm ${isDark ? "border border-white/20" : "border border-border"}`} style={{
            background: a.color
          }} title={a.label} />
                            <span className={`text-[10px] text-center leading-tight ${isDark ? "text-white/60" : "text-muted-foreground"}`}>{a.label}</span>
                        </div>)}
                </div>
            </div>

            <div>
                <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-foreground"}`}>Font Pairings</h3>
                <p className={`text-xs mb-1 ${isDark ? "text-white/70" : "text-muted-foreground"}`}>
                    <strong className={isDark ? "text-white" : "text-foreground"}>{typeData.fontLabel.split(" + ")[0]}</strong>{" "}
                    + <strong className={isDark ? "text-white" : "text-foreground"}>{typeData.fontLabel.split(" + ")[1]}</strong>
                </p>
                <div style={{
        fontFamily: "Georgia, serif"
      }} className={`text-base leading-tight ${isDark ? "text-white" : "text-foreground"}`}>Clear, Crisp Header</div>
                <div className={`text-xs mt-0.5 ${isDark ? "text-white/60" : "text-muted-foreground"}`}>Precision tech aesthetic</div>
            </div>

            <div>
                <h3 className={`text-sm font-semibold mb-2 ${isDark ? "text-white" : "text-foreground"}`}>Sample UI Preview</h3>
                <div className={`rounded-xl overflow-hidden border shadow-sm ${isDark ? "border-white/10" : "border-border"}`}>
                    <div className="h-2" style={{
          background: isDark ? currentPalette[3] : currentPalette[2]
        }} />
                    <div className="p-3" style={{
          background: isDark ? "#0D0D1A" : "white"
        }}>
                        <div className={`w-2/3 h-2.5 rounded-full mb-2 ${isDark ? "bg-white/90" : ""}`} style={!isDark ? {
            background: currentPalette[0]
          } : undefined} />
                        <div className={`w-full h-1.5 rounded-full mb-1 ${isDark ? "bg-white/20" : "bg-neutral-100"}`} />
                        <div className={`w-3/4 h-1.5 rounded-full mb-3 ${isDark ? "bg-white/15" : "bg-neutral-100"}`} />
                        <button className="text-white px-3 py-1 rounded-full text-[10px] font-semibold" style={{
            background: currentPalette[typeId === "bright" ? 0 : 5] || currentPalette[3]
          }}>
                            Read More
                        </button>
                    </div>
                </div>
            </div>
        </div>;
  return <PaletteGenerator initialColors={currentPalette} onGenerateNew={() => {
    const c = typeData.generate();
    setCurrentPalette(c);
    return c;
  }} isDarkHero={isDark} rightPanelContent={rightPanel} />;
};
export default function WinterColorPalette() {
  const [isDark, setIsDark] = useState(false);
  const tabs = [{
    id: "true",
    label: "True Winter",
    content: <SubTypeTool typeId="true" isDark={isDark} />
  }, {
    id: "cool",
    label: "Cool Winter",
    content: <SubTypeTool typeId="cool" isDark={isDark} />
  }, {
    id: "deep",
    label: "Deep Winter",
    content: <SubTypeTool typeId="deep" isDark={isDark} />
  }, {
    id: "bright",
    label: "Bright Winter",
    content: <SubTypeTool typeId="bright" isDark={isDark} />
  }];
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Winter Color Palette Generator by Inspo AI",
    "applicationCategory": "DesignApplication",
    "operatingSystem": "All",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    }
  };
  return <FreeToolLayout toolName="Winter Color Palette Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "Summer Color Palette",
    href: "/free-tools/summer-color-palette"
  }]}>
            <SEO title="Winter Color Palette Generator | Free HEX & PNG" description="Generate bold, cool, high-contrast winter color palettes: true, cool, deep, and bright winter. Free hex codes and PNG export." keywords="winter color palette, cool winter colors, deep winter palette, bright winter, high contrast palette" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Winter Color <span className="inspo-gradient-text">Palette</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Generate bold, cool, and high-contrast palettes across all four winter sub-types. Download PNG or copy hex codes instantly.
                    </p>
                </div>

                <section className={`rounded-3xl border shadow-inspo p-6 sm:p-8 flex flex-col items-center mb-16 transition-colors duration-300 ${isDark ? "bg-[#0A0A14] border-white/10" : "bg-card border-border"}`}>
                    {/* Dark/Light Toggle */}
                    <div className="flex justify-center mb-8">
                        <button onClick={() => setIsDark(!isDark)} className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${isDark ? "bg-white text-[#0A0A14]" : "bg-[#0A0A14] text-white"}`}>
                            {isDark ? <><Sun size={14} /> Light Mode Preview</> : <><Moon size={14} /> Dark Mode Preview</>}
                        </button>
                    </div>
                    <TabsUI tabs={tabs} defaultTabId="true" isDarkHero={isDark} />
                </section>

                <section className="mb-16">
                    <h2 className="text-2xl font-display font-semibold mb-6 border-b pb-4">Explore winter <span>sub-types</span></h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                        {Object.entries(PRE_MADE_PALETTES).map(([type, palettes]) => <React.Fragment key={type}>
                                {palettes.map(p => <div key={p.name} className="bg-card rounded-xl border border-border shadow-sm p-4">
                                        <h4 className="font-medium text-sm mb-3">{p.name}</h4>
                                        <div className="flex h-6 rounded overflow-hidden mb-3">
                                            {p.colors.map(c => <div key={c} className="flex-1" style={{
                  background: c
                }} />)}
                                        </div>
                                        {type === "deep" ? <span className="text-xs font-semibold text-primary hover:underline flex items-center gap-1" style={{ cursor: "default" }}>
                                                View full Deep Winter <ArrowRight size={12} />
                                            </span> : <span className="text-xs text-muted-foreground font-medium">Part of {SUB_TYPES[type].label}</span>}
                                    </div>)}
                            </React.Fragment>)}
                    </div>
                </section>

                <section className="max-w-3xl mx-auto mb-4">
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        A winter color palette uses cool, clear, high-contrast colors. From icy blues and sharp silvers to deep navy and bright jewel tones, winter palettes feel bold, crisp, and modern. This generator covers all four winter sub-types: true winter, cool winter, deep winter, and bright winter.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Winter color palette <span>sub-types</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        <span className="text-primary hover:underline" style={{ cursor: "default" }}>Deep Winter</span> favors shadows and near-black jewel tones. True Winter is perfectly balanced with maximum clarity and primary colors. Cool Winter favors crisp blues and icy grays. Bright Winter borders Spring — injecting tremendous saturation and neon energy into cool tones.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">True winter color <span>palette</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        True Winter is classic, bold, and unapologetic. The defining characteristic is maximum contrast — putting pitch black directly next to pristine white. It heavily utilizes cardinal red, emerald green, and perfect sapphire blue. Zero blending or haziness allowed.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Winter vs summer color <span>palettes</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed mb-8">
                        Both are cool-toned, but winter rejects grey — instead pushing colors to the extremes of saturation or darkness. Summer softens everything with grey. You <span className="text-primary hover:underline" style={{ cursor: "default" }}>visit Summer for comfort</span>; you use Winter for power.
                    </p>

                    <h2 className="text-xl font-display font-semibold text-foreground mt-10 mb-3">Winter colors for design and <span>branding</span></h2>
                    <p className="text-base text-muted-foreground leading-relaxed">
                        Winter palettes dominate B2B SaaS, tech, and enterprise applications. A dark slate sidebar paired with a crisp primary-blue CTA button is classic True Winter. These colors project competency, logic, efficiency, and stability — the language of professional software.
                    </p>
                </section>

                <FaqAccordion items={FAQ_ITEMS} />
            </div>
        </FreeToolLayout>;
}