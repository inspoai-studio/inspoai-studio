import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import '../../styles/MobileProfile.css';
import { LogOut, Crown, CreditCard, ChevronRight, Gift, Link as LinkIcon, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MobileProfile = ({ onUpgradeClick }) => {
    const { user, userData, userQuota, refreshUser } = useAuth();
    const navigate = useNavigate();


    const [referralCode, setReferralCode] = useState(userData?.referral?.referralCode || '');
    const [inputReferral, setInputReferral] = useState('');
    const [referralLoading, setReferralLoading] = useState(false);
    const [referralMessage, setReferralMessage] = useState('');

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    React.useEffect(() => {
        if (userData?.referral?.referralCode) {
            setReferralCode(userData.referral.referralCode);
        }
    }, [userData]);

    const handleGenerateReferral = async () => {
        setReferralLoading(true);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_URL}/api/user/referral-code`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setReferralCode(data.referralCode);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setReferralLoading(false);
        }
    };

    const handleApplyReferral = async () => {
        if (!inputReferral) return;
        setReferralLoading(true);
        setReferralMessage('');
        try {
            const token = await user.getIdToken();
            const res = await fetch(`${API_URL}/api/user/refer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ code: inputReferral })
            });
            const data = await res.json();
            if (res.ok) {
                setReferralMessage('Referral applied! +50 Credits.');
                setInputReferral('');
                // ✓ Re-fetch user data to update credit balance and hide the input box
                await refreshUser();
            } else {
                setReferralMessage(data.error || 'Invalid code');
            }
        } catch (error) {
            setReferralMessage('An error occurred');
        } finally {
            setReferralLoading(false);
        }
    };


    const handleLogout = async () => {
        if (window.confirm('Are you sure you want to log out?')) {
            try {
                localStorage.removeItem('moodboardImages');
                localStorage.removeItem('moodboardColorPalette');
                localStorage.removeItem('moodboardFontPairs');
                localStorage.removeItem('searchHistory');
                sessionStorage.removeItem('inspo_search_state');

                await signOut(auth);
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    };

    const used = userQuota?.used ?? 0;
    const limit = userQuota?.limit ?? 0;
    const percent = limit > 0 ? (used / limit) * 100 : 0;
    const userPlan = userData?.role || 'free';
    const isPaid = ['lite', 'lite_annual', 'freelancer', 'freelancer_annual', 'solo', 'solo_annual', 'team', 'team_annual', 'lifetime', 'admin'].includes(userPlan);

    return (
        <div className="mobile-profile-container">
            <div className="profile-header">
                <h1>Profile</h1>
            </div>

            <div className="profile-card user-card">
                <div className="user-info-main">
                    <div className="avatar-wrapper">
                        <img
                            src={user?.photoURL || '/User.svg'}
                            alt="Profile"
                            className="mobile-avatar"
                            onError={(e) => { e.target.src = '/User.svg'; }}
                        />
                        {userData?.role === 'admin' && (
                            <div className="admin-status-badge">
                                <Crown size={12} fill="#FFD700" stroke="#FFD700" />
                            </div>
                        )}
                    </div>
                    <div className="user-text">
                        <h2>{user?.displayName || 'Anonymous'}</h2>
                        <p>{user?.email}</p>
                    </div>
                    <div className="plan-badge">
                        {userPlan.charAt(0).toUpperCase() + userPlan.slice(1)}
                    </div>
                </div>
            </div>

            <div className="profile-section">
                <h3 className="section-title">Subscription & Usage</h3>
                <div className="profile-card credit-card">
                    <div className="card-header">
                        <div className="icon-text">
                            <CreditCard size={18} />
                            <span>Credits Usage</span>
                        </div>
                        <span className="quota-numbers">
                            {userQuota?.isUnlimited ? 'Unlimited' : `${used} / ${limit}`}
                        </span>
                    </div>

                    {!userQuota?.isUnlimited && (
                        <div className="progress-container">
                            <div className="progress-bar" style={{ width: `${percent}%` }}></div>
                        </div>
                    )}

                    <div className="daily-credit-notice" style={{ marginTop: '12px', padding: '8px 12px', background: '#f4f4f5', borderRadius: '8px', border: '1px solid rgba(0, 0, 0, 0.08)', display: 'flex', alignItems: 'center', fontSize: '12px', color: '#18181b', fontWeight: '500' }}>
                        <span>5 Free AI Credits daily (Resets at midnight UTC)</span>
                    </div>
                </div>
            </div>

            {/* Refer a Friend Section for Free Users */}
            {userPlan === 'free' && (
                <div className="profile-section">
                    <h3 className="section-title">Earn Credits</h3>
                    <div className="profile-card feature-card">
                        <div className="card-header highlight-header">
                            <div className="icon-text">
                                <Gift size={18} color="#8b5cf6" />
                                <span>Refer & get 50 credits</span>
                            </div>
                        </div>
                        <p className="feature-description" style={{ fontSize: '12px', color: '#666', marginTop: '8px', marginBottom: '16px' }}>
                            Get 50 bonus credits for every friend who signs up using your code.
                        </p>

                        {referralCode ? (
                            <div className="referral-display" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <div className="code-box" style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', flex: 1, textAlign: 'center' }}>
                                    <span>{referralCode}</span>
                                </div>
                                <button
                                    className="secondary-btn"
                                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                    onClick={() => {
                                        navigator.clipboard.writeText(`https://app.inspoai.live/signup?ref=${referralCode}`);
                                        setReferralMessage('Link copied!');
                                    }}
                                >
                                    <LinkIcon size={14} /> Copy
                                </button>
                            </div>
                        ) : (
                            <button
                                className="primary-btn"
                                style={{ width: '100%', padding: '12px', background: '#111', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}
                                onClick={handleGenerateReferral}
                                disabled={referralLoading}
                            >
                                {referralLoading ? 'Generating...' : 'Get My Referral Code'}
                            </button>
                        )}

                        {!userData?.referral?.referredBy && (
                            <div className="apply-referral-box" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                                <p style={{ fontSize: '12px', color: '#555', marginBottom: '8px' }}>Have a code?</p>
                                <div className="input-group" style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        style={{ flex: 1, padding: '10px 12px', border: '1px solid #ddd', borderRadius: '8px', fontSize: '14px' }}
                                        value={inputReferral}
                                        onChange={e => setInputReferral(e.target.value)}
                                        placeholder="Enter code"
                                    />
                                    <button
                                        style={{ padding: '0 16px', background: inputReferral ? '#111' : '#f5f5f5', color: inputReferral ? '#fff' : '#999', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: inputReferral ? 'pointer' : 'not-allowed' }}
                                        onClick={handleApplyReferral}
                                        disabled={referralLoading || !inputReferral}
                                    >
                                        Apply
                                    </button>
                                </div>
                            </div>
                        )}
                        {referralMessage && <p className="status-message" style={{ fontSize: '12px', color: '#15803d', marginTop: '12px' }}>{referralMessage}</p>}
                    </div>
                </div>
            )}


            <div className="profile-section">
                <h3 className="section-title">Settings</h3>
                <button className="profile-card logout-item" onClick={handleLogout}>
                    <div className="icon-text logout-text">
                        <LogOut size={18} />
                        <span>Log Out</span>
                    </div>
                    <ChevronRight size={16} />
                </button>
            </div>

            <div className="profile-footer">
                <p>Inspo AI Version 1.0.0 (Beta)</p>
            </div>
        </div>
    );
};

export default MobileProfile;
