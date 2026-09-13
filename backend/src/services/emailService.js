import { Resend } from 'resend';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

class EmailService {
    /**
     * Sends a welcome email to newly registered users
     * @param {string} toEmail 
     * @param {string} userName 
     */
    async sendWelcomeEmail(toEmail, userName) {
        try {
            const firstName = userName ? userName.split(' ')[0] : 'there';

            // Clean HTML layout under 200 characters of text per requirements
            const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center; color: #333;">
                <img src="https://app.inspoai.io/logo.png" alt="Inspo AI Logo" style="width: 150px; margin-bottom: 20px;">
                <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">Welcome to Inspo AI!</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #555; margin-bottom: 30px;">
                    Hi ${firstName}, your ultimate design inspiration engine awaits. Discover top layouts, trending typography, and pristine assets to elevate your workflow faster than ever.
                </p>
                <a href="https://app.inspoai.io" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                    Jump into Designer Dashboard
                </a>
            </div>
            `;

            const { data, error } = await resend.emails.send({
                from: 'Inspo AI <hello@contact.inspoai.io>', // Update this to verified sender domain
                to: [toEmail],
                subject: 'Welcome to Inspo AI ',
                html: htmlContent,
            });

            if (error) {
                console.error(`[Error] Resend API Error on Welcome Email:`, error);
                return { success: false, error: error.message };
            }

            console.log(`Welcome email sent to ${toEmail}`);
            return { success: true, data };
        } catch (error) {
            console.error(`[Error] Caught failure on welcome email to ${toEmail}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sends a team invite email
     * @param {string} toEmail 
     * @param {string} inviterName 
     * @param {string} inviteLink
     */
    async sendTeamInviteEmail(inviterName, toEmail, inviteLink) {
        try {
            const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; text-align: center; color: #333;">
                <img src="https://app.inspoai.io/logo.png" alt="Inspo AI Logo" style="width: 150px; margin-bottom: 20px;">
                <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 10px;">You've been invited!</h2>
                <p style="font-size: 16px; line-height: 1.5; color: #555; margin-bottom: 30px;">
                    Hi there, ${inviterName} has invited you to join their Team on Inspo AI. 
                    Collaborate, generate unlimited moodboards, and unlock all premium design features together.
                </p>
                <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background-color: #000; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 16px;">
                    Accept Invitation
                </a>
            </div>
            `;

            const { data, error } = await resend.emails.send({
                from: 'Inspo AI <hello@contact.inspoai.io>',
                to: [toEmail],
                subject: `${inviterName} invited you to join their team on Inspo AI `,
                html: htmlContent,
            });

            if (error) {
                console.error(`[Error] Resend API Error on Team Invite Email:`, error);
                return { success: false, error: error.message };
            }

            console.log(`Team invite email sent to ${toEmail}`);
            return { success: true, data };
        } catch (error) {
            console.error(`[Error] Caught failure on team invite email to ${toEmail}:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sends a custom manual update/campaign to selected users from the Admin Dashboard
     * @param {Array<string>} toEmails Array of recipient emails
     * @param {string} subject 
     * @param {string} htmlContent 
     */
    async sendAdminCampaign(toEmails, subject, htmlContent) {
        try {
            const results = [];
            const CHUNK_SIZE = 100;

            // Split emails into chunks of 100 for Resend Batch API
            for (let i = 0; i < toEmails.length; i += CHUNK_SIZE) {
                const chunk = toEmails.slice(i, i + CHUNK_SIZE);
                const batchConfig = chunk.map(email => ({
                    from: 'Inspo AI Team <updates@contact.inspoai.io>',
                    to: [email],
                    subject: subject,
                    html: htmlContent
                }));

                const { data, error } = await resend.batch.send(batchConfig);

                if (error) {
                    console.error(`[Error] Resend API Error on Chunk ${i / CHUNK_SIZE}:`, error);
                    throw new Error(error.message || 'Resend API rejected the batch request');
                }
                results.push(data);
            }

            console.log(`Admin campaign sent targeting ${toEmails.length} users in ${Math.ceil(toEmails.length / CHUNK_SIZE)} batches`);
            return { success: true, results };
        } catch (error) {
            console.error(`[Error] Failed to send admin campaign:`, error.message);
            throw error;
        }
    }

    // ═══════════════════════════════════════
    // Trial Emails
    // ═══════════════════════════════════════

    _getFirstName(user) {
        const name = user?.displayName || user?.display_name || (user?.email ? user.email.split('@')[0] : '') || 'there';
        return name.split(' ')[0];
    }

    _trialSignature() {
        return `
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid #eee;">
          <p style="font-size:14px;color:#333;margin:0 0 4px;font-weight:600;">Farhan</p>
          <p style="font-size:13px;color:#888;margin:0;">Building InspoAI. From a designer, for designers.</p>
          <p style="font-size:13px;color:#888;margin:2px 0 0;">
            <a href="mailto:farhan@inspoai.io" style="color:#888;text-decoration:none;">farhan@inspoai.io</a>
          </p>
        </div>`;
    }

    /**
     * Sends trial activation email when user signs up (Disabled for unlimited trial)
     */
    async sendTrialActivatedEmail(user) {
        console.log(`Skipping sendTrialActivatedEmail for ${user.email} (trial emails disabled)`);
        return { success: true, message: 'Trial emails disabled' };
    }

    /**
     * Sends trial reminder email (Disabled for unlimited trial)
     */
    async sendTrialReminderEmail(user, daysLeft) {
        console.log(`Skipping sendTrialReminderEmail for ${user.email} (trial emails disabled)`);
        return { success: true, message: 'Trial emails disabled' };
    }

    /**
     * Sends trial expired email (Disabled for unlimited trial)
     */
    async sendTrialExpiredEmail(user) {
        console.log(`Skipping sendTrialExpiredEmail for ${user.email} (trial emails disabled)`);
        return { success: true, message: 'Trial emails disabled' };
    }

    /**
     * Sends grace period email when subscription payment fails or is cancelled
     */
    async sendSubscriptionGraceEmail(user, gracePeriodEndsAt, isCancelled) {
        try {
            const firstName = this._getFirstName(user);
            const dateStr = new Date(gracePeriodEndsAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            
            const subject = isCancelled 
                ? 'Your InspoAI subscription is ending soon' 
                : 'Action Required: Your InspoAI payment failed';

            const htmlContent = `
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9f9f9;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
  <div style="padding:36px 40px;">
    <p style="font-size:16px;color:#111;margin:0 0 16px;">Hey ${firstName} </p>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
      ${isCancelled
        ? `We received your request to cancel auto-renewal. Your subscription is currently scheduled to expire, but we have activated a <strong>3-day grace period</strong>. You have full access until <strong>${dateStr}</strong>.`
        : `We were unable to process your payment for this billing cycle. To prevent any interruption, we've started a <strong>3-day grace period</strong>. You have until <strong>${dateStr}</strong> to update your billing details.`}
    </p>
    <div style="background:#fffbeb;border-radius:10px;padding:16px 20px;text-align:center;margin:0 0 20px;">
      <p style="font-size:24px;font-weight:700;color:#d97706;margin:0;">3 Days Grace</p>
      <p style="font-size:12px;color:#888;margin:4px 0 0;">full access remains active</p>
    </div>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">
      Please update your payment method or renew to maintain access to your moodboards, brand scanner, and agentic UI generations.
    </p>
    <div style="text-align:center;margin:0 0 8px;">
      <a href="https://app.inspoai.io/search?upgrade=true" style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Update Billing Info →</a>
    </div>
    ${this._trialSignature()}
  </div>
</div>
</body>`;

            const { data, error } = await resend.emails.send({
                from: 'Farhan from InspoAI <farhan@contact.inspoai.io>',
                reply_to: 'farhan@inspoai.io',
                to: [user.email],
                subject: subject,
                html: htmlContent
            });

            if (error) {
                console.error('[Error] Grace email error:', error);
                return { success: false, error: error.message };
            }
            console.log(`Subscription grace email sent to ${user.email}`);
            return { success: true, data };
        } catch (error) {
            console.error(`[Error] Subscription grace email failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sends renewal success email
     */
    async sendSubscriptionRenewedEmail(user, planName) {
        try {
            const firstName = this._getFirstName(user);
            const cleanPlan = planName ? planName.toUpperCase().replace('_', ' ') : 'Premium';

            const htmlContent = `
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9f9f9;">
<div style="max-width:520px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #eee;">
  <div style="padding:36px 40px;">
    <p style="font-size:16px;color:#111;margin:0 0 16px;">Hey ${firstName} </p>
    <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 20px;">
      Great news — your InspoAI <strong>${cleanPlan} plan</strong> has successfully renewed! 
      Your daily search quota and monthly Agentic UI credits have been fully reset.
    </p>
    <div style="background:#f0fdf4;border-radius:10px;padding:16px 20px;text-align:center;margin:0 0 20px;">
      <p style="font-size:24px;font-weight:700;color:#16a34a;margin:0;">Renewed Successfully</p>
      <p style="font-size:12px;color:#888;margin:4px 0 0;">all limits reset</p>
    </div>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 20px;">
      Thank you for being a part of InspoAI! If you have any questions, feel free to reply to this email.
    </p>
    <div style="text-align:center;margin:0 0 8px;">
      <a href="https://app.inspoai.io/search" style="display:inline-block;padding:12px 28px;background:#111;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Go to Dashboard →</a>
    </div>
    ${this._trialSignature()}
  </div>
</div>
</body>`;

            const { data, error } = await resend.emails.send({
                from: 'Farhan from InspoAI <farhan@contact.inspoai.io>',
                reply_to: 'farhan@inspoai.io',
                to: [user.email],
                subject: `Your InspoAI subscription has renewed! `,
                html: htmlContent
            });

            if (error) {
                console.error('[Error] Renewal success email error:', error);
                return { success: false, error: error.message };
            }
            console.log(`Subscription renewal success email sent to ${user.email}`);
            return { success: true, data };
        } catch (error) {
            console.error(`[Error] Subscription renewal success email failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Sends email when subscription ends and user transitions to trial (Disabled for unlimited trial)
     */
    async sendSubscriptionEndedTrialStartedEmail(user) {
        console.log(`Skipping sendSubscriptionEndedTrialStartedEmail for ${user.email} (trial emails disabled)`);
        return { success: true, message: 'Trial emails disabled' };
    }

    async sendRawEmail(toEmail, subject, htmlContent) {
        try {
            const { data, error } = await resend.emails.send({ from: 'InspoAI Alerts <hello@contact.inspoai.io>', to: [toEmail], subject, html: htmlContent });
            if (error) return { success: false, error: error.message };
            return { success: true, data };
        } catch (error) { return { success: false, error: error.message }; }
    }
}

export const emailService = new EmailService();
