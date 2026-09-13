import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import posthog from 'posthog-js';
import { useLocation } from 'react-router-dom';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null); // Firebase user object
    const [userData, setUserData] = useState(null); // Backend user data
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [userQuota, setUserQuota] = useState(null);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // ── Capture UTM / referrer on first page load ──
    useEffect(() => {
        if (sessionStorage.getItem('__acq_captured')) return;
        const params = new URLSearchParams(window.location.search);
        const acq = {
            utmSource:   params.get('utm_source') || null,
            utmMedium:   params.get('utm_medium') || null,
            utmCampaign: params.get('utm_campaign') || null,
            referrer:    document.referrer || null,
            landingPage: window.location.href,
        };
        // Always store — even "direct" traffic (no referrer) needs to be tracked
        sessionStorage.setItem('__acq_data', JSON.stringify(acq));
        sessionStorage.setItem('__acq_captured', '1');
    }, []);

    // ── Send acquisition data once after first login ──
    const sendAcquisitionData = async (authUser) => {
        try {
            const raw = sessionStorage.getItem('__acq_data');
            if (!raw) return;
            const acq = JSON.parse(raw);
            const token = await authUser.getIdToken();
            await fetch(`${API_URL}/api/user/acquisition`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify(acq),
            });
            sessionStorage.removeItem('__acq_data'); // Don't send again
        } catch (_) { /* fire-and-forget */ }
    };

    const fetchUserData = async (authUser, attempt = 1) => {
        try {
            const token = await authUser.getIdToken(true);
            const response = await fetch(`${API_URL}/auth/user`, {
                headers: { Authorization: `Bearer ${token}` },
                method: 'get'
            });

            if (!response.ok) throw new Error('Failed to fetch user profile');

            const data = await response.json();
            setUserData(data);
            setUserQuota(data.quota);

            try {
                posthog.identify(authUser.uid, {
                    email: data.email || authUser.email,
                    name: data.displayName || authUser.displayName,
                    plan: data.role || 'free',
                    created_at: data.createdAt,
                });
            } catch (phErr) { /* Silently ignore */ }

            // Fire-and-forget: send acquisition data on first auth
            sendAcquisitionData(authUser);
            trackActivity(authUser, 'Login');

        } catch (error) {
            console.error(`Error fetching user data (attempt ${attempt}):`, error);
            // Retry up to 3 times with 1s delay for transient network errors
            if (attempt < 3) {
                setTimeout(() => fetchUserData(authUser, attempt + 1), 1000);
            } else {
                setError('Failed to load user profile. Please try again.');
            }
        }
    };

    const getFeatureName = (pathname) => {
        if (pathname.startsWith('/agentic-ui-test')) return 'Agentic UI Test';
        if (pathname.startsWith('/agentic-ui') || pathname === '/') return 'Agentic UI';
        if (pathname.startsWith('/search')) return 'Search';
        if (pathname.startsWith('/moodboard')) return 'Moodboard';
        if (pathname.startsWith('/creator-studio')) return 'Creator Studio';
        if (pathname.startsWith('/audit')) return 'AI Audit';
        if (pathname.startsWith('/library')) return 'Library';
        if (pathname.startsWith('/scanner')) return 'Brand Scanner';
        if (pathname.startsWith('/profile')) return 'Profile';
        if (pathname.startsWith('/developer') || pathname.startsWith('/docs')) return 'Developer';
        if (pathname.startsWith('/mcp')) return 'MCP';
        return 'General Navigation';
    };

    const trackActivity = async (authUserOrNull, feature, duration = 0) => {
        try {
            const authUser = authUserOrNull || auth.currentUser;
            if (!authUser) return;
            const token = await authUser.getIdToken();
            await fetch(`${API_URL}/api/user/activity`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    Authorization: `Bearer ${token}` 
                },
                body: JSON.stringify({ feature, duration }),
            });
        } catch (_) { /* fire-and-forget */ }
    };

    const location = useLocation();

    // Heartbeat tracking for session duration / time spent in the current active module
    useEffect(() => {
        if (!currentUser) return;

        const feature = getFeatureName(location.pathname);
        // Track the immediate entry/page-view
        trackActivity(currentUser, feature, 0);

        let accumulatedTime = 0;
        const interval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                accumulatedTime += 15; // 15 seconds active
                if (accumulatedTime >= 30) {
                    trackActivity(currentUser, feature, accumulatedTime);
                    accumulatedTime = 0;
                }
            }
        }, 15000);

        return () => {
            clearInterval(interval);
            if (accumulatedTime > 0) {
                trackActivity(currentUser, feature, accumulatedTime);
            }
        };
    }, [currentUser, location.pathname]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (authUser) => {
            setCurrentUser(authUser);
            // Unblock render immediately — Firebase auth is the source of truth
            setLoading(false);
 
            if (authUser) {
                // Fetch backend profile in background, don't block the UI
                fetchUserData(authUser);
            } else {
                setUserData(null);
                setUserQuota(null);
                try { posthog.reset(); } catch (_) { }
            }
        });
 
        return () => unsubscribe();
    }, []);
 
    // Expose a way for components to manually re-fetch user data (e.g. after referral)
    const refreshUser = async () => {
        const authUser = auth.currentUser;
        if (authUser) {
            await fetchUserData(authUser);
        }
    };
 
    // Expose both the raw Firebase user (for tokens) and the backend user data
    const value = {
        user: currentUser, // Keeps compatibility with components expecting .getIdToken()
        userData,          // Backend profile data
        loading,
        error,
        userQuota,
        refreshUser,       // Call this after mutations like referral to re-sync UI
        trackActivity: (feat, dur = 0) => trackActivity(null, feat, dur)
    };
 
    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};



