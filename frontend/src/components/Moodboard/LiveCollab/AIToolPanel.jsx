import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Wand2 } from 'lucide-react';
import { toast } from 'sonner';

const AIToolPanel = ({ isOpen, onClose, onAddItem, getViewportCenter }) => {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error("Please describe what you want to create");
            return;
        }

        setIsGenerating(true);

        setTimeout(() => {
            setIsGenerating(false);
            const center = getViewportCenter ? getViewportCenter() : { x: 0, y: 0 };

            const apiKey = import.meta.env.VITE_POLLINATIONS_API_KEY;
            const seed = Math.floor(Math.random() * 1000000);

            const cleanPrompt = prompt.trim().replace(/[\r\n]+/g, ' ');
            const safePrompt = encodeURIComponent(cleanPrompt);

            const imageUrl = `https://gen.pollinations.ai/image/${safePrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux&key=${apiKey}`;


            const newItem = {
                id: crypto.randomUUID(),
                type: 'image',
                image: imageUrl,
                x: center.x,
                y: center.y,
                width: 300,
                height: 300,
                rotation: 0
            };
            onAddItem(newItem);
            toast.success("Image generated successfully!");

            setPrompt('');
            onClose();
        }, 1500);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: 400, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 400, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{
                        position: 'fixed',
                        top: 24,
                        right: 24,
                        width: 300,
                        backgroundColor: '#ffffff',
                        borderRadius: 16,
                        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
                        zIndex: 10000,
                        border: '1px solid rgba(0,0,0,0.06)',
                        padding: '24px',
                        fontFamily: 'var(--font-sans)'
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{
                                background: 'rgba(6, 207, 156, 0.1)',
                                padding: '6px',
                                borderRadius: '8px',
                                color: '#06cf9c',
                                display: 'flex'
                            }}>
                                <Sparkles size={16} />
                            </div>
                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 500, color: '#111' }}>Generate Image</h3>
                        </div>
                        <button
                            onClick={onClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: '50%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#999',
                                transition: 'color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.color = '#333'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#999'}
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Prompt Input */}
                    <div style={{ marginBottom: 20 }}>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Describe what you want to see..."
                            style={{
                                width: '100%',
                                height: 90,
                                padding: '14px',
                                borderRadius: 12,
                                border: '1px solid #eaeaea',
                                backgroundColor: '#fafafa',
                                resize: 'none',
                                fontSize: '14px',
                                fontFamily: 'inherit',
                                outline: 'none',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box',
                                color: '#333'
                            }}
                            onFocus={(e) => {
                                e.target.style.borderColor = '#06cf9c';
                                e.target.style.backgroundColor = '#ffffff';
                                e.target.style.boxShadow = '0 0 0 3px rgba(6, 207, 156, 0.1)';
                            }}
                            onBlur={(e) => {
                                e.target.style.borderColor = '#eaeaea';
                                e.target.style.backgroundColor = '#fafafa';
                                e.target.style.boxShadow = 'none';
                            }}
                        />
                    </div>

                    {/* Generate Button */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !prompt.trim()}
                        style={{
                            width: '100%',
                            padding: '12px',
                            background: isGenerating ? '#f5f5f5' : '#111111',
                            color: isGenerating ? '#aaa' : '#ffffff',
                            border: isGenerating ? '1px solid #eaeaea' : '1px solid #111111',
                            borderRadius: 10,
                            fontSize: '14px',
                            fontWeight: 500,
                            fontFamily: 'inherit',
                            cursor: isGenerating || !prompt.trim() ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'all 0.2s',
                            opacity: (!prompt.trim() && !isGenerating) ? 0.7 : 1
                        }}
                        onMouseOver={(e) => {
                            if (!isGenerating && prompt.trim()) {
                                e.currentTarget.style.background = '#333333';
                            }
                        }}
                        onMouseOut={(e) => {
                            if (!isGenerating && prompt.trim()) {
                                e.currentTarget.style.background = '#111111';
                            }
                        }}
                        onMouseDown={(e) => !isGenerating && prompt.trim() && (e.currentTarget.style.transform = 'scale(0.98)')}
                        onMouseUp={(e) => !isGenerating && prompt.trim() && (e.currentTarget.style.transform = 'scale(1)')}
                    >
                        {isGenerating ? (
                            <>
                                <Wand2 className="animate-spin" size={16} />
                                Generating...
                            </>
                        ) : (
                            <>
                                Generate
                            </>
                        )}
                    </button>

                    <div style={{
                        marginTop: 16,
                        fontSize: '11px',
                        color: '#a0a0a0',
                        textAlign: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                    }}>
                        Powered by Flux AI
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AIToolPanel;
