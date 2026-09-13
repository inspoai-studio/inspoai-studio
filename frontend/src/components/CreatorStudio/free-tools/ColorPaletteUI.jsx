import React, { useState, useRef } from "react";
import { Download, RefreshCw, Copy, Check, ChevronDown } from "lucide-react";
import { toPng } from "html-to-image";

// Vertical color strip
const ColorStrip = ({ color, isDark = false }) => {
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(color);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
    };

    return (
        <div className="flex flex-col flex-1 min-w-0 group cursor-pointer" onClick={copy}>
            {/* The tall strip */}
            <div
                className="rounded-xl flex-1 relative transition-transform duration-200 group-hover:-translate-y-1 group-hover:shadow-lg"
                style={{ background: color, minHeight: "240px" }}
            >
                {copied && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="bg-black/70 text-white text-xs px-2 py-1 rounded-full font-medium">
                            Copied!
                        </span>
                    </div>
                )}
            </div>

            {/* Label */}
            <div className={`mt-2 text-center ${isDark ? "text-white/70" : "text-muted-foreground"}`}>
                <div className={`text-[10px] font-bold font-mono tracking-wider uppercase ${isDark ? "text-white/90" : "text-foreground"}`}>
                    {color.toUpperCase()}
                </div>
                <div className="text-[9px] mt-0.5 flex items-center justify-center gap-1">
                    {copied ? (
                        <Check size={10} className="text-emerald-500" />
                    ) : (
                        <Copy size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                </div>
            </div>
        </div>
    );
};

// Accordion FAQ (shared)
export const FaqAccordion = ({ items }) => {
    const [openIndex, setOpenIndex] = useState(null);

    return (
        <div className="bg-card rounded-3xl border border-border p-8 mt-16">
            <h2 className="text-2xl font-display font-semibold text-foreground mb-6">
                Frequently asked <span>questions</span>
            </h2>
            <div className="divide-y divide-border">
                {items.map((item, i) => {
                    const isOpen = openIndex === i;
                    return (
                        <div key={i} className="py-4">
                            <button
                                className="w-full flex items-center justify-between gap-4 text-left group"
                                onClick={() => setOpenIndex(isOpen ? null : i)}
                            >
                                <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                    {item.q}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                                />
                            </button>
                            {isOpen && (
                                <p className="mt-3 text-muted-foreground leading-relaxed text-sm animate-in slide-in-from-top-1 duration-200">
                                    {item.a}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// Main PaletteGenerator
export const PaletteGenerator = ({
    initialColors,
    onGenerateNew,
    isDarkHero = false,
    rightPanelContent,
}) => {
    const [colors, setColors] = useState(initialColors);
    const [copyAllCopied, setCopyAllCopied] = useState(false);
    const paletteRef = useRef(null);

    const handleGenerate = () => setColors(onGenerateNew());

    const handleCopyAll = () => {
        navigator.clipboard.writeText(colors.join(", "));
        setCopyAllCopied(true);
        setTimeout(() => setCopyAllCopied(false), 2000);
    };

    const handleDownload = async () => {
        if (!paletteRef.current) return;
        try {
            const dataUrl = await toPng(paletteRef.current, {
                cacheBust: true,
                style: { padding: "40px", background: isDarkHero ? "#1A1A2E" : "#ffffff" },
            });
            const link = document.createElement("a");
            link.download = "color-palette-inspo.png";
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Download failed", err);
        }
    };

    const btnBase = isDarkHero
        ? "bg-white/10 border-white/20 text-white hover:bg-white/20 border"
        : "bg-card border-border text-foreground hover:bg-accent border";

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full">
            {/* LEFT — vertical color strips */}
            <div className="flex-1 min-w-0" ref={paletteRef}>
                <div className="flex gap-2 h-[300px] sm:h-[340px]">
                    {colors.map((color, idx) => (
                        <ColorStrip key={`${color}-${idx}`} color={color} isDark={isDarkHero} />
                    ))}
                </div>
            </div>

            {/* RIGHT — controls + panel */}
            <div className="flex flex-col gap-5 lg:w-[260px] shrink-0">
                {/* Buttons */}
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleGenerate}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-3 rounded-full font-medium transition-all shadow-md flex items-center justify-center gap-2 text-sm"
                    >
                        <RefreshCw size={16} />
                        Generate New Palette
                    </button>

                    <div className="flex gap-2">
                        <button
                            onClick={handleDownload}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full font-medium transition-all text-sm ${btnBase}`}
                        >
                            <Download size={15} />
                            PNG
                        </button>
                        <button
                            onClick={handleCopyAll}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full font-medium transition-all text-sm ${btnBase}`}
                        >
                            {copyAllCopied
                                ? <Check size={15} className="text-emerald-500" />
                                : <Copy size={15} />}
                            {copyAllCopied ? "Copied!" : "Copy Hex"}
                        </button>
                    </div>
                </div>

                {/* Divider */}
                <div className={`border-t ${isDarkHero ? "border-white/10" : "border-border"}`} />

                {/* Right panel content (accent, font, preview) */}
                {rightPanelContent}
            </div>
        </div>
    );
};
