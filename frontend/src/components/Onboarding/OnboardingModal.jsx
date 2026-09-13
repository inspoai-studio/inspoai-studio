import React, { useState } from 'react';
import Step1Profile from './Step1Profile';
import Step2FreePlan from './Step2FreePlan';
import FairUseModal from './FairUseModal';
import '../../styles/Onboarding.css';

export default function OnboardingModal({ user, onComplete }) {
    const [step, setStep] = useState(1);
    const [profileData, setProfileData] = useState({ name: '', designation: '', referralSource: '' });
    const [showFairUseModal, setShowFairUseModal] = useState(false);
    const [saving, setSaving] = useState(false);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    const canProceedStep1 = () => {
        return profileData.name.trim() && profileData.designation && profileData.referralSource;
    };

    const handleNext = () => {
        if (step === 1 && canProceedStep1()) {
            setStep(2);
        }
    };

    const handleBack = () => {
        if (step === 2) {
            setStep(1);
        }
    };

    const handleComplete = async () => {
        setSaving(true);
        // Save profile data and mark onboarding complete in one call
        try {
            const token = await user?.getIdToken?.();
            if (token) {
                await fetch(`${API_URL}/onboarding/save`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                        step: 2,
                        data: profileData,
                        completedStep: 2,
                        onboardingComplete: true,
                    }),
                }).catch(err => console.warn('Onboarding save error:', err));
            }
        } catch (err) {
            console.error('Onboarding save error:', err);
        } finally {
            setSaving(false);
            onComplete();
        }
    };

    return (
        <>
            <div className="ob-overlay">
                <div className="ob-card" style={{ maxWidth: step === 2 ? '720px' : '640px' }}>
                    {/* Body */}
                    <div className="ob-body" style={{ paddingTop: '28px' }}>
                        {step === 1 ? (
                            <Step1Profile data={profileData} onChange={setProfileData} />
                        ) : (
                            <Step2FreePlan onOpenFairUse={() => setShowFairUseModal(true)} />
                        )}
                    </div>

                    {/* Footer */}
                    <div className="ob-footer">
                        {step === 2 && (
                            <button
                                type="button"
                                className="ob-btn-back"
                                onClick={handleBack}
                                disabled={saving}
                            >
                                ← Back
                            </button>
                        )}

                        {step === 1 ? (
                            <button
                                type="button"
                                className="ob-btn-primary"
                                onClick={handleNext}
                                disabled={!canProceedStep1()}
                                style={{ width: '100%', justifyContent: 'center', padding: '14px 28px', fontSize: '15px' }}
                            >
                                Continue →
                            </button>
                        ) : (
                            <button
                                type="button"
                                className="ob-btn-primary ob-btn-start-free"
                                onClick={handleComplete}
                                disabled={saving}
                                style={{ width: '100%', justifyContent: 'center', padding: '14px 28px', fontSize: '15px' }}
                            >
                                {saving ? 'Setting up your account...' : 'Start Free Forever →'}
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Fair Use Modal */}
            <FairUseModal
                isOpen={showFairUseModal}
                onClose={() => setShowFairUseModal(false)}
            />
        </>
    );
}
