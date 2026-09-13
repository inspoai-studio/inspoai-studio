import { useState, useEffect, useRef } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, Check, Plus, Trash2, SlidersHorizontal, Download } from "lucide-react";
import * as htmlToImage from 'html-to-image';
export default function CssGradientGenerator() {
  const [type, setType] = useState("linear");
  const [angle, setAngle] = useState("90");
  const [stops, setStops] = useState([{
    id: "1",
    color: "#3B82F6",
    position: 0
  }, {
    id: "2",
    color: "#8B5CF6",
    position: 100
  }]);
  const [cssCode, setCssCode] = useState("");
  const [noiseOpacity, setNoiseOpacity] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef(null);

  // Drag state
  const [draggingId, setDraggingId] = useState(null);
  const sliderRef = useRef(null);
  useEffect(() => {
    generateCss();
  }, [type, angle, stops, noiseOpacity]);
  const generateCss = () => {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopsString = sortedStops.map(s => `${s.color} ${s.position}%`).join(", ");
    let background = "";
    if (type === "linear") {
      background = `linear-gradient(${angle}deg, ${stopsString})`;
    } else if (type === "radial") {
      background = `radial-gradient(circle, ${stopsString})`;
    } else if (type === "conic") {
      background = `conic-gradient(from ${angle}deg, ${stopsString})`;
    }
    let finalBackground = background;
    if (noiseOpacity > 0) {
      const noiseSvg = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='${noiseOpacity}'/%3E%3C/svg%3E")`;
      // Blend the noise using a multiple backgrounds stacking. 
      // The noise SVG needs to be on top of the gradient.
      finalBackground = `${noiseSvg}, ${background}`;
    }
    setCssCode(`background: ${finalBackground};`);
  };
  const handleAddStop = () => {
    if (stops.length >= 8) return; // limit stops
    const newPoz = Math.floor(Math.random() * 60) + 20;
    setStops([...stops, {
      id: Math.random().toString(36).substr(2, 9),
      color: "#FFFFFF",
      position: newPoz
    }]);
  };
  const handleRemoveStop = id => {
    if (stops.length <= 2) return; // need at least 2 stops
    setStops(stops.filter(s => s.id !== id));
  };
  const handleStopColorChange = (id, color) => {
    setStops(stops.map(s => s.id === id ? {
      ...s,
      color
    } : s));
  };
  const handleStopPositionChange = (id, position) => {
    setStops(stops.map(s => s.id === id ? {
      ...s,
      position: Math.max(0, Math.min(100, position))
    } : s));
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const downloadPng = async () => {
    if (!previewRef.current) return;
    try {
      setIsDownloading(true);
      const dataUrl = await htmlToImage.toPng(previewRef.current, {
        quality: 1,
        pixelRatio: 2
      });
      const link = document.createElement('a');
      link.download = `gradient-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Failed to download image', error);
    } finally {
      setIsDownloading(false);
    }
  };

  // Slider dragging logic
  const handleSliderPointerDown = (e, id) => {
    setDraggingId(id);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleSliderPointerMove = e => {
    if (!draggingId || !sliderRef.current) return;
    const rect = sliderRef.current.getBoundingClientRect();
    let newX = e.clientX - rect.left;
    let percentage = Math.round(newX / rect.width * 100);
    percentage = Math.max(0, Math.min(100, percentage));
    handleStopPositionChange(draggingId, percentage);
  };
  const handleSliderPointerUp = e => {
    if (draggingId) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setDraggingId(null);
    }
  };
  const presetGradients = [{
    name: "Oceanic",
    type: "linear",
    angle: "135",
    stops: [{
      id: "1",
      color: "#04B4E0",
      position: 0
    }, {
      id: "2",
      color: "#1F3A93",
      position: 100
    }]
  }, {
    name: "Sunset",
    type: "linear",
    angle: "90",
    stops: [{
      id: "1",
      color: "#FF512F",
      position: 0
    }, {
      id: "2",
      color: "#DD2476",
      position: 100
    }]
  }, {
    name: "Emerald",
    type: "linear",
    angle: "45",
    stops: [{
      id: "1",
      color: "#11998E",
      position: 0
    }, {
      id: "2",
      color: "#38EF7D",
      position: 100
    }]
  }, {
    name: "Midnight",
    type: "radial",
    angle: "0",
    stops: [{
      id: "1",
      color: "#2B5876",
      position: 0
    }, {
      id: "2",
      color: "#4E4376",
      position: 100
    }]
  }];
  const applyPreset = preset => {
    setType(preset.type);
    setAngle(preset.angle);
    setStops(preset.stops.map(s => ({
      ...s,
      id: Math.random().toString(36).substr(2, 9)
    })));
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "CSS Gradient Generator by Inspo AI",
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
        "name": "Can I add more than two colors to my gradient?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! You can add up to 5 individual color stops. Just click the '+' button next to the color stops list to add a new color, and drag the sliders to position them perfectly."
        }
      }, {
        "@type": "Question",
        "name": "What types of CSS gradients does this tool support?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "This generator supports Linear, Radial, and Conic gradients. You can easily switch between them using the toggle at the top of the controls sidebar."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="CSS Gradient Generator" relatedTools={[{
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }, {
    name: "Box Shadow Generator",
    href: "/free-tools/box-shadow-generator"
  }]}>
            <SEO title="Free CSS Gradient Generator | Linear & Radial | Inspo AI" description="Create beautiful CSS gradients visually. Adjust colors, angles, and types (linear, radial, conic). Export pure CSS instantly. 100% free online tool." keywords="css gradient generator, linear gradient, radial gradient, conic gradient, css background generator, web design colors" schemaMarkup={schemaMarkup} />

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        CSS Gradient <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Create stunning, multi-stop CSS gradients visually. Choose from linear, radial, or conic, and copy the code instantly.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Controls Sidebar */}
                    <div className="lg:col-span-5 space-y-6">
                        <div className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8">

                            {/* Gradient Type */}
                            <div className="mb-8">
                                <label className="text-sm font-semibold text-foreground tracking-wider mb-3 flex items-center gap-2">
                                    <SlidersHorizontal size={16} className="text-primary" /> Type
                                </label>
                                <div className="grid grid-cols-3 gap-2 p-1 bg-secondary rounded-xl">
                                    <button onClick={() => setType("linear")} className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${type === "linear" ? "bg-white dark:bg-black shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                        Linear
                                    </button>
                                    <button onClick={() => setType("radial")} className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${type === "radial" ? "bg-white dark:bg-black shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                        Radial
                                    </button>
                                    <button onClick={() => setType("conic")} className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${type === "conic" ? "bg-white dark:bg-black shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                                        Conic
                                    </button>
                                </div>
                            </div>

                            {/* Angle (Only for linear and conic) */}
                            {(type === "linear" || type === "conic") && <div className="mb-8">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="text-sm font-semibold text-foreground tracking-wider">Angle</label>
                                        <span className="text-sm text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded-md">{angle}°</span>
                                    </div>
                                    <input type="range" min="0" max="360" value={angle} onChange={e => setAngle(e.target.value)} className="w-full accent-primary h-2 bg-secondary rounded-full appearance-none cursor-pointer" />
                                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                                        <span>0°</span>
                                        <span>90°</span>
                                        <span>180°</span>
                                        <span>270°</span>
                                        <span>360°</span>
                                    </div>
                                </div>}

                            {/* Noise Opacity */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-semibold text-foreground tracking-wider">Noise Texture Opacity</label>
                                    <span className="text-sm text-muted-foreground font-mono bg-secondary px-2 py-0.5 rounded-md">{Math.round(noiseOpacity * 100)}%</span>
                                </div>
                                <input type="range" min="0" max="0.5" step="0.01" value={noiseOpacity} onChange={e => setNoiseOpacity(Number(e.target.value))} className="w-full accent-primary h-2 bg-secondary rounded-full appearance-none cursor-pointer" />
                            </div>

                            {/* Color Stops Visual Slider */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <label className="text-sm font-semibold text-foreground tracking-wider">Colors & Positions</label>
                                    <button onClick={handleAddStop} disabled={stops.length >= 8} className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                                        <Plus size={14} /> Add Color
                                    </button>
                                </div>

                                {/* Drag Slider Area */}
                                <div className="h-10 relative mb-6 rounded-xl overflow-hidden border border-border" style={{
                background: `linear-gradient(90deg, ${[...stops].sort((a, b) => a.position - b.position).map(s => `${s.color} ${s.position}%`).join(',')})`
              }} />

                                <div ref={sliderRef} className="relative h-6 bg-secondary rounded-full cursor-pointer touch-none" onPointerMove={handleSliderPointerMove} onPointerUp={handleSliderPointerUp} onPointerLeave={handleSliderPointerUp}>
                                    {stops.map(stop => <div key={stop.id} onPointerDown={e => handleSliderPointerDown(e, stop.id)} className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-[3px] shadow-md cursor-grab active:cursor-grabbing transition-transform ${draggingId === stop.id ? 'scale-125 z-10 border-primary' : 'border-background hover:scale-110'}`} style={{
                  left: `calc(${stop.position}% - 12px)`,
                  backgroundColor: stop.color
                }} />)}
                                </div>
                            </div>

                            {/* Color Stops Details */}
                            <div className="space-y-3">
                                {[...stops].sort((a, b) => a.position - b.position).map((stop, index) => <div key={stop.id} className="flex items-center gap-3 bg-secondary/50 p-2.5 rounded-xl border border-border/50">
                                        <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border shadow-sm shrink-0">
                                            <input type="color" value={stop.color} onChange={e => handleStopColorChange(stop.id, e.target.value)} className="absolute -inset-2 w-16 h-16 cursor-pointer" />
                                        </div>
                                        <input type="text" value={stop.color.toUpperCase()} onChange={e => handleStopColorChange(stop.id, e.target.value)} className="w-24 bg-transparent border-none text-sm font-mono text-foreground focus:outline-none uppercase" />

                                        <div className="flex-1 flex items-center gap-2">
                                            <input type="number" min="0" max="100" value={stop.position} onChange={e => handleStopPositionChange(stop.id, Number(e.target.value))} className="w-16 bg-background border border-border rounded-lg px-2 py-1.5 text-sm outline-none text-center" />
                                            <span className="text-xs text-muted-foreground">%</span>
                                        </div>

                                        <button onClick={() => handleRemoveStop(stop.id)} disabled={stops.length <= 2} className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>)}
                            </div>
                        </div>

                        {/* Presets */}
                        <div className="bg-card rounded-3xl border border-border p-6">
                            <h3 className="text-sm font-bold text-foreground mb-4">Quick Presets</h3>
                            <div className="grid grid-cols-4 gap-3">
                                {presetGradients.map((preset, i) => <button key={i} onClick={() => applyPreset(preset)} className="h-12 rounded-xl transition-transform hover:scale-105 shadow-sm border border-border/50" style={{
                background: `linear-gradient(${preset.angle}deg, ${preset.stops.map(s => `${s.color} ${s.position}%`).join(',')})`
              }} title={preset.name} />)}
                            </div>
                        </div>
                    </div>

                    {/* Output & Preview Area */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Live Preview Pane */}
                        <div className="w-full flex-1 min-h-[400px] rounded-3xl border border-border shadow-inspo relative overflow-hidden transition-all duration-300">
                            {/* Checkerboard background wrapper for transparency */}
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPC9zdmc+')] -z-10" />
                            <div ref={previewRef} className="absolute inset-0 transition-all duration-300" style={{
              background: cssCode.replace('background: ', '').replace(';', '')
            }} />
                        </div>

                        <div className="flex justify-end gap-3 mt-[-10px]">
                            <button onClick={downloadPng} disabled={isDownloading} className="bg-primary/10 text-primary hover:bg-primary/20 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2">
                                <Download size={18} /> {isDownloading ? "Downloading..." : "Download PNG"}
                            </button>
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
                                <pre className="text-white/90 font-mono text-sm sm:text-base leading-relaxed overflow-x-auto">
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