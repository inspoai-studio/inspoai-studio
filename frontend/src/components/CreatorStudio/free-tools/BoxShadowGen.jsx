import { useState, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { Copy, Check, Plus, Trash2, Layers } from "lucide-react";
export default function BoxShadowGenerator() {
  const [layers, setLayers] = useState([{
    id: "1",
    offsetX: 0,
    offsetY: 10,
    blur: 30,
    spread: -10,
    color: "#000000",
    opacity: 0.1,
    inset: false
  }, {
    id: "2",
    offsetX: 0,
    offsetY: 4,
    blur: 6,
    spread: -2,
    color: "#000000",
    opacity: 0.05,
    inset: false
  }]);
  const [activeLayer, setActiveLayer] = useState("1");
  const [boxColor, setBoxColor] = useState("#FFFFFF");
  const [backgroundColor, setBackgroundColor] = useState("#F8FAFC");
  const [cssCode, setCssCode] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    generateCss();
  }, [layers]);

  // Ensure active layer is always valid
  useEffect(() => {
    if (!layers.find(l => l.id === activeLayer) && layers.length > 0) {
      setActiveLayer(layers[0].id);
    }
  }, [layers, activeLayer]);
  const hexToRgba = (hex, opacity) => {
    let clean = hex.replace("#", "");
    if (clean.length === 3) clean = clean.split('').map(char => char + char).join('');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 2), 16);
    const b = parseInt(clean.substring(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };
  const generateCss = () => {
    const shadowString = layers.map(layer => {
      const insetStr = layer.inset ? "inset " : "";
      const colorStr = hexToRgba(layer.color, layer.opacity);
      return `${insetStr}${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${colorStr}`;
    }).join(", ");
    setCssCode(`box-shadow: ${shadowString};`);
  };
  const handleAddLayer = () => {
    if (layers.length >= 6) return; // limit to 6 layers to keep UI sane
    const newId = Math.random().toString(36).substr(2, 9);
    setLayers([...layers, {
      id: newId,
      offsetX: 0,
      offsetY: 5,
      blur: 15,
      spread: 0,
      color: "#000000",
      opacity: 0.1,
      inset: false
    }]);
    setActiveLayer(newId);
  };
  const handleRemoveLayer = (id, e) => {
    e.stopPropagation();
    if (layers.length <= 1) return;
    setLayers(layers.filter(l => l.id !== id));
  };
  const updateLayer = (id, key, value) => {
    setLayers(layers.map(l => l.id === id ? {
      ...l,
      [key]: value
    } : l));
    // Reset inset toggle logic (if setting to inset, reset values slightly to look better)
    if (key === 'inset') {
      setLayers(layers.map(l => l.id === id ? {
        ...l,
        inset: value,
        offsetX: value ? 0 : l.offsetX,
        offsetY: value ? 0 : l.offsetY
      } : l));
    }
  };
  const copyToClipboard = () => {
    navigator.clipboard.writeText(cssCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const currentLayer = layers.find(l => l.id === activeLayer) || layers[0];
  const presets = [{
    name: "Soft Glow",
    layers: [{
      id: "p1",
      offsetX: 0,
      offsetY: 0,
      blur: 40,
      spread: 10,
      color: "#3B82F6",
      opacity: 0.15,
      inset: false
    }]
  }, {
    name: "Neumorphic",
    bg: "#E0E5EC",
    box: "#E0E5EC",
    layers: [{
      id: "p1",
      offsetX: 9,
      offsetY: 9,
      blur: 16,
      spread: 0,
      color: "#A3B1C6",
      opacity: 0.6,
      inset: false
    }, {
      id: "p2",
      offsetX: -9,
      offsetY: -9,
      blur: 16,
      spread: 0,
      color: "#FFFFFF",
      opacity: 0.5,
      inset: false
    }]
  }, {
    name: "Hard Drop",
    layers: [{
      id: "p1",
      offsetX: 8,
      offsetY: 8,
      blur: 0,
      spread: 0,
      color: "#000000",
      opacity: 1,
      inset: false
    }]
  }, {
    name: "Inner Depth",
    layers: [{
      id: "p1",
      offsetX: 0,
      offsetY: 4,
      blur: 12,
      spread: 0,
      color: "#000000",
      opacity: 0.15,
      inset: true
    }]
  }];
  const applyPreset = preset => {
    setLayers(preset.layers.map(l => ({
      ...l,
      id: Math.random().toString(36).substr(2, 9)
    })));
    if (preset.bg) setBackgroundColor(preset.bg);
    if (preset.box) setBoxColor(preset.box);
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "CSS Box Shadow Generator by Inspo AI",
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
        "name": "How do I add multiple box shadows?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Click the 'Add Layer' button to create a new shadow layer. You can stack up to 6 distinct shadows on a single element to create complex, realistic depth effects."
        }
      }, {
        "@type": "Question",
        "name": "What is an inset shadow?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "An inset shadow is drawn inside the element instead of outside. This creates the illusion that the element is pushed into the page rather than raised above it. You can toggle this using the 'Inset' button in the layer properties."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Box Shadow Generator" relatedTools={[{
    name: "CSS Gradient Generator",
    href: "/free-tools/css-gradient-generator"
  }, {
    name: "Glassmorphism Generator",
    href: "/free-tools/glassmorphism-generator"
  }]}>
            <SEO title="Free CSS Box Shadow Generator | Multi-Layer Shadows | Inspo AI" description="Visually design beautiful, multi-layered CSS box shadows. Adjust blur, spread, X/Y offsets, and opacity. Export CSS code instantly for free." keywords="css box shadow generator, box shadow css, drop shadow css, neumorphism shadow, visually build css shadows" schemaMarkup={schemaMarkup} />

            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Box Shadow <span className="inspo-gradient-text">Generator</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Craft perfect, multi-layered shadows. Fine-tune offsets, blur, spread, and opacity, then grab the pure CSS code.
                    </p>
                </div>

                <div className="grid lg:grid-cols-12 gap-8">

                    {/* Controls Sidebar */}
                    <div className="lg:col-span-5 flex flex-col gap-6">

                        {/* Layer Management */}
                        <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden">
                            <div className="p-4 border-b border-border bg-secondary/50 flex items-center justify-between">
                                <h3 className="font-semibold text-sm flex items-center gap-2">
                                    <Layers size={16} className="text-primary" /> Shadow Layers
                                </h3>
                                <button onClick={handleAddLayer} disabled={layers.length >= 6} className="text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-full font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1">
                                    <Plus size={14} /> Add Layer
                                </button>
                            </div>
                            <div className="p-3 bg-secondary/20 flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                {layers.map((layer, index) => <div key={layer.id} onClick={() => setActiveLayer(layer.id)} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${activeLayer === layer.id ? 'bg-background border-primary shadow-sm' : 'bg-transparent border-transparent hover:bg-black/5 dark:hover:bg-white/5'}`}>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-md border border-border shadow-sm flex items-center justify-center bg-white">
                                                <div className="w-full h-full rounded-md" style={{
                      boxShadow: `${layer.inset ? 'inset ' : ''}${layer.offsetX}px ${layer.offsetY}px ${layer.blur}px ${layer.spread}px ${hexToRgba(layer.color, layer.opacity)}`
                    }} />
                                            </div>
                                            <span className="text-sm font-medium">Layer {index + 1} {layer.inset && <span className="text-xs text-muted-foreground ml-1">(Inset)</span>}</span>
                                        </div>
                                        <button onClick={e => handleRemoveLayer(layer.id, e)} disabled={layers.length <= 1} className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>)}
                            </div>
                        </div>

                        {/* Active Layer Controls */}
                        {currentLayer && <div className="bg-card rounded-3xl border border-border shadow-inspo p-6 sm:p-8 flex-1">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="font-bold text-foreground">Edit Selected Layer</h3>
                                    <div className="flex items-center gap-2 bg-secondary p-1 rounded-lg">
                                        <button onClick={() => updateLayer(currentLayer.id, "inset", false)} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${!currentLayer.inset ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                            Outset
                                        </button>
                                        <button onClick={() => updateLayer(currentLayer.id, "inset", true)} className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${currentLayer.inset ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                                            Inset
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    {/* Sliders */}
                                    {[{
                label: "Horizontal Offset (X)",
                key: "offsetX",
                min: -100,
                max: 100
              }, {
                label: "Vertical Offset (Y)",
                key: "offsetY",
                min: -100,
                max: 100
              }, {
                label: "Blur Radius",
                key: "blur",
                min: 0,
                max: 200
              }, {
                label: "Spread Radius",
                key: "spread",
                min: -100,
                max: 100
              }].map(control => <div key={control.key}>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-xs font-semibold text-foreground uppercase tracking-wider">{control.label}</label>
                                                <div className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md">
                                                    <input type="number" value={currentLayer[control.key]} onChange={e => updateLayer(currentLayer.id, control.key, Number(e.target.value))} className="w-10 bg-transparent text-xs text-right outline-none font-mono" />
                                                    <span className="text-xs text-muted-foreground mr-1">px</span>
                                                </div>
                                            </div>
                                            <input type="range" min={control.min} max={control.max} value={currentLayer[control.key]} onChange={e => updateLayer(currentLayer.id, control.key, Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer" />
                                        </div>)}

                                    <div className="pt-4 border-t border-border">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Opacity</label>
                                            <span className="text-xs font-mono bg-secondary px-2 py-1 rounded-md">{Math.round(currentLayer.opacity * 100)}%</span>
                                        </div>
                                        <input type="range" min="0" max="1" step="0.01" value={currentLayer.opacity} onChange={e => updateLayer(currentLayer.id, "opacity", Number(e.target.value))} className="w-full accent-primary h-1.5 bg-secondary rounded-full appearance-none cursor-pointer mb-6" />

                                        <div className="flex items-center justify-between">
                                            <label className="text-xs font-semibold text-foreground uppercase tracking-wider">Shadow Color</label>
                                            <div className="flex items-center gap-3">
                                                <div className="relative w-8 h-8 rounded-lg overflow-hidden border border-border shadow-sm shrink-0">
                                                    <input type="color" value={currentLayer.color} onChange={e => updateLayer(currentLayer.id, "color", e.target.value)} className="absolute -inset-2 w-16 h-16 cursor-pointer" />
                                                </div>
                                                <input type="text" value={currentLayer.color.toUpperCase()} onChange={e => updateLayer(currentLayer.id, "color", e.target.value)} className="w-20 bg-secondary rounded-md px-2 py-1 text-sm font-mono text-foreground outline-none uppercase" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>}
                    </div>

                    {/* Output & Preview Area */}
                    <div className="lg:col-span-7 flex flex-col gap-6">

                        {/* Live Preview Pane */}
                        <div className="w-full flex-1 min-h-[400px] rounded-3xl border border-border flex items-center justify-center p-8 relative overflow-hidden" style={{
            backgroundColor: backgroundColor
          }}>
                            {/* Bg/Box Color Tools (floating in preview) */}
                            <div className="absolute top-4 left-4 flex gap-2">
                                <div className="bg-background/80 backdrop-blur-md p-1.5 rounded-lg border border-border flex items-center gap-2 shadow-sm">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase pl-1">BG</span>
                                    <input type="color" value={backgroundColor} onChange={e => setBackgroundColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none bg-transparent" />
                                </div>
                                <div className="bg-background/80 backdrop-blur-md p-1.5 rounded-lg border border-border flex items-center gap-2 shadow-sm">
                                    <span className="text-[10px] font-semibold text-muted-foreground uppercase pl-1">BOX</span>
                                    <input type="color" value={boxColor} onChange={e => setBoxColor(e.target.value)} className="w-5 h-5 rounded cursor-pointer border-none bg-transparent" />
                                </div>
                            </div>

                            {/* The Box */}
                            <div className="w-48 h-48 md:w-64 md:h-64 rounded-2xl" style={{
              backgroundColor: boxColor,
              boxShadow: cssCode.replace('box-shadow: ', '').replace(';', '')
            }} />
                        </div>

                        {/* Presets */}
                        <div className="bg-card rounded-3xl border border-border p-6 shadow-inspo">
                            <h3 className="text-sm font-bold text-foreground mb-4">Quick Presets</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {presets.map((preset, i) => <button key={i} onClick={() => applyPreset(preset)} className="py-3 px-4 rounded-xl text-sm font-medium transition-all hover:-translate-y-1 shadow-sm border border-border bg-secondary hover:bg-secondary/80 text-foreground">
                                        {preset.name}
                                    </button>)}
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