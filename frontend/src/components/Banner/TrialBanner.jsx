import React, { useState } from 'react';
import { Clock, X, Sparkles, ArrowRight } from 'lucide-react';
import PricingModal from '../Pricing/PricingModal';
import '../../styles/TrialBanner.css';

/**
 * TrialBanner — shows trial countdown when user.role === 'trial'
 * 
 * When trial is active: dismissible banner with countdown
 * When trial is expired: persistent banner (not dismissible), no full-screen block
 * The actual blocking happens at the action level (search, etc.) in MainScreen
 * 
 * Props:
 *   trial: { isActive, daysRemaining, expired, expiresAt }
 *   currentPlan: string
 */
export default function TrialBanner({ trial, currentPlan }) {
    const [dismissed, setDismissed] = useState(false);
    const [showPricing, setShowPricing] = useState(false);

    if (!trial || currentPlan !== 'trial') return null;

    const { daysRemaining, expired } = trial;

    // Hide banner if days remaining is high (e.g. 9999 for unlimited free trial)
    if (daysRemaining > 30) return null;

    // ── Expired: persistent (non-dismissible) banner — NOT a full-screen block ──
    if (expired || daysRemaining <= 0) {
        return (
            <>
                <div className="trial-banner trial-banner-red">
                    <div className="trial-banner-left">
                        <div className="trial-banner-dot" />
                        <span className="trial-banner-text">
                            Your free trial has ended — upgrade to continue searching
                        </span>
                    </div>
                    <div className="trial-banner-right">
                        <button className="trial-banner-cta" onClick={() => setShowPricing(true)}>
                            <Sparkles size={13} />
                            Choose a Plan
                        </button>
                    </div>
                </div>
                <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} currentPlan={currentPlan} />
            </>
        );
    }

    // ── Dismissed banner ──
    if (dismissed) return null;

    // ── Active trial banner ──
    const isUrgent = daysRemaining <= 3;
    const isLastDay = daysRemaining <= 1;

    return (
        <>
            <div className={`trial-banner ${isLastDay ? 'trial-banner-red' : isUrgent ? 'trial-banner-amber' : 'trial-banner-default'}`}>
                <div className="trial-banner-left">
                    <div className="trial-banner-dot" />
                    <span className="trial-banner-text">
                        {isLastDay
                            ? 'Last day of your free trial'
                            : `Free trial \u00B7 ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`
                        }
                    </span>
                </div>
                <div className="trial-banner-right">
                    <button className="trial-banner-cta" onClick={() => setShowPricing(true)}>
                        Upgrade
                        <ArrowRight size={13} />
                    </button>
                    <button className="trial-banner-dismiss" onClick={() => setDismissed(true)} aria-label="Dismiss">
                        <X size={14} />
                    </button>
                </div>
            </div>
            <PricingModal isOpen={showPricing} onClose={() => setShowPricing(false)} currentPlan={currentPlan} />
        </>
    );
}
