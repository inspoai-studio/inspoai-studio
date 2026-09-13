import { useState, useRef } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { UploadCloud, Download, Image as ImageIcon, Sparkles } from "lucide-react";
export default function SvgToPngConverter() {
  const [svgFile, setSvgFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [pngUrl, setPngUrl] = useState(null);
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(800);
  const fileInputRef = useRef(null);
  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (file && file.type === "image/svg+xml") {
      setSvgFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Read SVG dimensions if possible
      const reader = new FileReader();
      reader.onload = event => {
        const text = event.target?.result;
        const matchWidth = text.match(/width="([^"]+)"/);
        const matchHeight = text.match(/height="([^"]+)"/);
        if (matchWidth && !isNaN(parseInt(matchWidth[1]))) setWidth(parseInt(matchWidth[1]));
        if (matchHeight && !isNaN(parseInt(matchHeight[1]))) setHeight(parseInt(matchHeight[1]));
      };
      reader.readAsText(file);
    } else {
      alert("Please select a valid SVG file.");
    }
  };
  const convertSvgToPng = () => {
    if (!previewUrl) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        const pngDataUrl = canvas.toDataURL("image/png");
        setPngUrl(pngDataUrl);
      }
    };
    img.src = previewUrl;
  };
  const handleDownload = () => {
    if (!pngUrl) return;
    const link = document.createElement("a");
    link.download = `${svgFile?.name.replace(".svg", "") || "converted"}.png`;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "SVG to PNG Converter by Inspo AI",
      "applicationCategory": "MultimediaApplication",
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
        "name": "Are my SVG files uploaded to a server?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No! Our SVG to PNG converter works entirely in your browser using client-side JavaScript. Your files are never uploaded, ensuring 100% privacy and security."
        }
      }, {
        "@type": "Question",
        "name": "Will I lose quality when converting from SVG to PNG?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Because SVG is a vector format, it can be scaled infinitely without losing quality. You can set the exact width and height you want for the output PNG before converting, ensuring a perfectly sharp result every time."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="SVG to PNG Converter" relatedTools={[{
    name: "Image Compressor",
    href: "/free-tools/image-compressor"
  }, {
    name: "Color Palette Generator",
    href: "/free-tools/color-palette-generator"
  }]}>
            <SEO title="Free SVG to PNG Converter | High Quality, No Upload | Inspo AI" description="Convert SVG vector files to PNG images instantly in your browser. 100% free, private, and fast. Customize dimensions with no quality loss." keywords="svg to png converter, convert svg to png offline, high res svg to png, private svg converter" schemaMarkup={schemaMarkup} />

            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        SVG to PNG <span className="inspo-gradient-text">Converter</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Convert vector files to transparent PNGs directly in your browser. Zero uploads, zero server
                        waiting times. Your files stay on your device.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">

                        {/* Left: Input */}
                        <div className="p-8 lg:p-12">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                <UploadCloud className="text-primary" /> Step 1: upload <span>SVG</span>
                            </h2>

                            <input type="file" accept=".svg" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer text-center group bg-secondary/30">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ImageIcon size={32} className="text-primary" />
                                </div>
                                <p className="font-medium text-foreground mb-1">Click to upload or drag and drop</p>
                                <p className="text-sm text-muted-foreground">SVG files only</p>
                            </div>

                            {svgFile && <div className="mt-8 space-y-4">
                                    <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Output Dimensions</h3>
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground block mb-1">Width (px)</label>
                                            <input type="number" value={width} onChange={e => setWidth(Number(e.target.value))} className="w-full bg-secondary text-foreground p-3 rounded-xl border border-border outline-none focus:border-primary/50" />
                                        </div>
                                        <div className="flex-1">
                                            <label className="text-xs text-muted-foreground block mb-1">Height (px)</label>
                                            <input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} className="w-full bg-secondary text-foreground p-3 rounded-xl border border-border outline-none focus:border-primary/50" />
                                        </div>
                                    </div>
                                    <button onClick={convertSvgToPng} className="w-full text-foreground bg-primary hover:brightness-110 px-6 py-4 rounded-xl font-medium transition-all shadow-md flex items-center justify-center gap-2 mt-4">
                                        <Sparkles size={18} /> Convert to PNG
                                    </button>
                                </div>}
                        </div>

                        {/* Right: Output */}
                        <div className="p-8 lg:p-12 bg-secondary/10 flex flex-col">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                <ImageIcon className="text-inspo-blue" /> Step 2: preview & <span>download</span>
                            </h2>

                            <div className="flex-1 border border-border rounded-xl bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPC9zdmc+')] flex items-center justify-center overflow-hidden relative min-h-[300px]">
                                {pngUrl ? <img src={pngUrl} alt="Converted PNG" className="max-w-[80%] max-h-[80%] object-contain drop-shadow-md" /> : previewUrl ? <img src={previewUrl} alt="SVG Preview" className="max-w-[80%] max-h-[80%] object-contain" /> : <span className="text-muted-foreground text-sm">Preview will appear here</span>}
                            </div>

                            {pngUrl && <button onClick={handleDownload} className="w-full mt-6 bg-foreground text-background px-6 py-4 rounded-xl font-medium transition-all hover:-translate-y-1 shadow-lg flex items-center justify-center gap-2">
                                    <Download size={18} /> Download PNG
                                </button>}
                        </div>
                    </div>
                </div>

                <div className="mt-20 pt-16 border-t border-border/40 grid md:grid-cols-3 gap-8">
                    <div>
                        <h3 className="font-bold text-foreground text-lg mb-2">100% Private</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">Everything happens entirely within your web browser. Your designs are never uploaded to our servers.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-lg mb-2">Custom Dimensions</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">Since SVGs are vector files, they can be scaled infinitely. Define your exact output resolution before converting.</p>
                    </div>
                    <div>
                        <h3 className="font-bold text-foreground text-lg mb-2">Preserves Transparency</h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">The alpha channel from your SVG is perfectly preserved in the final PNG output.</p>
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}