import React from 'react';
import { X, Check, Zap, Crown, Star } from 'lucide-react';
import { auth } from '../../firebase';
import '../../styles/PricingModal.css';

const APP_PLANS = [
    {
        id: 'free',
        name: 'Free Starter',
        priceMonthly: '$0',
        priceAnnually: '$0',
        periodMonthly: 'forever',
        periodAnnually: 'forever',
        icon: Star,
        color: '#10b981',
        popular: false,
        active: true,
        features: [
            '5 Daily AI Generations (Resets Daily)',
            '25 searches / day',
            'Moodboard creations & sharing',
            'Design audits & inspections',
            'Brand scanning tools',
            'Screenshot to Figma Unlimited',
            'Chrome extension access',
            'Access to 200K curated design index',
            'No credit card required',
        ],
        cta: 'Active Plan',
    },
    {
        id: 'lite',
        name: 'Lite',
        priceMonthly: '$12',
        priceAnnually: '$10',
        periodMonthly: '/month',
        periodAnnually: '/mo, billed annually',
        icon: Star,
        color: '#111',
        comingSoon: true,
        features: [
            '30 Agentic UI Generations / mo',
            '300 Agentic UI Generations / year',
            '25 searches / day',
            '3 moodboard creations & sharing',
            '5 design audits',
            'Screenshot to Figma Unlimited',
            'All search history saved',
            'Unlimited moodboard views',
            'Chrome extension access',
            'Access to 200K curated design index',
        ],
        cta: 'Coming Soon',
    },
    {
        id: 'freelancer',
        name: 'Freelancer',
        priceMonthly: '$22',
        priceAnnually: '$18.33',
        periodMonthly: '/month',
        periodAnnually: '/mo, billed annually',
        icon: Zap,
        color: '#111',
        popular: false,
        comingSoon: true,
        features: [
            '60 Agentic UI Generations / mo',
            '600 Agentic UI Generations / year',
            '100 searches / day',
            '30 moodboard creations & shares',
            '30 design audits',
            'Screenshot to Figma Unlimited',
            'All search history saved',
            'Unlimited moodboard views',
            'Chrome extension access',
            'Access to 200K curated design index',
            'Email support',
        ],
        cta: 'Coming Soon',
    },
    {
        id: 'team',
        name: 'Pro',
        priceMonthly: '$39',
        priceAnnually: '$32.50',
        periodMonthly: '/month',
        periodAnnually: '/mo, billed annually',
        icon: Crown,
        color: '#8b5cf6',
        popular: true,
        comingSoon: true,
        features: [
            '100 Agentic UI Generations / mo',
            '1,080 Agentic UI Generations / year',
            '300 searches / day',
            'Unlimited moodboard creations',
            '1000 design audits',
            'Screenshot to Figma Unlimited',
            'All search history saved',
            'Unlimited moodboard views',
            'Chrome extension access',
            'Access to 200K curated design index',
            'Priority support',
        ],
        cta: 'Coming Soon',
    },
];

export default function PricingModal({ isOpen, onClose, currentPlan = 'free' }) {
    const [loading, setLoading] = React.useState(null); // stores plan id being loaded
    const [isAnnual, setIsAnnual] = React.useState(true);

    // Lock body scroll + hide navigation while modal is open
    React.useEffect(() => {
        if (isOpen) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
        return () => document.body.classList.remove('modal-open');
    }, [isOpen]);

    if (!isOpen) return null;

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

    const getCookie = (name) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return '';
    };

    const handleUpgrade = async (plan) => {
        if (plan.comingSoon || plan.id === 'free') return;
    };

    return (
        <div className="pricing-overlay" onClick={onClose}>
            <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
                <button className="pricing-close" onClick={onClose}>
                    <X size={20} />
                </button>

                <div className="pricing-header">
                    <h2>InspoAI Plans</h2>
                    <p>Free plan is active with 5 daily AI credits. Paid plans coming soon!</p>

                    <div className="pricing-toggle-container">
                        <span className={`toggle-label ${!isAnnual ? 'active' : ''}`}>Monthly</span>
                        <button
                            className={`pricing-toggle-switch ${isAnnual ? 'annual' : 'monthly'}`}
                            onClick={() => setIsAnnual(!isAnnual)}
                            aria-label="Toggle annual billing"
                        >
                            <span className="toggle-slider"></span>
                        </button>
                        <span className={`toggle-label ${isAnnual ? 'active' : ''}`}>Annually <span className="save-badge">Save up to 25%</span></span>
                    </div>
                </div>

                <div className="pricing-grid">
                    {APP_PLANS.map((plan) => {
                        const Icon = plan.icon;
                        const isCurrent = plan.id === 'free' || currentPlan === plan.id;
                        const isComingSoon = plan.comingSoon;

                        return (
                            <div
                                key={plan.id}
                                className={`pricing-card ${plan.popular ? 'popular' : ''} ${isCurrent && !isComingSoon ? 'current' : ''}`}
                                style={isComingSoon ? { opacity: 0.9 } : (plan.id === 'free' ? { border: '2px solid #10b981' } : {})}
                            >
                                {plan.id === 'free' && <div className="popular-tag" style={{ background: '#10b981' }}>Active</div>}
                                {isComingSoon && <div className="popular-tag" style={{ background: '#6b7280' }}>Coming Soon</div>}

                                <div className="pricing-card-icon" style={{ background: `${plan.color}15`, color: plan.color }}>
                                    <Icon size={22} />
                                </div>

                                <h3 className="pricing-card-name">{plan.name}</h3>

                                <div className="pricing-card-price">
                                    <span className="price-amount">{isAnnual ? plan.priceAnnually : plan.priceMonthly}</span>
                                    <span className="price-period">{plan.period ? plan.period : (isAnnual ? plan.periodAnnually : plan.periodMonthly)}</span>
                                </div>

                                <ul className="pricing-features">
                                    {plan.features.filter(f => {
                                        if (f.includes('Agentic UI Generations / mo') && isAnnual) return false;
                                        if (f.includes('Agentic UI Generations / year') && !isAnnual) return false;
                                        return true;
                                    }).map((f, i) => (
                                        <li key={i}>
                                            <Check size={14} style={{ color: plan.color }} />
                                            {f.includes('Agentic UI Generations') || f.includes('Daily AI Generations') ? (
                                                <span>
                                                    {f.includes('Daily AI Generations') ? (
                                                        <strong style={{ color: '#10b981' }}>5 Daily AI Generations</strong>
                                                    ) : (
                                                        <>
                                                            {f.split('Agentic UI Generations')[0]}
                                                            <span style={{ color: '#6c5ce7', fontWeight: '700', padding: '0 2px' }}>Agentic UI Generations</span>
                                                            {f.split('Agentic UI Generations')[1]}
                                                        </>
                                                    )}
                                                </span>
                                            ) : f}
                                        </li>
                                    ))}
                                </ul>

                                <button
                                    className={`pricing-cta ${isCurrent && !isComingSoon ? 'cta-current' : ''}`}
                                    style={{
                                        background: isComingSoon ? '#e5e7eb' : (plan.id === 'free' ? '#10b981' : '#111'),
                                        color: isComingSoon ? '#6b7280' : '#fff',
                                        cursor: isComingSoon || plan.id === 'free' ? 'default' : 'pointer'
                                    }}
                                    onClick={() => !isComingSoon && plan.id !== 'free' && handleUpgrade(plan)}
                                    disabled={isComingSoon || plan.id === 'free' || loading !== null}
                                >
                                    {isComingSoon ? 'Coming Soon' : (plan.id === 'free' ? '✓ Free Active' : plan.cta)}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div >
        </div >
    );
}
