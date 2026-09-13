import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, Check, ArrowRightLeft } from "lucide-react";
export default function HexToRgb() {
  const [hex, setHex] = useState("#008CFF");
  const [rgb, setRgb] = useState("rgb(0, 140, 255)");
  const [hsl, setHsl] = useState("hsl(207, 100%, 50%)");
  const [cmyk, setCmyk] = useState("cmyk(100%, 45%, 0%, 0%)");
  const [copiedStates, setCopiedStates] = useState({});
  useEffect(() => {
    convertColor(hex);
  }, []);
  const convertColor = hexValue => {
    // Ensure hex starts with #
    let cleanHex = hexValue;
    if (!cleanHex.startsWith('#')) {
      cleanHex = '#' + cleanHex;
    }

    // Validate hex before processing
    if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(cleanHex)) {
      return;
    }
    let r = 0,
      g = 0,
      b = 0;
    if (cleanHex.length === 4) {
      r = parseInt(cleanHex[1] + cleanHex[1], 16);
      g = parseInt(cleanHex[2] + cleanHex[2], 16);
      b = parseInt(cleanHex[3] + cleanHex[3], 16);
    } else if (cleanHex.length === 7) {
      r = parseInt(cleanHex.substring(1, 3), 16);
      g = parseInt(cleanHex.substring(3, 5), 16);
      b = parseInt(cleanHex.substring(5, 7), 16);
    }

    // RGB
    setRgb(`rgb(${r}, ${g}, ${b})`);

    // HSL
    let rNorm = r / 255,
      gNorm = g / 255,
      bNorm = b / 255;
    let cmax = Math.max(rNorm, gNorm, bNorm),
      cmin = Math.min(rNorm, gNorm, bNorm);
    let delta = cmax - cmin;
    let h = 0,
      s = 0,
      l = 0;
    if (delta === 0) h = 0;else if (cmax === rNorm) h = (gNorm - bNorm) / delta % 6;else if (cmax === gNorm) h = (bNorm - rNorm) / delta + 2;else h = (rNorm - gNorm) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    setHsl(`hsl(${h}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`);

    // CMYK
    let c = 0,
      m = 0,
      y = 0,
      k = 0;
    if (r === 0 && g === 0 && b === 0) {
      k = 1;
    } else {
      c = 1 - r / 255;
      m = 1 - g / 255;
      y = 1 - b / 255;
      k = Math.min(c, Math.min(m, y));
      c = (c - k) / (1 - k);
      m = (m - k) / (1 - k);
      y = (y - k) / (1 - k);
    }
    setCmyk(`cmyk(${Math.round(c * 100)}%, ${Math.round(m * 100)}%, ${Math.round(y * 100)}%, ${Math.round(k * 100)}%)`);
  };
  const handleHexChange = e => {
    const val = e.target.value;
    setHex(val);
    convertColor(val);
  };
  const handleRgbChange = e => {
    const val = e.target.value;
    setRgb(val);

    // Try to parse RGB back to hex
    const match = val.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      if (r <= 255 && g <= 255 && b <= 255) {
        const newHex = "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
        setHex(newHex);
        convertColor(newHex);
      }
    }
  };
  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedStates({
      ...copiedStates,
      [id]: true
    });
    setTimeout(() => setCopiedStates({
      ...copiedStates,
      [id]: false
    }), 1500);
  };

  // Calculate light/dark contrast for the big preview card text
  const getContrastYIQ = hexcolor => {
    let clean = hexcolor.replace("#", "");
    if (clean.length === 3) clean = clean.split('').map(char => char + char).join('');
    if (clean.length !== 6) return 'text-black';
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 2), 16);
    const b = parseInt(clean.substring(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? 'text-black' : 'text-white';
  };
  const isValidHex = /^#([0-9A-Fa-f]{3}){1,2}$/.test(hex.startsWith('#') ? hex : '#' + hex);
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "HEX to RGB Converter by Inspo AI",
      "applicationCategory": "DeveloperApplication",
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
        "name": "How do I convert a HEX color to RGB?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Simply type or paste your HEX code (like #FF5733) into the HEX input field. The tool will automatically convert it and display the corresponding RGB, HSL, and CMYK values instantly."
        }
      }, {
        "@type": "Question",
        "name": "Can I convert RGB back to HEX?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can type an RGB value (like rgb(255, 87, 51)) into the RGB input field, and the tool will automatically convert it back into a HEX code."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="HEX to RGB Converter" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "CSS Gradient Generator",
    href: "/free-tools/css-gradient-generator"
  }]}>
            <SEO title="Free HEX to RGB Color Converter | Inspo AI" description="Instantly convert HEX color codes to RGB, HSL, and CMYK formats. Fast, free, and accurate color converter for web designers and developers." keywords="hex to rgb, hex to rgb converter, color code converter, hex to hsl, hex to cmyk, hex color codes" schemaMarkup={schemaMarkup} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Instant Color <span className="inspo-gradient-text">Converter</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Translate color codes across web and print formats instantly. Type a HEX or RGB value and grab all the conversions.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden">
                    <div className="grid md:grid-cols-2">

                        {/* Editor Side */}
                        <div className="p-8 lg:p-12 border-b md:border-b-0 md:border-r border-border">
                            <h2 className="text-xl font-bold text-foreground mb-8 flex items-center gap-2">
                                <ArrowRightLeft className="text-primary" /> Input <span>values</span>
                            </h2>

                            <div className="space-y-6">
                                {/* HEX Input */}
                                <div>
                                    <label className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 block">HEX Code</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md border border-border shadow-sm" style={{
                    backgroundColor: isValidHex ? hex.startsWith('#') ? hex : '#' + hex : 'transparent'
                  }}></div>
                                        <input type="text" value={hex} onChange={handleHexChange} className="w-full bg-secondary text-foreground p-4 pl-14 rounded-xl border border-border outline-none focus:border-primary/50 font-mono text-lg transition-colors" placeholder="#000000" spellCheck={false} />
                                        <button onClick={() => copyToClipboard(hex.startsWith('#') ? hex : '#' + hex, 'hex')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted-foreground">
                                            {copiedStates['hex'] ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* RGB Input */}
                                <div>
                                    <label className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 block">RGB Code</label>
                                    <div className="relative">
                                        <input type="text" value={rgb} onChange={handleRgbChange} className="w-full bg-secondary text-foreground p-4 rounded-xl border border-border outline-none focus:border-primary/50 font-mono text-lg transition-colors" placeholder="rgb(0, 0, 0)" spellCheck={false} />
                                        <button onClick={() => copyToClipboard(rgb, 'rgb')} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-muted-foreground">
                                            {copiedStates['rgb'] ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview & Other Outputs Side */}
                        <div className="p-8 lg:p-12 bg-secondary/10 flex flex-col">
                            {/* Visual Preview */}
                            <div className={`h-40 rounded-2xl shadow-inner border border-border/50 flex items-center justify-center transition-colors duration-300 mb-8 ${isValidHex ? getContrastYIQ(hex) : 'text-muted-foreground bg-secondary'}`} style={{
              backgroundColor: isValidHex ? hex.startsWith('#') ? hex : '#' + hex : undefined
            }}>
                                <span className="font-display text-2xl font-bold tracking-tight">
                                    {isValidHex ? 'Live Preview' : 'Invalid Color'}
                                </span>
                            </div>

                            <h2 className="text-xl font-bold text-foreground mb-6">Other <span>formats</span></h2>

                            <div className="space-y-4">
                                {/* HSL Output */}
                                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">HSL (Web Design)</span>
                                        <code className="font-mono text-foreground text-lg">{hsl}</code>
                                    </div>
                                    <button onClick={() => copyToClipboard(hsl, 'hsl')} className="p-3 hover:bg-secondary rounded-xl transition-colors text-muted-foreground">
                                        {copiedStates['hsl'] ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                                    </button>
                                </div>

                                {/* CMYK Output */}
                                <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1 block">CMYK (Print)</span>
                                        <code className="font-mono text-foreground text-lg">{cmyk}</code>
                                    </div>
                                    <button onClick={() => copyToClipboard(cmyk, 'cmyk')} className="p-3 hover:bg-secondary rounded-xl transition-colors text-muted-foreground">
                                        {copiedStates['cmyk'] ? <Check size={20} className="text-green-500" /> : <Copy size={20} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}