import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/CreatorStudio.css';
import { Wand2, Download, Image, PenTool, HelpCircle, ExternalLink, Palette, Layers, Eye, Brush, Moon, Droplet, ArrowLeftRight, FileArchive, FileText, Type, Sliders } from 'lucide-react';

// Import free tools components
import AutumnColorPalette from './free-tools/AutumnColorPalette';
import BoxShadowGen from './free-tools/BoxShadowGen';
import ColorPaletteGen from './free-tools/ColorPaletteGen';
import ContrastChecker from './free-tools/ContrastChecker';
import CssGradientGen from './free-tools/CssGradientGen';
import DeepWinterColorPalette from './free-tools/DeepWinterColorPalette';
import GlassmorphismGen from './free-tools/GlassmorphismGen';
import HexToRgb from './free-tools/HexToRgb';
import ImageCompressor from './free-tools/ImageCompressor';
import LoremIpsumGen from './free-tools/LoremIpsumGen';
import PxToRemConverter from './free-tools/PxToRemConverter';
import SoftAutumnColorPalette from './free-tools/SoftAutumnColorPalette';
import SoftSummerColorPalette from './free-tools/SoftSummerColorPalette';
import SummerColorPalette from './free-tools/SummerColorPalette';
import SvgToPng from './free-tools/SvgToPng';
import TintShadeGenerator from './free-tools/TintShadeGenerator';
import WinterColorPalette from './free-tools/WinterColorPalette';

// Figma logo as inline SVG component
const FigmaIcon = ({ size = 20 }) => (
    <svg width={size} height={size} viewBox="0 0 38 57" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 28.5C19 23.2533 23.2533 19 28.5 19C33.7467 19 38 23.2533 38 28.5C38 33.7467 33.7467 38 28.5 38C23.2533 38 19 33.7467 19 28.5Z" fill="#1ABCFE" />
        <path d="M0 47.5C0 42.2533 4.25329 38 9.5 38H19V47.5C19 52.7467 14.7467 57 9.5 57C4.25329 57 0 52.7467 0 47.5Z" fill="#0ACF83" />
        <path d="M19 0V19H28.5C33.7467 19 38 14.7467 38 9.5C38 4.25329 33.7467 0 28.5 0H19Z" fill="#FF7262" />
        <path d="M0 9.5C0 14.7467 4.25329 19 9.5 19H19V0H9.5C4.25329 0 0 4.25329 0 9.5Z" fill="#F24E1E" />
        <path d="M0 28.5C0 33.7467 4.25329 38 9.5 38H19V19H9.5C4.25329 19 0 23.2533 0 28.5Z" fill="#A259FF" />
    </svg>
);

// Chrome logo in brand colors as inline SVG component
const ChromeColorIcon = ({ size = 16 }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z" fill="#EA4335" />
        <path d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z" fill="#FCC934" />
        <path d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z" fill="#34A853" />
        <circle cx="24" cy="24" r="12" fill="#FFFFFF" />
        <circle cx="24" cy="24" r="9.5" fill="#1A73E8" />
    </svg>
);

const FREE_TOOLS_LIST = [
    { id: 'hex-to-rgb', title: 'HEX to RGB Converter', description: 'Translate color codes across web and print formats instantly.', icon: ArrowLeftRight, component: HexToRgb },
    { id: 'color-palette-generator', title: 'Color Palette Generator', description: 'Generate, lock, and re-order custom color palettes with real-time preview.', icon: Palette, component: ColorPaletteGen },
    { id: 'css-gradient-generator', title: 'CSS Gradient Generator', description: 'Design beautiful, smooth CSS gradients and copy CSS code.', icon: Brush, component: CssGradientGen },
    { id: 'contrast-checker', title: 'Contrast Checker', description: 'Check WCAG contrast ratios between foreground and background colors.', icon: Eye, component: ContrastChecker },
    { id: 'box-shadow-generator', title: 'Box Shadow Generator', description: 'Visually construct smooth CSS box shadows and grab the code.', icon: Layers, component: BoxShadowGen },
    { id: 'glassmorphism-generator', title: 'Glassmorphism Generator', description: 'Configure glossy, glass-like UI panels using custom backdrops and borders.', icon: Droplet, component: GlassmorphismGen },
    { id: 'image-compressor', title: 'Image Compressor', description: 'Compress PNG and JPEG files offline right inside your browser.', icon: FileArchive, component: ImageCompressor },
    { id: 'svg-to-png', title: 'SVG to PNG Converter', description: 'Upload vectors and export clean, high-resolution raster files.', icon: Image, component: SvgToPng },
    { id: 'px-to-rem', title: 'PX to REM Converter', description: 'Translate pixel measurements into scalable CSS rem units.', icon: Type, component: PxToRemConverter },
    { id: 'lorem-ipsum', title: 'Lorem Ipsum Generator', description: 'Generate dummy placeholder text for copy layouts.', icon: FileText, component: LoremIpsumGen },
    { id: 'tint-shade', title: 'Tint & Shade Generator', description: 'Create lighter tints and darker shades of any base color.', icon: Sliders, component: TintShadeGenerator },
    { id: 'autumn-palette', title: 'Autumn Color Palette', description: 'Explore seasonal warm, rich earth tones for True, Soft, Deep, and Dark Autumn.', icon: Palette, component: AutumnColorPalette },
    { id: 'summer-palette', title: 'Summer Color Palette', description: 'Explore cool, muted seasonal tones for True, Soft, Cool, and Light Summer.', icon: Palette, component: SummerColorPalette },
    { id: 'winter-palette', title: 'Winter Color Palette', description: 'Explore bold, crisp jewel tones and dark shades for True, Deep, Cool, and Bright Winter.', icon: Palette, component: WinterColorPalette },
    { id: 'deep-winter-palette', title: 'Deep Winter Color Palette', description: 'Explore dark, contrasting palettes bordering Autumn and Winter seasons.', icon: Moon, component: DeepWinterColorPalette },
    { id: 'soft-autumn-palette', title: 'Soft Autumn Color Palette', description: 'Explore soft, muted earth tones that blend Autumn and Summer seasons.', icon: Palette, component: SoftAutumnColorPalette },
    { id: 'soft-summer-palette', title: 'Soft Summer Color Palette', description: 'Explore hazy, dreamy pastel-leaning cool tones that blend Summer and Autumn seasons.', icon: Palette, component: SoftSummerColorPalette }
];

const CreatorStudio = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const selectedTool = searchParams.get('tool');

    const setSelectedTool = (toolId) => {
        if (toolId) {
            setSearchParams({ tool: toolId });
        } else {
            setSearchParams({});
        }
    };

    useEffect(() => {
        // Configure Tailwind corePlugins preflight to false BEFORE loading
        window.tailwind = {
            corePlugins: {
                preflight: false
            },
            theme: {
                extend: {
                    colors: {
                        border: "hsl(var(--border))",
                        input: "hsl(var(--input))",
                        ring: "hsl(var(--ring))",
                        background: "hsl(var(--background))",
                        foreground: "hsl(var(--foreground))",
                        primary: {
                            DEFAULT: "hsl(var(--primary))",
                            foreground: "hsl(var(--primary-foreground))"
                        },
                        secondary: {
                            DEFAULT: "hsl(var(--secondary))",
                            foreground: "hsl(var(--secondary-foreground))"
                        },
                        muted: {
                            DEFAULT: "hsl(var(--muted))",
                            foreground: "hsl(var(--muted-foreground))"
                        },
                        accent: {
                            DEFAULT: "hsl(var(--accent))",
                            foreground: "hsl(var(--accent-foreground))"
                        },
                        card: {
                            DEFAULT: "hsl(var(--card))",
                            foreground: "hsl(var(--card-foreground))"
                        },
                        inspo: {
                            green: "hsl(var(--inspo-green))",
                            blue: "hsl(var(--inspo-blue))",
                            body: "hsl(var(--inspo-body))"
                        }
                    },
                    borderRadius: {
                        lg: "var(--radius)",
                        md: "calc(var(--radius) - 2px)",
                        sm: "calc(var(--radius) - 4px)",
                        pill: "100px"
                    },
                    boxShadow: {
                        inspo: "var(--inspo-shadow)",
                        "inspo-lg": "var(--inspo-shadow-lg)"
                    }
                }
            }
        };

        const script = document.createElement('script');
        script.src = 'https://cdn.tailwindcss.com';
        script.id = 'tailwind-cdn';
        document.head.appendChild(script);

        return () => {
            const el = document.getElementById('tailwind-cdn');
            if (el) document.head.removeChild(el);
            delete window.tailwind;
        };
    }, []);



    if (selectedTool) {
        const tool = FREE_TOOLS_LIST.find(t => t.id === selectedTool);
        if (tool) {
            const ToolComponent = tool.component;
            return (
                <div className="creator-studio-container" style={{ overflowY: 'auto', display: 'block' }}>
                    <ToolComponent onBack={() => setSelectedTool(null)} />
                </div>
            );
        }
    }

    return (
        <div className="creator-studio-container">
            <div className="cs-coming-soon-wrapper">

                {/* ══════ Creator Tools Section ══════ */}
                <div className="cs-tools-section">
                    {/* ── Hero Card: Screenshot to Figma ── */}
                    <div className="cs-hero-card">
                        <div className="cs-hero-video">
                            <iframe
                                width="100%"
                                height="100%"
                                src="https://www.youtube.com/embed/b1iYS9SGrYs?si=lKunCYSafHJuH199"
                                title="Screenshot to Figma - InspoAI"
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            />
                        </div>
                        <div className="cs-hero-info">
                            <div className="cs-tool-card-top">
                                <div className="cs-tool-icon cs-tool-icon-active">
                                    <FigmaIcon size={20} />
                                </div>
                                <span className="cs-tool-badge cs-tool-badge-active">Brand New</span>
                            </div>
                            <h3>Screenshot to Figma</h3>
                            <p>Capture any website as editable Figma layers, not screenshots. Text, structure, colors, everything stays fully editable.</p>

                            <div className="cs-tool-actions">
                                <a 
                                    href="https://chromewebstore.google.com/detail/akbngcgjnbkmlilecdkjaapiecefcihj?utm_source=item-share-inspoai" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="cs-tool-download-btn"
                                    style={{ textDecoration: 'none' }}
                                >
                                    <ChromeColorIcon size={16} />
                                    <span>Download the Extension</span>
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* ── Active Free Tools Grid ── */}
                    <div className="cs-coming-grid">
                        {FREE_TOOLS_LIST.map((tool) => {
                            const Icon = tool.icon;
                            return (
                                <div 
                                    key={tool.id} 
                                    className="cs-coming-tile" 
                                    style={{ opacity: 1, cursor: 'pointer' }}
                                    onClick={() => setSelectedTool(tool.id)}
                                >
                                    <div className="cs-coming-tile-inner">
                                        <div className="cs-tool-card-top">
                                            <div className="cs-tool-icon cs-tool-icon-active" style={{ background: '#f4f4f4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Icon size={20} style={{ color: '#000000' }} />
                                            </div>
                                        </div>
                                        <h3>{tool.title}</h3>
                                        <p>{tool.description}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default CreatorStudio;
