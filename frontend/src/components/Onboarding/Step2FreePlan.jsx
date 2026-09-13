import React, { useState } from 'react';
import { Check, ShieldAlert, Zap, Layers, Search, Share2, Compass, Figma, Chrome, Code2, History, Mail } from 'lucide-react';

const FEATURES = [
    { icon: Zap, text: '5 Daily AI generation credits (40–50 complete screens daily)' },
    { icon: Code2, text: 'Full Agentic UI Generation with interactive code sandbox' },
    { icon: Search, text: '25 natural language design searches / day across 200K+ index' },
    { icon: Share2, text: '3 collaborative moodboards with real-time public sharing links' },
    { icon: Compass, text: '5 AI design audits & competitor brand scans / day' },
    { icon: Figma, text: 'Screenshot-to-Figma editable converter bridge' },
    { icon: Chrome, text: 'Chrome extension for live visual inspection and clipping' },
    { icon: Layers, text: 'Export clean HTML CSS components' },
    { icon: History, text: 'Saved search history and unlimited reference views' },
    { icon: Mail, text: 'Standard email support' },
];

export default function Step2FreePlan({ onOpenFairUse }) {
    return (
        <div className="ob-step-enter ob-s2-free-container">
            {/* Header pill & title */}
            <div className="ob-s2-free-header">
                <h2 className="ob-s2-free-title">InspoAI is 100% Free Forever</h2>
                <p className="ob-s2-free-sub">Full access to InspoAI design intelligence and generation tools.</p>
            </div>

            {/* Hero Value Highlight Card */}
            <div className="ob-hero-credit-box">
                <div className="ob-hero-price-row">
                    <div className="ob-hero-price">
                        <span className="price-num">$0</span>
                        <span className="price-period">/ forever</span>
                    </div>
                    <div className="ob-hero-credit-pill">
                        <span>5 Free AI Credits Daily</span>
                    </div>
                </div>

                <div className="ob-hero-credit-details">
                    <p className="ob-hero-generates">
                        Generates <strong>40 to 50 complete UI screens daily</strong>
                    </p>
                    <span className="ob-hero-subtext">
                        Refreshes automatically every 24 hours · No credit card required
                    </span>
                </div>
            </div>

            {/* Feature List */}
            <div className="ob-features-section">
                <h3 className="ob-features-title">Included in Free Forever:</h3>
                <div className="ob-features-grid">
                    {FEATURES.map((item, idx) => {
                        const Icon = item.icon;
                        return (
                            <div key={idx} className="ob-feature-item">
                                <div className="ob-feature-icon-wrap">
                                    <Check size={13} strokeWidth={3} className="check-icon" />
                                </div>
                                <span className="ob-feature-text">{item.text}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Fair Use Reminder Callout */}
            <div className="ob-fair-use-box">
                <div className="ob-fair-use-content">
                    <ShieldAlert size={16} className="ob-fair-use-icon" />
                    <span>
                        Please respect our <button type="button" className="ob-fair-use-link" onClick={onOpenFairUse}>fair use policy</button> to avoid a permanent ban. Strictly 1 account per human user — bot farming and multi-accounting are permanently blacklisted.
                    </span>
                </div>
            </div>
        </div>
    );
}
