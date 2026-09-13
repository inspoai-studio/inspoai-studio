import express from 'express';
import UserService from '../services/userService.js';

const router = express.Router();

// POST /onboarding/save — saves onboarding step data for a user
router.post('/save', async (req, res) => {
    try {
        const user = req.user; // Set by authenticateUser middleware
        const { step, data, completedStep, onboardingComplete } = req.body;

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Build the onboarding JSONB update
        const onboarding = { ...(user.onboarding || {}) };
        onboarding.completedStep = completedStep;
        onboarding.onboardingComplete = onboardingComplete || false;
        onboarding.lastUpdated = new Date().toISOString();

        // Save step-specific fields
        if (step === 1 && data) {
            if (data.name) onboarding.name = data.name;
            if (data.designation) onboarding.designation = data.designation;
            if (data.referralSource) onboarding.referralSource = data.referralSource;
        }

        const updates = { onboarding };

        if (onboardingComplete) {
            onboarding.completedAt = new Date().toISOString();
            updates.onboarding_complete = true; // Top-level flag used by AuthContext
        }

        await UserService.updateUser(user.id, updates);

        return res.status(200).json({ success: true, step: completedStep });
    } catch (error) {
        console.error('[Error] Onboarding save error:', error.message);
        return res.status(500).json({ error: 'Failed to save onboarding data' });
    }
});



export default function setupOnboardingRoutes(app, { authenticateUser }) {
    app.use('/onboarding', authenticateUser, router);
    console.log('Onboarding routes initialized');
}
