import cron from 'node-cron';
import { supabaseAdmin } from '../config/supabaseClient.js';
import UserService from './userService.js';
import { emailService } from './emailService.js';

/**
 * Daily trial countdown cron job.
 * Runs every day at midnight UTC.
 * 
 * For each user on the trial plan:
 *   - Recalculates daysRemaining
 *   - Sends reminder email at day 3 and day 1
 *   - Marks trial as expired at day 0
 */
export async function runTrialCheck() {
    console.log('[Trial Cron] Running trial check...');

    try {
        // Find all active trial users from Supabase
        const { data: trialUsers, error } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('role', 'trial')
            .eq('trial->>isActive', 'true')
            .eq('trial->>expired', 'false');

        if (error) throw error;

        console.log(`[Trial Cron] Skipping trial expiration check (trial plan is permanent).`);

        // ── Subscription Grace Period Check ──
        console.log('[Trial Cron] Running subscription grace period check...');
        try {
            const { data: nonTrialUsers, error: subError } = await supabaseAdmin
                .from('profiles')
                .select('*')
                .neq('role', 'trial')
                .neq('role', 'admin')
                .neq('role', 'lifetime');

            if (subError) throw subError;

            const graceUsers = (nonTrialUsers || []).filter(u => u.subscription?.gracePeriodEndsAt);
            console.log(`[Trial Cron] Found ${graceUsers.length} users with grace period tracking`);

            for (const row of graceUsers) {
                try {
                    const subscription = row.subscription || {};
                    if (subscription.gracePeriodEndsAt) {
                        const now = new Date();
                        const gracePeriodEndsAt = new Date(subscription.gracePeriodEndsAt);
                        
                        if (now >= gracePeriodEndsAt) {
                            // Grace period ended! Transition user to 7-day free trial now.
                            await UserService.updateUser(row.id, {
                                role: 'trial',
                                credits: {
                                    total: 25,
                                    used: 0,
                                    bonus: 0
                                },
                                usage: { 
                                    searches: 0, 
                                    moodboards: 0, 
                                    shareLinks: 0, 
                                    designAudits: 0, 
                                    brandScanner: 0, 
                                    creatorStudio: 0, 
                                    historySaved: 0,
                                    agenticGenerations: 0 
                                },
                                trial: {
                                    isActive: true,
                                    expired: false,
                                    startedAt: new Date().toISOString(),
                                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                                    daysRemaining: 7,
                                    remindersSent: { day3: false, day1: false }
                                },
                                subscription: {
                                    ...subscription,
                                    status: 'expired',
                                    gracePeriodEndsAt: null
                                }
                            });
                            console.log(`[Trial Cron] Grace period ended. Transitioned ${row.email} to 7-day trial.`);
                            
                            // Send ended/trial started email
                            await emailService.sendSubscriptionEndedTrialStartedEmail(row);
                        } else {
                            const diff = gracePeriodEndsAt - now;
                            const daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
                            console.log(`[Trial Cron] User ${row.email} has ${daysRemaining} days remaining in grace period.`);
                        }
                    }
                } catch (userError) {
                    console.error(`[Error] [Trial Cron] Error processing grace period for ${row.email}:`, userError.message);
                }
            }
        } catch (subCheckError) {
            console.error('[Error] [Trial Cron] Subscription grace period check failed:', subCheckError.message);
        }

        console.log('[Success] [Trial Cron] Trial check complete');
        return { success: true, processedCount: (trialUsers || []).length };
    } catch (error) {
        console.error('[Error] [Trial Cron] Cron job failed:', error.message);
        throw error;
    }
}

export function startTrialCron() {
    // Run at 00:05 UTC daily (5 min offset to avoid exact midnight race)
    cron.schedule('5 0 * * *', async () => {
        await runTrialCheck();
    });

    console.log('Trial countdown cron scheduled (daily at 00:05 UTC)');
}

export default { startTrialCron, runTrialCheck };
