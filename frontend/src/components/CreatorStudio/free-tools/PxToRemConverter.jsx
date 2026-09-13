import { useState } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { ArrowLeftRight, Copy, Check, Type } from "lucide-react";
export default function PxToRemConverter() {
  const [baseSize, setBaseSize] = useState(16);
  const [pxValue, setPxValue] = useState("24");
  const [remValue, setRemValue] = useState("1.5");
  const [copiedStates, setCopiedStates] = useState({});

  // When PX changes
  const handlePxChange = e => {
    const val = e.target.value;
    setPxValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setRemValue(parseFloat((parsed / baseSize).toFixed(4)).toString());
    } else {
      setRemValue("");
    }
  };

  // When REM changes
  const handleRemChange = e => {
    const val = e.target.value;
    setRemValue(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setPxValue(parseFloat((parsed * baseSize).toFixed(4)).toString());
    } else {
      setPxValue("");
    }
  };

  // When Base Size changes
  const handleBaseChange = e => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && val > 0) {
      setBaseSize(val);
      // Re-calculate REM based on current PX
      const p = parseFloat(pxValue);
      if (!isNaN(p)) setRemValue(parseFloat((p / val).toFixed(4)).toString());
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
  const generateScale = () => {
    // Generate a standard Tailwind-like scale
    const scaleValues = [12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72];
    return scaleValues.map(px => ({
      px,
      rem: parseFloat((px / baseSize).toFixed(4))
    }));
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "PX to REM Converter by Inspo AI",
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
        "name": "Why should I use REM instead of Pixels?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "REMs scale based on the user's browser-level font size preferences. If a visually impaired user increases their default font size from 16px to 24px, your entire design scales proportionately. Hardcoded pixels break accessibility."
        }
      }, {
        "@type": "Question",
        "name": "How is the conversion calculated?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The formula to calculate REM is: Target PX / Base Size = REM. For example, if your base size is 16px, converting 24px is simply 24 / 16 = 1.5rem."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="PX to REM Converter" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "Lorem Ipsum Generator",
    href: "/free-tools/lorem-ipsum-generator"
  }]}>
            <SEO title="Free PX to REM Converter | CSS Units Calculator | Inspo AI" description="Easily convert pixels to REM or EM units for scalable, accessible web typography. Free online tool for web developers and designers." keywords="px to rem, pixel to rem converter, px to em, css units, web typography" schemaMarkup={schemaMarkup} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        PX to REM <span className="inspo-gradient-text">Converter</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Quickly swap between pixels and REM units for accessible typography. Adjust the base size to fit your root CSS.
                    </p>
                </div>

                <div className="grid md:grid-cols-12 gap-8 items-start">

                    {/* Calculator Section */}
                    <div className="md:col-span-7 bg-card rounded-3xl border border-border shadow-inspo overflow-hidden flex flex-col">
                        <div className="p-8 border-b border-border bg-secondary/30 flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-lg text-foreground mb-1">Base font <span>size</span></h2>
                                <p className="text-sm text-muted-foreground">The <code>font-size</code> applied to the `&lt;html&gt;` root element.</p>
                            </div>
                            <div className="flex items-center gap-2 bg-background border border-border rounded-xl px-4 py-2">
                                <input type="number" value={baseSize} onChange={handleBaseChange} className="w-12 bg-transparent outline-none font-mono font-bold text-center text-foreground" />
                                <span className="text-muted-foreground font-medium">px</span>
                            </div>
                        </div>

                        <div className="p-8 lg:p-12 flex-1 flex flex-col justify-center">
                            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-4 relative">

                                <div className="flex-1 w-full relative group">
                                    <label className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 block">Pixels (PX)</label>
                                    <input type="number" value={pxValue} onChange={handlePxChange} className="w-full bg-secondary text-foreground p-6 rounded-2xl border-2 border-transparent focus:border-primary outline-none font-mono text-3xl transition-all" placeholder="0" />
                                    <button onClick={() => copyToClipboard(`${pxValue}px`, 'px')} className="absolute right-4 top-[46px] p-2 bg-background/80 hover:bg-background rounded-lg shadow-sm border border-border/50 transition-colors text-muted-foreground">
                                        {copiedStates['px'] ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                    </button>
                                </div>

                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0 z-10 w-12 h-12 rounded-full bg-primary flex items-center justify-center text-primary-foreground shadow-lg border-4 border-card">
                                    <ArrowLeftRight size={20} />
                                </div>

                                <div className="flex-1 w-full relative group">
                                    <label className="text-sm font-semibold text-foreground uppercase tracking-wider mb-2 block">REM Unit</label>
                                    <input type="number" value={remValue} onChange={handleRemChange} className="w-full bg-primary/5 text-foreground p-6 rounded-2xl border-2 border-primary/20 focus:border-primary outline-none font-mono text-3xl transition-all" placeholder="0" />
                                    <button onClick={() => copyToClipboard(`${remValue}rem`, 'rem')} className="absolute right-4 top-[46px] p-2 bg-background/80 hover:bg-background rounded-lg shadow-sm border border-border/50 transition-colors text-muted-foreground">
                                        {copiedStates['rem'] ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                                    </button>
                                </div>

                            </div>

                            <div className="mt-12 bg-secondary/30 rounded-2xl p-6 border border-border flex items-center justify-center min-h-[120px]">
                                <span className="font-display font-medium text-foreground transition-all truncate max-w-full" style={{
                fontSize: `${pxValue}px`
              }}>
                                    Typography Preview
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Scale Reference Side */}
                    <div className="md:col-span-5 bg-card rounded-3xl border border-border shadow-inspo p-6">
                        <div className="flex items-center gap-2 mb-6">
                            <Type size={20} className="text-primary" />
                            <h3 className="font-bold text-foreground">Common Scale</h3>
                        </div>

                        <div className="overflow-hidden rounded-xl border border-border text-sm">
                            <div className="grid grid-cols-2 bg-secondary/80 font-semibold p-3 border-b border-border">
                                <div className="pl-2">Pixels</div>
                                <div>REM</div>
                            </div>
                            <div className="divide-y divide-border">
                                {generateScale().map((item, i) => <div key={i} className="grid grid-cols-2 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => {
                setPxValue(item.px.toString());
                setRemValue(item.rem.toString());
              }}>
                                        <div className="font-mono text-foreground pl-2">{item.px}px</div>
                                        <div className="font-mono text-primary flex justify-between items-center pr-2">
                                            {item.rem}rem
                                            <span className="opacity-0 group-hover:opacity-100 text-muted-foreground transition-opacity text-xs bg-background px-2 py-0.5 rounded border border-border shadow-sm">Click</span>
                                        </div>
                                    </div>)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Text */}
                <div className="mt-16 grid md:grid-cols-2 gap-8 pt-12 border-t border-border/40">
                    <div>
                        <h3 className="font-bold text-foreground mb-3 text-lg">Why use REMs instead of Pixels?</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            REMs (Root EM) scale based on the user's browser-level font size preferences. If a visually impaired user increases their default font size from 16px to 24px, your entire design scales proportionately. Hardcoded pixels break accessibility.
                        </p>
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground mb-3 text-lg">How is this calculated?</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-3">
                            The formula to calculate REM is: <code className="bg-secondary px-2 py-1 rounded text-foreground font-mono">Target PX / Base Size = REM</code>
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            For example, if your base size is 16px, converting 24px is simply <code className="bg-secondary px-2 py-1 rounded text-foreground font-mono">24 / 16 = 1.5rem</code>. By keeping your root font-size at 100%, you respect the user's OS choices.
                        </p>
                    </div>
                </div>

            </div>
        </FreeToolLayout>;
}