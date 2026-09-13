import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, Check, Droplet } from "lucide-react";
export default function GlassmorphismGen() {
  const [blur, setBlur] = useState(10);
  const [transparency, setTransparency] = useState(0.2);
  const [bgColor, setBgColor] = useState("#FFFFFF");
  const [outline, setOutline] = useState(1);
  const [outlineColor, setOutlineColor] = useState("#FFFFFF");
  const [outlineOpacity, setOutlineOpacity] = useState(0.3);
  const [cssCode, setCssCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    generateCss();
  }, [blur, transparency, bgColor, outline, outlineColor, outlineOpacity]);
  const hexToRgba = (hex, opacity) => {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split('').map(char => char + char).join('');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 2), 16);
    const b = parseInt(clean.substring(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  const generateCss = () => {
    const bgRgba = hexToRgba(bgColor, transparency);
    const borderRgba = hexToRgba(outlineColor, outlineOpacity);
    let code = `background: ${bgRgba};\n`;
    code += `backdrop-filter: blur(${blur}px);\n`;
    code += `-webkit-backdrop-filter: blur(${blur}px);\n`;
    code += `border-radius: 24px;\n`;
    if (outline > 0) {
      code += `border: ${outline}px solid ${borderRgba};\n`;
    }
    setCssCode(code);
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "Glassmorphism CSS Generator by Inspo AI",
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
        "name": "What is Glassmorphism?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Glassmorphism is a UI design trend that creates a 'frosted glass' effect. It relies on background blur, semi-transparent colors, and subtle borders to create depth and visual hierarchy in modern user interfaces."
        }
      }, {
        "@type": "Question",
        "name": "How does the backdrop-filter property work?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "The CSS backdrop-filter property applies graphical effects such as blurring or color shifting to the area behind an element. In this generator, it creates the signature blur effect that makes the background look like frosted glass."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Glassmorphism Generator" relatedTools={[{
    name: "CSS Gradient Generator",
    href: "/free-tools/css-gradient-generator"
  }, {
    name: "Box Shadow Generator",
    href: "/free-tools/box-shadow-generator"
  }]}>
            <SEO title="Free Glassmorphism CSS Generator | Frosted Glass UI | Inspo AI" description="Easily generate frosted glass UI effects for your web app. Adjust blur, transparency, and borders, then copy the pure CSS. Free online design tool." keywords="glassmorphism generator, css glass effect, frosted glass css, backdrop filter blur, ui design tools" schemaMarkup={schemaMarkup} />

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Glassmorphism <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Create beautiful frosted glass effects instantly. Dial in your blur and transparency, then grab the production-ready CSS.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Controls Sidebar */}
                    <div className="lg:col-span-4 bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 flex flex-col gap-6">

                        <div className="flex items-center gap-2 mb-2 pb-6 border-b border-border">
                            <Droplet size={20} className="text-primary" />
                            <h2 className="text-xl font-bold text-foreground"><span>Controls</span></h2>
                        </div>

                        {/* Blur */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Blur Radius</label>
                                <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{blur}px</span>
                            </div>
                            <input type="range" min="0" max="40" value={blur} onChange={e => setBlur(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer" />
                        </div>

                        {/* Transparency */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Transparency</label>
                                <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{Math.round(transparency * 100)}%</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={transparency} onChange={e => setTransparency(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer" />
                        </div>

                        {/* Outline (Border width) */}
                        <div className="pt-4 border-t border-border">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Outline Thickness</label>
                                <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{outline}px</span>
                            </div>
                            <input type="range" min="0" max="5" step="1" value={outline} onChange={e => setOutline(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer mb-4" />
                            {outline > 0 && <>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Outline Opacity</label>
                                        <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{Math.round(outlineOpacity * 100)}%</span>
                                    </div>
                                    <input type="range" min="0" max="1" step="0.01" value={outlineOpacity} onChange={e => setOutlineOpacity(Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer mb-4" />
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Outline Color</label>
                                        <div className="flex items-center gap-2">
                                            <input type="color" value={outlineColor} onChange={e => setOutlineColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                                            <input type="text" value={outlineColor.toUpperCase()} onChange={e => setOutlineColor(e.target.value)} className="w-20 bg-secondary rounded-md px-2 py-1 text-xs font-mono text-foreground outline-none uppercase" />
                                        </div>
                                    </div>
                                </>}
                        </div>

                        {/* Base Color */}
                        <div className="pt-4 border-t border-border mt-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Base Color</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer border-none bg-transparent" />
                                    <input type="text" value={bgColor.toUpperCase()} onChange={e => setBgColor(e.target.value)} className="w-20 bg-secondary rounded-md px-2 py-1 text-xs font-mono text-foreground outline-none uppercase" />
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Output & Preview Area */}
                    <div className="lg:col-span-8 flex flex-col gap-6">

                        {/* Live Preview Pane */}
                        <div className="w-full flex-1 min-h-[400px] rounded-3xl border border-border shadow-inspo relative overflow-hidden flex items-center justify-center p-8 bg-[#0a0a0a]">
                            <div className="absolute inset-0 bg-cover bg-center" style={{
              backgroundImage: `url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')`
            }} />

                            {/* The Glass Component */}
                            <div className="relative z-10 w-full max-w-sm h-64 rounded-[24px] flex flex-col justify-center items-center font-display font-medium text-white shadow-2xl transition-all duration-300" style={{
              background: hexToRgba(bgColor, transparency),
              backdropFilter: `blur(${blur}px)`,
              WebkitBackdropFilter: `blur(${blur}px)`,
              border: outline > 0 ? `${outline}px solid ${hexToRgba(outlineColor, outlineOpacity)}` : 'none'
            }}>
                                <span className="text-2xl drop-shadow-md">Glass Component</span>
                                <span className="text-sm font-mono mt-2 opacity-70">Looks beautiful.</span>
                            </div>
                        </div>

                        {/* CSS Output Window */}
                        <div className="bg-[#1A1A1A] rounded-3xl overflow-hidden shadow-xl border border-black/10">
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#242424]">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                                    <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
                                </div>
                                <span className="text-white/60 text-xs font-mono font-medium">CSS Code</span>
                            </div>
                            <div className="p-6 relative">
                                <pre className="text-white/90 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto whitespace-pre-wrap word-break">
                                    <code>{cssCode}</code>
                                </pre>

                                <button onClick={copyToClipboard} className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white backdrop-blur-md px-4 py-2 rounded-xl transition-all flex items-center gap-2 text-sm font-medium border border-white/10">
                                    {copied ? <><Check size={16} className="text-green-400" /> Copied!</> : <><Copy size={16} /> Copy CSS</>}
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}