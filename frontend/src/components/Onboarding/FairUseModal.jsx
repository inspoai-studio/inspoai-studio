import React from 'react';
import { X, ShieldAlert, CheckCircle2, Lock, AlertTriangle } from 'lucide-react';

export default function FairUseModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="ob-overlay" style={{ zIndex: 10005 }} onClick={onClose}>
            <div className="ob-card ob-fair-use-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className="ob-fair-use-modal-header">
                    <div className="ob-fair-use-modal-title-group">
                        <div className="ob-fair-use-modal-badge">
                            <ShieldAlert size={14} /> Fair Use Policy
                        </div>
                        <h3>InspoAI Fair Use Guidelines</h3>
                    </div>
                    <button className="ob-modal-close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="ob-body ob-fair-use-modal-body">
                    <div className="ob-fair-use-modal-warning">
                        <AlertTriangle size={18} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
                        <p>
                            To maintain <strong>100% free daily AI credits for all designers</strong>, multi-accounting and bot scraping are strictly prohibited. Violators are permanently banned.
                        </p>
                    </div>

                    <div className="ob-modal-section">
                        <h4><CheckCircle2 size={16} color="#10b981" /> 1 Account per Human User</h4>
                        <p>
                            Each user receives 5 free AI generation credits daily (generating 40–50 complete screens daily). Reset occurs every 24 hours at midnight UTC.
                        </p>
                    </div>

                    <div className="ob-modal-section">
                        <h4><Lock size={16} color="#3b82f6" /> Strictly Prohibited:</h4>
                        <ul>
                            <li>Creating disposable/temporary email accounts to farm credits.</li>
                            <li>Using automated scripts, bots, or scrapers against InspoAI endpoints.</li>
                            <li>Reverse-engineering internal generation pipelines.</li>
                            <li>Generating malicious, phishing, or harmful content.</li>
                        </ul>
                    </div>

                    <div className="ob-modal-section">
                        <h4><ShieldAlert size={16} color="#f59e0b" /> Automated Detection & Bans:</h4>
                        <p>
                            Our automated telemetry monitors device fingerprints, IP subnets, and anomaly bursts. Any detected farming behavior results in an instant and permanent hardware/account ban with zero appeal.
                        </p>
                    </div>
                </div>

                <div className="ob-footer">
                    <button className="ob-btn-primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
                        I Understand & Agree
                    </button>
                </div>
            </div>
        </div>
    );
}
