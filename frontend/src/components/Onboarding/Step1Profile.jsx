import React, { useState } from 'react';

const DESIGNATIONS = [
    'UI/UX Designer', 'Product Designer', 'Graphic Designer', 'Brand Designer',
    'Motion Designer', 'Web Designer', 'Visual Designer', 'Developer',
    'Frontend Developer', 'Marketing', 'Content Creator', 'Founder / CEO',
    'Product Manager', 'Student', 'Freelancer', 'Other'
];

const REFERRAL_SOURCES = [
    'Twitter / X', 'LinkedIn', 'Instagram', 'Product Hunt', 'Google',
    'Friend / Colleague', 'YouTube', 'Podcast', 'Designer Community',
    'Dribbble', 'Behance', 'Reddit', 'Newsletter', 'Other'
];

export default function Step1Profile({ data, onChange }) {
    return (
        <div className="ob-step-enter">
            <h2 className="ob-s1-title">Let's personalise your InspoAI ✦</h2>
            <p className="ob-s1-sub">Tell us a little about yourself so we can tailor your experience.</p>

            <div className="ob-field">
                <label className="ob-label">Your name</label>
                <input
                    className="ob-input"
                    type="text"
                    placeholder="e.g. Alex Chen"
                    value={data.name || ''}
                    onChange={(e) => onChange({ ...data, name: e.target.value })}
                />
            </div>

            <div className="ob-field">
                <label className="ob-label">Your designation</label>
                <select
                    className="ob-input"
                    value={data.designation || ''}
                    onChange={(e) => onChange({ ...data, designation: e.target.value })}
                >
                    <option value="">Select your role...</option>
                    {DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>

            <div className="ob-field">
                <label className="ob-label">How did you find InspoAI?</label>
                <select
                    className="ob-input"
                    value={data.referralSource || ''}
                    onChange={(e) => onChange({ ...data, referralSource: e.target.value })}
                >
                    <option value="">Select a source...</option>
                    {REFERRAL_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
        </div>
    );
}
