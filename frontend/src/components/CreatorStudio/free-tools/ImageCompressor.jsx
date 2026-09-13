import { useState, useRef, useEffect } from "react";
import FreeToolLayout from "./FreeToolLayout";
import SEO from "./SEO";
import BlurReveal from "./BlurReveal";
import { UploadCloud, Download, Image as ImageIcon, Settings, FileArchive } from "lucide-react";
import UPNG from "upng-js";
export default function ImageCompressor() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [compressedUrl, setCompressedUrl] = useState(null);
  const [quality, setQuality] = useState(80);
  const [isCompressing, setIsCompressing] = useState(false);

  // Stats
  const [originalSize, setOriginalSize] = useState(0);
  const [compressedSize, setCompressedSize] = useState(0);
  const [fileExt, setFileExt] = useState("jpg");
  const fileInputRef = useRef(null);
  const prevBlobUrlRef = useRef(null);
  useEffect(() => {
    return () => {
      if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
    };
  }, []);
  const formatBytes = bytes => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  const handleFileChange = e => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('image/')) {
      setFile(selectedFile);
      setOriginalSize(selectedFile.size);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);

      // Auto compress when first loaded
      compressImage(selectedFile, url, quality);
    } else {
      alert("Please select a valid image file (JPEG, PNG, WEBP).");
    }
  };
  const handleQualityChange = e => {
    const newQuality = Number(e.target.value);
    setQuality(newQuality);
    if (file && previewUrl && !isCompressing) {
      compressImage(file, previewUrl, newQuality);
    }
  };
  const compressImage = async (sourceFile, sourceUrl, targetQuality) => {
    setIsCompressing(true);
    const isPng = sourceFile.type === 'image/png';
    if (isPng) {
      // Use UPNG.js for true PNG compression (color quantization)
      try {
        // Determine colors based on quality slider (0-100 mapped to 2-256 colors)
        // 100 quality = 256 colors (max 8-bit palette), 0 quality = 2 colors (extreme).
        const colors = Math.max(2, Math.floor(targetQuality / 100 * 256));
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setIsCompressing(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          // Encode with UPNG
          const compressedBuffer = UPNG.encode([imageData.data.buffer], canvas.width, canvas.height, colors);
          const blob = new Blob([compressedBuffer], {
            type: "image/png"
          });
          if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
          const url = URL.createObjectURL(blob);
          prevBlobUrlRef.current = url;
          setFileExt("png");
          setCompressedUrl(url);
          setCompressedSize(blob.size);
          setIsCompressing(false);
        };
        img.src = sourceUrl;
      } catch (err) {
        console.error("PNG Compression failed:", err);
        setIsCompressing(false);
      }
    } else {
      // Use standard canvas toBlob for JPEG and WebP
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        if (ctx) {
          const outputMimeType = sourceFile.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
          if (outputMimeType === 'image/jpeg') {
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const qualityFactor = targetQuality / 100;
          canvas.toBlob(blob => {
            if (blob) {
              if (prevBlobUrlRef.current) URL.revokeObjectURL(prevBlobUrlRef.current);
              const url = URL.createObjectURL(blob);
              prevBlobUrlRef.current = url;
              let actualExt = "jpg";
              if (blob.type === "image/webp") actualExt = "webp";else if (blob.type === "image/png") actualExt = "png";else if (blob.type === "image/jpeg") actualExt = "jpg";
              setFileExt(actualExt);
              setCompressedUrl(url);
              setCompressedSize(blob.size);
            }
            setIsCompressing(false);
          }, outputMimeType, qualityFactor);
        } else {
          setIsCompressing(false);
        }
      };
      img.src = sourceUrl;
    }
  };
  const handleDownload = () => {
    if (!compressedUrl || !file) return;
    const link = document.createElement("a");
    const extIndex = file.name.lastIndexOf('.');
    const basename = extIndex !== -1 ? file.name.substring(0, extIndex) : file.name;
    link.download = `${basename}_compressed.${fileExt}`;
    link.href = compressedUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const savingsPercentage = originalSize > 0 && compressedSize > 0 ? Math.max(0, Math.round((originalSize - compressedSize) / originalSize * 100)) : 0;
  const schemaMarkup = {
    "@context": "https://schema.org",
    "@graph": [{
      "@type": "SoftwareApplication",
      "name": "Image Compressor by Inspo AI",
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
        "name": "Are my images uploaded to a server?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "No. All image compression happens locally in your web browser. Your photos are completely private and never leave your device."
        }
      }, {
        "@type": "Question",
        "name": "What image formats are supported?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Our compressor supports standard web formats including JPEG, PNG, and WebP."
        }
      }, {
        "@type": "Question",
        "name": "Is this tool completely free?",
        "acceptedAnswer": {
          "@type": "Answer",
          "text": "Yes! Because the compression runs on your own device rather than our servers, we can offer this tool completely free with no limits or paywalls."
        }
      }]
    }]
  };
  return <FreeToolLayout toolName="Image Compressor" relatedTools={[{
    name: "SVG to PNG Converter",
    href: "/free-tools/svg-to-png-converter"
  }, {
    name: "CSS Box Shadow Generator",
    href: "/free-tools/box-shadow-generator"
  }]}>
            <SEO title="Free Online Image Compressor | Private & Fast | Inspo AI" description="Compress PNG and JPEG files instantly in your browser. Reduce file size without losing quality. 100% free and private tool." keywords="image compressor, compress image online, reduce image size, compress png, compress jpeg, private image compression" schemaMarkup={schemaMarkup} />

            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-12">
                    <BlurReveal as="h1" className="font-display text-[42px] md:text-[56px] leading-[1.1] text-foreground mb-6 tracking-tight">
                        Instant Image <span className="inspo-gradient-text">Compressor</span>
                    </BlurReveal>
                    <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                        Shrink your image file sizes directly in the browser. Completely private, no uploads to our servers.
                    </p>
                </div>

                <div className="bg-card rounded-3xl border border-border shadow-inspo overflow-hidden">
                    <div className="grid md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-border">

                        {/* Editor Side */}
                        <div className="p-8 lg:p-12 flex flex-col">
                            <h2 className="text-xl font-bold text-foreground mb-6 flex items-center gap-2">
                                <UploadCloud className="text-primary" /> Upload <span>image</span>
                            </h2>

                            <input type="file" accept="image/jpeg, image/png, image/webp" className="hidden" ref={fileInputRef} onChange={handleFileChange} />

                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-border hover:border-primary/50 transition-colors rounded-2xl py-12 px-6 flex flex-col items-center justify-center cursor-pointer text-center group bg-secondary/30 flex-1 min-h-[250px]">
                                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <FileArchive size={32} className="text-primary" />
                                </div>
                                <p className="font-medium text-foreground mb-1">Click to upload or drag & drop</p>
                                <p className="text-sm text-muted-foreground">Supports JPEG, PNG, WEBP</p>
                            </div>

                            {file && <div className="mt-8 bg-secondary/50 rounded-2xl p-6 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                                            <Settings size={16} className="text-muted-foreground" /> Compression Level
                                        </h3>
                                        <span className="text-sm font-mono font-medium">{quality}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" value={quality} onChange={handleQualityChange} className="w-full accent-primary h-2 bg-secondary rounded-full appearance-none cursor-pointer my-4" />
                                    <div className="flex justify-between text-xs text-muted-foreground font-medium">
                                        <span>Smaller File</span>
                                        <span>Better Quality</span>
                                    </div>
                                </div>}
                        </div>

                        {/* Preview / Download Side */}
                        <div className="p-8 lg:p-12 bg-secondary/10 flex flex-col items-center justify-center">
                            {!previewUrl ? <div className="text-center opacity-50">
                                    <ImageIcon size={64} className="mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-foreground font-medium">Preview will appear here</p>
                                </div> : <div className="w-full flex-1 flex flex-col">
                                    <div className="flex-1 border-2 border-border/50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgZmlsbD0iI2ZmZiI+PC9yZWN0Pgo8cmVjdCB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmMGYwZjAiPjwvcmVjdD4KPC9zdmc+')] rounded-xl overflow-hidden flex flex-col relative group">

                                        {/* Image Comparison Container */}
                                        <div className="flex-1 w-full relative overflow-hidden flex items-center justify-center p-4">
                                            {isCompressing && <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-20 flex items-center justify-center">
                                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                                </div>}
                                            <img src={compressedUrl || previewUrl} alt="Preview" className="max-w-full max-h-[300px] object-contain drop-shadow-md z-10" />
                                        </div>
                                    </div>

                                    {/* Stats Board */}
                                    <div className="mt-8 bg-card border border-border rounded-2xl p-5 grid grid-cols-3 gap-4 shadow-sm relative overflow-hidden">

                                        {savingsPercentage > 0 && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-blue-400"></div>}

                                        <div className="text-center">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wider">Original</p>
                                            <p className="font-mono text-foreground font-medium">{formatBytes(originalSize)}</p>
                                        </div>
                                        <div className="text-center border-x border-border">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wider">Compressed</p>
                                            <p className={`font-mono font-bold ${savingsPercentage > 0 ? 'text-green-500' : 'text-foreground'}`}>
                                                {formatBytes(compressedSize)}
                                            </p>
                                        </div>
                                        <div className="text-center flex flex-col items-center justify-center">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold mb-1 tracking-wider">Saved</p>
                                            <div className="inline-flex items-center justify-center bg-green-500/10 text-green-600 dark:text-green-400 font-bold px-2 py-0.5 rounded-md">
                                                -{savingsPercentage}%
                                            </div>
                                        </div>
                                    </div>

                                    <button onClick={handleDownload} disabled={!compressedUrl} className="w-full mt-6 bg-foreground text-background px-6 py-4 rounded-xl font-medium transition-all hover:-translate-y-1 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                                        <Download size={18} /> Download Compressed Image
                                    </button>
                                </div>}
                        </div>
                    </div>
                </div>
            </div>
        </FreeToolLayout>;
}