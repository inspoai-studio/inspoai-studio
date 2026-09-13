import { auth } from '../firebase';

// Use localhost for new features not yet deployed to production
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class ScannerService {
    static async scanWebsite(url, refresh = false) {
        try {
            // Get the current user's ID token for authentication
            const token = await auth.currentUser?.getIdToken();

            const response = await fetch(`${API_URL}/api/scanner/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url, refresh })
            });

            if (!response.ok) {
                let errorMessage = `Scan failed: ${response.statusText}`;
                let isLimitReached = false;
                try {
                    const errorData = await response.json();
                    if (errorData.message) errorMessage = errorData.message;
                    if (errorData.limitReached) isLimitReached = true;
                } catch (e) {
                    // Ignore parse errors
                }

                const error = new Error(errorMessage);
                if (isLimitReached) error.limitReached = true;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Scanner Service Error:', error);
            throw error;
        }
    }

    static async analyzeCompetitors(url) {
        try {
            const token = await auth.currentUser?.getIdToken();
            const response = await fetch(`${API_URL}/api/scanner/competitors`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to analyze competitors');
            }

            return await response.json();
        } catch (error) {
            console.error('Scanner Service Error (Competitors):', error);
            throw error;
        }
    }

    static async analyzeICP(url) {
        try {
            const token = await auth.currentUser?.getIdToken();
            const response = await fetch(`${API_URL}/api/scanner/icp`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.message || errorData.error || 'Failed to analyze ICP');
                if (errorData.upgradeRequired) error.upgradeRequired = true;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Scanner Service Error (ICP):', error);
            throw error;
        }
    }

    static async analyzeAudit(url) {
        try {
            const token = await auth.currentUser?.getIdToken();
            const response = await fetch(`${API_URL}/api/scanner/audit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ url })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.message || errorData.error || 'Failed to perform audit');
                if (errorData.upgradeRequired) error.upgradeRequired = true;
                throw error;
            }

            return await response.json();
        } catch (error) {
            console.error('Scanner Service Error (Audit):', error);
            throw error;
        }
    }
}

export default ScannerService;
