import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, Sparkles } from 'lucide-react';
import '../../styles/GlobalBanner.css';

const TYPE_CONFIG = {
    info:    { icon: Info,           bg: '#ffffff', label: 'Info' },
    warning: { icon: AlertTriangle,  bg: '#ffffff', label: 'Warning' },
    promo:   { icon: Sparkles,       bg: '#ffffff', label: 'Promo' },
};

export default function GlobalBanner() {
    const [banner, setBanner] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        fetchBanner();
    }, []);

    const fetchBanner = async () => {
        try {
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';
            const res = await fetch(`${API_URL}/api/banner`);
            const data = await res.json();
            if (data.banner && data.banner.active) {
                const dismissedBanner = sessionStorage.getItem('dismissedBanner');
                if (dismissedBanner !== data.banner.message) {
                    setBanner(data.banner);
                }
            }
        } catch (err) {
            // Silent fail — banner is optional
        }
    };

    const handleDismiss = () => {
        setClosing(true);
        setTimeout(() => {
            if (banner) {
                sessionStorage.setItem('dismissedBanner', banner.message);
            }
            setDismissed(true);
        }, 300);
    };

    if (!banner || dismissed) return null;

    const config = TYPE_CONFIG[banner.type] || TYPE_CONFIG.info;
    const Icon = config.icon;

    return (
        <div
            className={`global-banner ${closing ? 'banner-closing' : ''}`}
            style={{ background: config.bg }}
        >
            <div className="global-banner-inner">
                <Icon size={16} strokeWidth={2.5} />
                <span className="global-banner-text">{banner.message}</span>
                {banner.link && (
                    <a href={banner.link} target="_blank" rel="noopener noreferrer" className="global-banner-link">
                        Learn more →
                    </a>
                )}
            </div>
            <button className="banner-dismiss" onClick={handleDismiss} aria-label="Dismiss banner">
                <X size={16} />
            </button>
        </div>
    );
}
