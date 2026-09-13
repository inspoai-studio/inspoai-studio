import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, RefreshCw, Lock, Unlock, Check, GripHorizontal, Palette as PaletteIcon, X } from "lucide-react";
import { Reorder } from "framer-motion";

// Helper to generate a random hex color
const generateRandomHex = () => {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
};
const mixColors = (hex1, hex2, weight) => {
  const d2h = d => d.toString(16).padStart(2, '0');
  const h2d = h => parseInt(h, 16);
  let color1 = hex1.replace('#', '');
  let color2 = hex2.replace('#', '');
  if (color1.length === 3) color1 = color1.split('').map(c => c + c).join('');
  if (color2.length === 3) color2 = color2.split('').map(c => c + c).join('');
  const r1 = h2d(color1.substring(0, 2)),
    g1 = h2d(color1.substring(2, 4)),
    b1 = h2d(color1.substring(4, 6));
  const r2 = h2d(color2.substring(0, 2)),
    g2 = h2d(color2.substring(2, 4)),
    b2 = h2d(color2.substring(4, 6));
  const r = Math.round(r1 * weight + r2 * (1 - weight));
  const g = Math.round(g1 * weight + g2 * (1 - weight));
  const b = Math.round(b1 * weight + b2 * (1 - weight));
  return `#${d2h(r)}${d2h(g)}${d2h(b)}`.toUpperCase();
};
const getShades = hex => {
  return [mixColors(hex, "#FFFFFF", 0.15), mixColors(hex, "#FFFFFF", 0.45), hex, mixColors(hex, "#000000", 0.55), mixColors(hex, "#000000", 0.25)];
};
export default function ColorPaletteGenerator() {
  const [colors, setColors] = useState([{
    id: "1",
    hex: "#000000",
    locked: false
  }, {
    id: "2",
    hex: "#000000",
    locked: false
  }, {
    id: "3",
    hex: "#000000",
    locked: false
  }, {
    id: "4",
    hex: "#000000",
    locked: false
  }, {
    id: "5",
    hex: "#000000",
    locked: false
  }]);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [showShadesFor, setShowShadesFor] = useState(null);

  // Initial generation
  useEffect(() => {
    generatePalette();

    // Setup spacebar listener
    const handleKeyDown = e => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        generatePalette();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const generatePalette = () => {
    setColors(prev => prev.map(color => {
      if (color.locked) return color;
      return {
        ...color,
        hex: generateRandomHex()
      };
    }));
  };
  const toggleLock = index => {
    setColors(prev => {
      const newColors = [...prev];
      newColors[index].locked = !newColors[index].locked;
      return newColors;
    });
  };
  const handleColorChange = (index, newHex) => {
    setColors(prev => {
      const newColors = [...prev];
      newColors[index].hex = newHex.toUpperCase();
      return newColors;
    });
  };
  const copyToClipboard = (hex, index) => {
    navigator.clipboard.writeText(hex);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  // Calculate text color based on background brightness
  const getContrastYIQ = hexcolor => {
    hexcolor = hexcolor.replace("#", "");
    if (hexcolor.length === 3) {
      hexcolor = hexcolor.split('').map(char => char + char).join('');
    }
    const r = parseInt(hexcolor.substr(0, 2), 16);
    const g = parseInt(hexcolor.substr(2, 2), 16);
    const b = parseInt(hexcolor.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "Color Palette Generator by Inspo AI",
      "applicationCategory": "DesignApplication",
      "operatingSystem": "All",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      }
    }, {
      "@type": "FAQPage",
      "mainEntity": [{
        "@type": "Question",
        "name": "How do I generate new colors?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "You can click the 'Generate' button or simply press the Spacebar on your keyboard to instantly generate a new cohesive color palette."
        }
      }, {
        "@type": "Question",
        "name": "Can I lock specific colors I like?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Click the padlock icon on any color column to lock it in place. When you generate a new palette, the locked colors will remain unchanged."
        }
      }, {
        "@type": "Question",
        "name": "How do I view different shades of a color?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Hover over a color column and click the Palette icon to reveal a selection of lighter and darker shades for that specific color."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Color Palette Generator" relatedTools={[{
    name: "HEX to RGB Converter",
    href: "/free-tools/hex-to-rgb-converter"
  }, {
    name: "Contrast Checker",
    href: "/free-tools/color-contrast-checker"
  }]}>
            <SEO title="Free Color Palette Generator | Export CSS & HEX | Inspo AI" description="Instantly generate beautiful, cohesive color palettes for your design projects. Lock colors, press space to refresh, and export instantly. 100% free." keywords="color palette generator, generate colors, random color palette, hex color generator, design color schemes" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Color Palette <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Press the <strong className="text-foreground bg-secondary px-2 py-0.5 rounded-md text-sm border border-border">Spacebar</strong> to generate a new palette. Lock colors you love to build around them.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo p-4 sm:p-8">

                    {/* Controls */}
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={generatePalette} className="bg-primary text-primary-foreground hover:brightness-110 px-6 py-3 rounded-full font-medium transition-all shadow-md flex items-center gap-2">
                            <RefreshCw size={18} /> Generate <span className="hidden sm:inline">(Space)</span>
                        </button>
                    </div>

                    {/* Palette Grid */}
                    <Reorder.Group axis={window.innerWidth >= 768 ? "x" : "y"} values={colors} onReorder={setColors} className="flex flex-col md:flex-row h-[600px] md:h-[500px] rounded-2xl overflow-hidden shadow-lg border border-border/40">
                        {colors.map((color, index) => {
            const textColor = getContrastYIQ(color.hex);
            return <Reorder.Item key={color.id} value={color} className="flex-1 relative group flex flex-col md:flex-col justify-end p-4 md:p-6 transition-colors duration-300" style={{
              backgroundColor: color.hex
            }}>
                                    {/* Shades Overlay */}
                                    {showShadesFor === color.id && <div className="absolute inset-0 z-30 flex flex-col bg-background">
                                            {getShades(color.hex).map((shade, i) => <div key={i} className="flex-1 relative group/shade flex items-center justify-center transition-colors" style={{
                  backgroundColor: shade
                }}>
                                                    <button onClick={() => {
                    handleColorChange(index, shade);
                    setShowShadesFor(null);
                  }} className={`absolute inset-0 w-full h-full opacity-0 group-hover/shade:opacity-100 bg-black/10 backdrop-blur-sm transition-opacity font-mono text-sm font-bold flex flex-col items-center justify-center ${getContrastYIQ(shade)}`}>
                                                        <span>Use {shade}</span>
                                                    </button>
                                                </div>)}
                                            <button onClick={() => setShowShadesFor(null)} className="absolute top-3 right-3 p-1.5 bg-black/40 text-white rounded-full hover:bg-black/60 transition-colors z-40">
                                                <X size={16} />
                                            </button>
                                        </div>}

                                    {/* Hover Actions */}
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 backdrop-blur-[2px] gap-3 pt-8 pb-16">
                                        <button onClick={() => copyToClipboard(color.hex, index)} className={`p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors ${textColor}`} title="Copy HEX">
                                            {copiedIndex === index ? <Check size={20} /> : <Copy size={20} />}
                                        </button>
                                        <button onClick={() => toggleLock(index)} className={`p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors ${textColor}`} title={color.locked ? "Unlock color" : "Lock color"}>
                                            {color.locked ? <Lock size={20} /> : <Unlock size={20} />}
                                        </button>
                                        <button onClick={() => setShowShadesFor(color.id)} className={`p-3 rounded-full bg-white/20 hover:bg-white/40 backdrop-blur-md transition-colors ${textColor}`} title="View Shades">
                                            <PaletteIcon size={20} />
                                        </button>
                                    </div>

                                    {/* Drag Handle Top */}
                                    <div className={`absolute top-4 left-1/2 -translate-x-1/2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-xl bg-white/10 backdrop-blur-md ${textColor}`}>
                                        <GripHorizontal size={20} />
                                    </div>

                                    {/* Color Info Footer */}
                                    <div className={`mt-auto text-center font-bold tracking-wider z-10 flex flex-col items-center gap-1 ${textColor}`}>
                                        <div className="flex items-center gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity mb-2">
                                            <button onClick={() => toggleLock(index)} className="p-1 hover:bg-white/20 rounded-md">
                                                {color.locked ? <Lock size={16} /> : <Unlock size={16} />}
                                            </button>
                                        </div>
                                        <input type="text" value={color.hex} onChange={e => handleColorChange(index, e.target.value)} className={`bg-transparent border-none outline-none text-center uppercase cursor-text w-full font-mono text-lg ${textColor}`} spellCheck={false} />
                                    </div>
                                </Reorder.Item>;
          })}
                    </Reorder.Group>
                </div>

            </div>
        </FreeToolLayout>;
}