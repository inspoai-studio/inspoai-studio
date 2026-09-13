import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";
export default function ContrastChecker() {
  const [foreground, setForeground] = useState("#FFFFFF");
  const [background, setBackground] = useState("#0066FF");
  const [contrastRatio, setContrastRatio] = useState(0);

  // WCAG Results
  const [aaLarge, setAaLarge] = useState(false);
  const [aaNormal, setAaNormal] = useState(false);
  const [aaaLarge, setAaaLarge] = useState(false);
  const [aaaNormal, setAaaNormal] = useState(false);
  useEffect(() => {
    calculateContrast();
  }, [foreground, background]);

  // Calculate relative luminance
  const getLuminance = (r, g, b) => {
    const a = [r, g, b].map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  };

  // Hex to RGB
  const hexToRgb = hex => {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split('').map(char => char + char).join('');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return {
      r,
      g,
      b
    };
  };
  const calculateContrast = () => {
    // Validation
    const isValid = /^#([0-9A-Fa-f]{3}){1,2}$/;
    const fg = foreground.startsWith('#') ? foreground : '#' + foreground;
    const bg = background.startsWith('#') ? background : '#' + background;
    if (!isValid.test(fg) || !isValid.test(bg)) return;
    const fgRgb = hexToRgb(fg);
    const bgRgb = hexToRgb(bg);
    const lum1 = getLuminance(fgRgb.r, fgRgb.g, fgRgb.b);
    const lum2 = getLuminance(bgRgb.r, bgRgb.g, bgRgb.b);
    const lightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    const ratio = (lightest + 0.05) / (darkest + 0.05);
    setContrastRatio(parseFloat(ratio.toFixed(2)));
    setAaNormal(ratio >= 4.5);
    setAaLarge(ratio >= 3.0);
    setAaaNormal(ratio >= 7.0);
    setAaaLarge(ratio >= 4.5);
  };
  const invertColors = () => {
    const temp = foreground;
    setForeground(background);
    setBackground(temp);
  };
  const StatusIcon = ({
    pass
  }) => {
    return pass ? <div className="bg-green-500/10 text-green-600 dark:text-green-400 p-1.5 rounded-full">
                <CheckCircle2 size={16} />
            </div> : <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-1.5 rounded-full">
                <XCircle size={16} />
            </div>;
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "Color Contrast Checker by Inspo AI",
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
        "name": "What is a good color contrast ratio?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "According to WCAG (Web Content Accessibility Guidelines), a good contrast ratio is at least 4.5:1 for normal text and 3:1 for large text to meet AA standards. For the stricter AAA standard, you need 7:1 for normal text and 4.5:1 for large text."
        }
      }, {
        "@type": "Question",
        "name": "Why is color contrast important?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Adequate color contrast ensures that text is readable by everyone, including people with visual impairments or color vision deficiencies. It is a critical component of web accessibility and inclusive design."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Color Contrast Checker" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "HEX to RGB Converter",
    href: "/free-tools/hex-to-rgb-converter"
  }]}>
            <SEO title="Free Color Contrast Checker | WCAG Compliance Tool | Inspo AI" description="Test foreground and background color contrast against WCAG AA and AAA accessibility standards. Ensure your digital designs are readable." keywords="color contrast checker, wcag contrast checker, accessibility color tool, wcag aa aaa, web design contrast ratio" schemaMarkup={schemaMarkup} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Contrast <span className="inspo-gradient-text">Checker</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Ensure your text is readable and accessible to everyone. Test your color combinations against official WCAG standards.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">

                        {/* Editor Side */}
                        <div className="p-8 lg:p-12">
                            <h2 className="text-xl font-bold text-foreground mb-8">Select <span>colors</span></h2>

                            <div className="space-y-6 relative">

                                {/* Foreground */}
                                <div>
                                    <label className="text-sm font-semibold text-foreground tracking-wider mb-2 block">Text Color (Foreground)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0">
                                            <input type="color" value={foreground} onChange={e => setForeground(e.target.value)} className="absolute -inset-2 w-20 h-20 cursor-pointer" />
                                        </div>
                                        <input type="text" value={foreground} onChange={e => setForeground(e.target.value)} className="w-full bg-secondary text-foreground p-3 rounded-xl border border-border outline-none focus:border-primary/50 font-mono text-lg uppercase transition-colors" />
                                    </div>
                                </div>

                                <button onClick={invertColors} className="absolute left-6 top-[37px] z-10 w-10 h-10 rounded-full bg-background border border-border shadow-sm flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" aria-label="Invert Colors" title="Invert Colors">
                                    <RefreshCw size={16} />
                                </button>

                                {/* Background */}
                                <div>
                                    <label className="text-sm font-semibold text-foreground tracking-wider mb-2 block">Background Color</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-border flex-shrink-0">
                                            <input type="color" value={background} onChange={e => setBackground(e.target.value)} className="absolute -inset-2 w-20 h-20 cursor-pointer" />
                                        </div>
                                        <input type="text" value={background} onChange={e => setBackground(e.target.value)} className="w-full bg-secondary text-foreground p-3 rounded-xl border border-border outline-none focus:border-primary/50 font-mono text-lg uppercase transition-colors" />
                                    </div>
                                </div>
                            </div>

                            <div className="mt-8 pt-8 border-t border-border">
                                <p className="text-sm text-muted-foreground flex items-start gap-2 leading-relaxed">
                                    <AlertTriangle size={16} className="text-yellow-500 shrink-0 mt-0.5" />
                                    WCAG requires a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text to pass AA standards.
                                </p>
                            </div>
                        </div>

                        {/* Preview / Results Side */}
                        <div className="p-8 lg:p-12 bg-secondary/10 flex flex-col">

                            {/* Live Text Preview */}
                            <div className="w-full rounded-2xl border border-border/50 p-6 md:p-8 flex flex-col justify-center mb-8 h-[200px]" style={{
              backgroundColor: background,
              color: foreground
            }}>
                                <h3 className="font-display font-bold text-2xl md:text-3xl mb-3 leading-tight tracking-tight">
                                    The quick brown fox jumps over the lazy dog
                                </h3>
                                <p className="text-sm sm:text-base opacity-90 leading-relaxed font-body">
                                    This is how normal paragraph text will look with your selected colors. Good contrast ensures people with visual impairments can read your content comfortably.
                                </p>
                            </div>

                            {/* Score Results */}
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-8 pb-6 border-b border-border">
                                    <span className="font-semibold text-foreground tracking-wider uppercase">Contrast Ratio</span>
                                    <span className={`font-mono text-4xl font-bold tracking-tight ${contrastRatio >= 4.5 ? 'text-green-500' : contrastRatio >= 3.0 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {contrastRatio}:1
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold text-sm tracking-wider uppercase text-foreground">WCAG AA</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center bg-secondary/50 rounded-lg px-3 py-2">
                                                <span className="text-sm text-foreground">Normal Text</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-muted-foreground">4.5:1</span>
                                                    <StatusIcon pass={aaNormal} />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-secondary/50 rounded-lg px-3 py-2">
                                                <span className="text-sm text-foreground">Large Text</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-muted-foreground">3.0:1</span>
                                                    <StatusIcon pass={aaLarge} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                                        <div className="flex justify-between items-center mb-3">
                                            <span className="font-bold text-sm tracking-wider uppercase text-foreground">WCAG AAA</span>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center bg-secondary/50 rounded-lg px-3 py-2">
                                                <span className="text-sm text-foreground">Normal Text</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-muted-foreground">7.0:1</span>
                                                    <StatusIcon pass={aaaNormal} />
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center bg-secondary/50 rounded-lg px-3 py-2">
                                                <span className="text-sm text-foreground">Large Text</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-mono font-bold text-muted-foreground">4.5:1</span>
                                                    <StatusIcon pass={aaaLarge} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}