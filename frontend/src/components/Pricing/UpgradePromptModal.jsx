import React from 'react';
import { X, Lock, Sparkles, Zap, Crown, ScanLine, Palette, Brain, BarChart3, ArrowRight } from 'lucide-react';
import '../../styles/UpgradePromptModal.css';

const UpgradePromptModal = ({ isOpen, onClose, title, message, onUpgrade }) => {
    if (!isOpen) return null;

    const premiumFeatures = [
        { icon: <ScanLine size={18} />, label: 'Unlimited Brand Scans' },
        { icon: <Palette size={18} />, label: 'Full Color & Typography Analysis' },
        { icon: <Brain size={18} />, label: 'AI-Powered ICP & Growth Ideas' },
        { icon: <BarChart3 size={18} />, label: 'Tech Stack & SEO Audit' },
    ];

    return (
        <div className="upgrade-overlay" onClick={onClose}>
            <div className="upgrade-modal" onClick={(e) => e.stopPropagation()}>
                <button className="upgrade-close-subtle" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>

                {/* Premium badge */}
                <div className="upgrade-badge">
                    <Crown size={14} />
                    <span>PRO</span>
                </div>

                {/* Icon */}
                <div className="upgrade-icon-wrapper">
                    <div className="upgrade-icon-glow" />
                    <Lock size={28} />
                </div>

                {/* Title & message */}
                <h3 className="upgrade-title">{title || "Scan Limit Reached"}</h3>
                <p className="upgrade-message">
                    {message || "Free users get 1 brand scan. Upgrade to Pro for unlimited scans and advanced analysis."}
                </p>

                {/* Feature list */}
                <div className="upgrade-features">
                    {premiumFeatures.map((f, i) => (
                        <div key={i} className="upgrade-feature-item">
                            <div className="upgrade-feature-icon">{f.icon}</div>
                            <span>{f.label}</span>
                        </div>
                    ))}
                </div>

                {/* CTA buttons */}
                <div className="upgrade-actions">
                    <button className="upgrade-btn-primary" onClick={onUpgrade}>
                        <Zap size={18} />
                        Upgrade to Pro
                        <ArrowRight size={16} />
                    </button>
                    <button className="upgrade-btn-secondary" onClick={onClose}>
                        Maybe Later
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpgradePromptModal;
