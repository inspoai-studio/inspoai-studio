import { supabaseAdmin } from '../config/supabaseClient.js';
import CREDIT_LIMITS from '../config/creditLimits.js';

// ═══════════════════════════════════════════════════════════════════
// Supabase User Service — Drop-in replacement for Mongoose User model
// ═══════════════════════════════════════════════════════════════════

// ── Helper: Attach computed methods to a plain profile object ──
function attachMethods(profile) {
    if (!profile) return null;

    profile.getPlanLimits = function () {
        return CREDIT_LIMITS[this.role] || CREDIT_LIMITS.free || CREDIT_LIMITS.trial;
    };

    profile.getRemainingCredits = function () {
        const limits = this.getPlanLimits();
        if (limits.credits === Infinity) return Infinity;
        const c = this.credits || {};
        return Math.max(0, ((c.total || 0) + (c.bonus || 0)) - (c.used || 0));
    };

    profile.hasCredits = function (amount = 1) {
        if (this.role === 'admin' || this.role === 'lifetime') return true;
        return this.getRemainingCredits() >= amount;
    };

    profile.hasFeatureAccess = function (feature) {
        const limits = this.getPlanLimits();
        const value = limits[feature];
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (value === Infinity) return true;
            const used = this.usage?.[feature] || 0;
            return used < value;
        }
        return false;
    };

    profile.getRemainingSearches = function () {
        const limits = this.getPlanLimits();
        if (limits.searches === Infinity) return Infinity;
        const used = this.usage?.searches || 0;
        return Math.max(0, limits.searches - used);
    };

    profile.hasAvailableSearches = function () {
        return this.hasFeatureAccess('searches') && this.hasCredits();
    };

    profile.isTrialExpired = function () {
        return false;
    };

    profile.getTrialDaysRemaining = function () {
        if (this.role !== 'trial') return null;
        return 9999;
    };

    profile.getQuotaInfo = function () {
        const limits = this.getPlanLimits();
        const nextReset = new Date();
        nextReset.setUTCDate(nextReset.getUTCDate() + 1);
        nextReset.setUTCHours(0, 0, 0, 0);
        const isUnlimited = this.role === 'admin' || this.role === 'lifetime';
        return {
            used: this.usage?.searches || 0,
            limit: isUnlimited ? 'Unlimited' : limits.searches,
            remaining: isUnlimited ? 'Unlimited' : this.getRemainingSearches(),
            resetsAt: nextReset,
            isUnlimited,
            plan: this.role,
            maxImagesPerMoodboard: limits.maxImagesPerMoodboard || Infinity,
            credits: {
                remaining: this.getRemainingCredits() === Infinity ? 'Unlimited' : this.getRemainingCredits(),
                total: isUnlimited ? 'Unlimited' : (this.credits?.total || 0) + (this.credits?.bonus || 0)
            }
        };
    };

    profile.getUsageStats = function () {
        const limits = this.getPlanLimits();
        const usage = this.usage || {};
        const stats = {};
        for (const [key, limit] of Object.entries(limits)) {
            if (key === 'creditsExpire' || key === 'price' || key.includes('Cost') || key.includes('Bonus')) continue;
            if (typeof limit === 'boolean') {
                stats[key] = { allowed: limit };
            } else if (typeof limit === 'number') {
                const used = usage[key] || 0;
                stats[key] = {
                    used,
                    limit: limit === Infinity ? 'Unlimited' : limit,
                    remaining: limit === Infinity ? 'Unlimited' : Math.max(0, limit - used)
                };
            }
        }
        stats.credits = {
            total: (this.credits?.total || 0) + (this.credits?.bonus || 0),
            used: this.credits?.used || 0,
            remaining: this.getRemainingCredits() === Infinity ? 'Unlimited' : this.getRemainingCredits()
        };
        return stats;
    };

    profile.incrementSearchCount = async function () {
        const usage = { ...(this.usage || {}) };
        usage.searches = (usage.searches || 0) + 1;
        const credits = { ...(this.credits || {}) };
        if (this.role !== 'admin' && this.role !== 'lifetime') {
            credits.used = (credits.used || 0) + 1;
        }
        await updateUser(this.id, { usage, credits });
        // Update local state so subsequent reads in the same request are correct
        this.usage = usage;
        this.credits = credits;
    };

    // Map Supabase column names to Mongoose-style property names for compatibility
    profile.uid = profile.id;
    profile.displayName = profile.display_name;
    profile.photoURL = profile.photo_url;
    profile.isActive = profile.is_active;
    profile.onboardingComplete = profile.onboarding_complete;
    profile.searchHistory = profile.search_history || [];
    profile.createdAt = profile.created_at;
    profile.updatedAt = profile.updated_at;

    return profile;
}

// ── CRUD Operations ──

export async function findByUid(uid) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .single();
    if (error && error.code !== 'PGRST116') console.error('findByUid error:', error.message);
    return attachMethods(data);
}

export async function findByEmail(email) {
    if (!email) return null;
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .ilike('email', email.trim())
        .single();
    if (error && error.code !== 'PGRST116') console.error('findByEmail error:', error.message);
    return attachMethods(data);
}

export async function createUser(userData) {
    const row = {
        id: userData.uid,
        email: userData.email,
        display_name: userData.displayName || userData.email.split('@')[0],
        photo_url: userData.photoURL || null,
        role: userData.role || 'trial',
        credits: userData.credits || { total: 25, used: 0, bonus: 0 },
        usage: userData.usage || {},
        trial: userData.trial || {
            isActive: true,
            startedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            daysRemaining: 7,
            expired: false
        },
        subscription: userData.subscription || { status: null },
        team: userData.team || { isTeamMember: false, teamOwner: null },
        referral: userData.referral || {},
        acquisition: userData.acquisition || {},
        extension: userData.extension || {},
        onboarding: userData.onboarding || {},
        search_history: [],
    };

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .insert(row)
        .select()
        .single();

    if (error) throw error;
    return attachMethods(data);
}

export async function updateUser(uid, updates) {
    // Map JS-style keys to DB column names
    const mapped = {};
    if (updates.displayName !== undefined) mapped.display_name = updates.displayName;
    if (updates.photoURL !== undefined) mapped.photo_url = updates.photoURL;
    if (updates.email !== undefined) mapped.email = updates.email;
    if (updates.role !== undefined) mapped.role = updates.role;
    if (updates.isActive !== undefined) mapped.is_active = updates.isActive;
    if (updates.onboardingComplete !== undefined) mapped.onboarding_complete = updates.onboardingComplete;
    if (updates.credits !== undefined) mapped.credits = updates.credits;
    if (updates.usage !== undefined) mapped.usage = updates.usage;
    if (updates.trial !== undefined) mapped.trial = updates.trial;
    if (updates.subscription !== undefined) mapped.subscription = updates.subscription;
    if (updates.team !== undefined) mapped.team = updates.team;
    if (updates.referral !== undefined) mapped.referral = updates.referral;
    if (updates.acquisition !== undefined) mapped.acquisition = updates.acquisition;
    if (updates.extension !== undefined) mapped.extension = updates.extension;
    if (updates.onboarding !== undefined) mapped.onboarding = updates.onboarding;
    if (updates.search_history !== undefined) mapped.search_history = updates.search_history;
    if (updates.notifications !== undefined) mapped.notifications = updates.notifications;
    if (updates.onboarding_complete !== undefined) mapped.onboarding_complete = updates.onboarding_complete;
    mapped.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
        .from('profiles')
        .update(mapped)
        .eq('id', uid)
        .select()
        .single();

    if (error) throw error;
    return attachMethods(data);
}

export async function upgradePlan(uid, newRole, paymentData = {}) {
    const limits = CREDIT_LIMITS[newRole];
    if (!limits) throw new Error(`Invalid plan: ${newRole}`);

    const updates = {
        role: newRole,
        credits: {
            total: limits.credits === Infinity ? 999999 : limits.credits,
            used: 0,
            bonus: limits.creatorStudioBonusCredits || 0
        },
        usage: { searches: 0, moodboards: 0, shareLinks: 0, designAudits: 0, brandScanner: 0, creatorStudio: 0, historySaved: 0 },
        trial: { isActive: false, expired: false },
        subscription: {
            status: 'active',
            paidAt: new Date().toISOString(),
            ...(paymentData.orderId && { lemonSqueezyOrderId: paymentData.orderId }),
            ...(paymentData.customerId && { lemonSqueezyCustomerId: paymentData.customerId }),
            ...(paymentData.subscriptionId && { lemonSqueezySubscriptionId: paymentData.subscriptionId }),
            ...(paymentData.variantId && { variantId: paymentData.variantId }),
            ...(paymentData.amount && { amount: paymentData.amount }),
        },
    };

    return updateUser(uid, updates);
}

export async function resetQuotaIfNeeded(uid, profile) {
    const now = new Date();
    const lastReset = profile.updated_at ? new Date(profile.updated_at) : new Date(0);
    const todayMidnight = new Date(now);
    todayMidnight.setUTCHours(0, 0, 0, 0);

    if (lastReset < todayMidnight) {
        const limits = CREDIT_LIMITS[profile.role] || CREDIT_LIMITS.trial;
        const updates = {
            credits: {
                total: limits.credits === Infinity ? 999999 : limits.credits,
                used: 0,
                bonus: profile.credits?.bonus || 0
            },
            usage: { 
                searches: 0, 
                moodboards: 0, 
                shareLinks: 0, 
                designAudits: profile.role === 'lifetime' ? (profile.usage?.designAudits || 0) : 0, 
                brandScanner: profile.role === 'lifetime' ? (profile.usage?.brandScanner || 0) : 0, 
                creatorStudio: 0, 
                historySaved: 0,
                agenticGenerations: profile.usage?.agenticGenerations || 0 
            },
        };
        await updateUser(uid, updates);
        console.log(`Daily reset for ${profile.email} (${profile.role})`);
        return true;
    }
    return false;
}

export async function incrementUsage(uid, feature, profile) {
    const usage = { ...(profile.usage || {}) };
    usage[feature] = (usage[feature] || 0) + 1;
    const credits = { ...(profile.credits || {}) };
    if (profile.role !== 'admin' && profile.role !== 'lifetime') {
        credits.used = (credits.used || 0) + 1;
    }
    await updateUser(uid, { usage, credits });
}

// ── Query helpers for admin ──

export async function countProfiles(filters = {}) {
    let query = supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
    if (filters.role) query = query.eq('role', filters.role);
    if (filters.is_active !== undefined) query = query.eq('is_active', filters.is_active);
    if (filters.onboarding_complete !== undefined) query = query.eq('onboarding_complete', filters.onboarding_complete);
    if (filters.search) {
        query = query.or(`email.ilike.%${filters.search}%,display_name.ilike.%${filters.search}%`);
    }
    const { count, error } = await query;
    if (error) throw error;
    return count || 0;
}

// Common consumer email domains used for work-email filtering
const PERSONAL_EMAIL_DOMAINS = [
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
    'yahoo.com', 'yahoo.co.in', 'yahoo.co.uk', 'ymail.com', 'aol.com',
    'icloud.com', 'me.com', 'mac.com', 'protonmail.com', 'proton.me',
    'zoho.com', 'mail.com', 'gmx.com', 'gmx.net', 'yandex.com', 'yandex.ru',
    'tutanota.com', 'fastmail.com', 'hey.com', 'inbox.com', 'rediffmail.com',
    'qq.com', '163.com', '126.com', 'naver.com', 'daum.net',
];

export async function findProfiles({ page = 1, limit = 25, search = '', role = '', status = '', from = '', to = '', emailType = '', isPaying = false } = {}) {
    const offset = (page - 1) * limit;

    // When emailType filter is active, we must fetch ALL users first (no DB pagination),
    // apply domain filtering across the entire dataset, then manually paginate the results.
    // Otherwise Supabase only returns 25 users and we filter within that tiny slice.
    const needsFullScan = !!emailType;

    let query = supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

    // Only apply DB-level pagination when NOT doing email-type filtering
    if (!needsFullScan) {
        query = query.range(offset, offset + limit - 1);
    }

    if (search) query = query.or(`email.ilike.%${search}%,display_name.ilike.%${search}%`);
    if (role) query = query.eq('role', role);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (isPaying) query = query.not('role', 'in', '("trial","free","admin")');

    const { data, count, error } = await query;
    if (error) throw error;

    let allUsers = (data || []).map(attachMethods);

    // Apply email type filtering across the FULL dataset
    if (emailType === 'work') {
        allUsers = allUsers.filter(u => {
            const domain = (u.email || '').split('@')[1]?.toLowerCase();
            return domain && !PERSONAL_EMAIL_DOMAINS.includes(domain);
        });
    } else if (emailType === 'personal') {
        allUsers = allUsers.filter(u => {
            const domain = (u.email || '').split('@')[1]?.toLowerCase();
            return domain && PERSONAL_EMAIL_DOMAINS.includes(domain);
        });
    }

    // When email type was filtered, manually paginate the filtered results
    if (needsFullScan) {
        const total = allUsers.length;
        const paginatedUsers = allUsers.slice(offset, offset + limit);
        return { users: paginatedUsers, total };
    }

    return { users: allUsers, total: count || 0 };
}

export async function findAllActiveProfiles() {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name, role')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(p => ({ uid: p.id, email: p.email, displayName: p.display_name, role: p.role }));
}

export async function getPlanDistribution() {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('role');
    if (error) throw error;
    const counts = {};
    (data || []).forEach(p => { counts[p.role] = (counts[p.role] || 0) + 1; });
    return Object.entries(counts).map(([plan, count]) => ({ plan, count }));
}

export async function getRecentSignups(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('created_at')
        .gte('created_at', since);
    if (error) throw error;
    const counts = {};
    (data || []).forEach(p => {
        const day = p.created_at?.split('T')[0];
        if (day) counts[day] = (counts[day] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
}

export async function getRecentUsers(limit = 10) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('email, display_name, role, created_at, is_active')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []).map(u => ({
        email: u.email, displayName: u.display_name, role: u.role,
        createdAt: u.created_at, isActive: u.is_active
    }));
}

export async function bulkResetTrials() {
    const now = new Date();
    const trialExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Fetch all trial users
    const { data: trialUsers, error: fetchErr } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('role', 'trial');
    if (fetchErr) throw fetchErr;

    const ids = (trialUsers || []).map(u => u.id);
    if (ids.length === 0) return 0;

    const { error } = await supabaseAdmin
        .from('profiles')
        .update({
            trial: { started: now.toISOString(), expiresAt: trialExpiry.toISOString(), expired: false },
            credits: { total: 25, used: 0, bonus: 0 },
            updated_at: now.toISOString()
        })
        .eq('role', 'trial');
    if (error) throw error;
    return ids.length;
}

// ── Acquisition queries ──
export async function getUsersWithAcquisition(limit = 5000) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, email, display_name, photo_url, acquisition, created_at')
        .not('acquisition->capturedAt', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []).map(u => ({
        uid: u.id, email: u.email, displayName: u.display_name, photoURL: u.photo_url,
        acquisition: u.acquisition || {}, createdAt: u.created_at
    }));
}

// ── Extension queries ──
export async function getExtensionInstalledCount() {
    const { count, error } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('extension->installed', true);
    if (error) return 0;
    return count || 0;
}

export async function getExtensionActiveLastWeek() {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count, error } = await supabaseAdmin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('extension->installed', true)
        .gte('extension->lastActiveAt', since);
    if (error) return 0;
    return count || 0;
}

export async function getTopExtensionUsers(limit = 10) {
    const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('display_name, email, photo_url, extension')
        .eq('extension->installed', true)
        .order('extension->screenshotCount', { ascending: false })
        .limit(limit);
    if (error) return [];
    return (data || []).map(u => ({
        displayName: u.display_name, email: u.email, photoURL: u.photo_url,
        screenshotCount: u.extension?.screenshotCount || 0,
        lastActiveAt: u.extension?.lastActiveAt
    }));
}

// ── Extension Events ──
export async function createExtensionEvent(eventData) {
    const { error } = await supabaseAdmin
        .from('extension_events')
        .insert({
            user_id: eventData.userId,
            email: eventData.email,
            event_type: eventData.eventType,
            metadata: eventData.metadata || {},
        });
    if (error) console.error('Extension event insert error:', error.message);
}

export async function getExtensionEvents({ page = 1, limit = 50, email = '', eventType = '', from = '', to = '' } = {}) {
    const offset = (page - 1) * limit;
    let query = supabaseAdmin
        .from('extension_events')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (email) query = query.ilike('email', `%${email}%`);
    if (eventType) query = query.eq('event_type', eventType);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { events: data || [], total: count || 0 };
}

export async function getRecentExtensionEvents(limit = 20) {
    const { data, error } = await supabaseAdmin
        .from('extension_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data || [];
}

export async function getExtensionDailyActivity(days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
        .from('extension_events')
        .select('event_type, created_at')
        .gte('created_at', since);
    if (error) return [];
    const counts = {};
    (data || []).forEach(e => {
        const day = e.created_at?.split('T')[0];
        const type = e.event_type;
        const key = `${day}|${type}`;
        counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([key, count]) => {
        const [date, type] = key.split('|');
        return { date, type, count };
    });
}

// ── Notifications (stored in profiles JSONB — kept simple) ──
export async function pushNotification(uid, notification) {
    const profile = await findByUid(uid);
    if (!profile) return;
    const notifications = profile.notifications || [];
    notifications.push(notification);
    await supabaseAdmin.from('profiles').update({ notifications }).eq('id', uid);
}

// ── Moodboard helpers ──
export async function getUserMoodboards(userId) {
    const { data, error } = await supabaseAdmin
        .from('moodboards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function createMoodboard(userId, mbData) {
    const { data, error } = await supabaseAdmin
        .from('moodboards')
        .insert({ user_id: userId, title: mbData.title || 'My Moodboard', images: mbData.images || [], is_public: mbData.isPublic !== undefined ? mbData.isPublic : true })
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteMoodboard(mbId, userId) {
    const { error } = await supabaseAdmin
        .from('moodboards')
        .delete()
        .eq('id', mbId)
        .eq('user_id', userId);
    if (error) throw error;
}

// ── Shared Moodboards ──
export async function findSharedMoodboard(shareCode) {
    const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .select('*')
        .eq('share_code', shareCode)
        .single();
    if (error) return null;
    return data;
}

export async function createSharedMoodboard(smData) {
    const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .insert(smData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Scan Results ──
export async function findScanResult(url) {
    const { data, error } = await supabaseAdmin
        .from('scan_results')
        .select('*')
        .eq('url', url)
        .single();
    if (error) return null;
    return data;
}

export async function upsertScanResult(url, scanData) {
    const { data, error } = await supabaseAdmin
        .from('scan_results')
        .upsert({ url, data: scanData, updated_at: new Date().toISOString() }, { onConflict: 'url' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Creator Projects ──
export async function findCreatorProjects(userId) {
    const { data, error } = await supabaseAdmin
        .from('creator_projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function findCreatorProjectById(projectId) {
    const { data, error } = await supabaseAdmin
        .from('creator_projects')
        .select('*')
        .eq('id', projectId)
        .single();
    if (error) return null;
    return data;
}

export async function createCreatorProject(projData) {
    const { data, error } = await supabaseAdmin
        .from('creator_projects')
        .insert(projData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateCreatorProject(projectId, updates) {
    const { data, error } = await supabaseAdmin
        .from('creator_projects')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', projectId)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteCreatorProject(projectId, userId) {
    const { error } = await supabaseAdmin
        .from('creator_projects')
        .delete()
        .eq('id', projectId)
        .eq('user_id', userId);
    if (error) throw error;
}

// ── Design Preferences ──
export async function findDesignPreferences(userId) {
    const { data, error } = await supabaseAdmin
        .from('design_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error) return null;
    return data;
}

export async function upsertDesignPreferences(userId, prefs) {
    const { data, error } = await supabaseAdmin
        .from('design_preferences')
        .upsert({ user_id: userId, ...prefs, last_updated: new Date().toISOString() }, { onConflict: 'user_id' })
        .select()
        .single();
    if (error) throw error;
    return data;
}

// ── Live Sessions ──
export async function findLiveSession(inviteCode) {
    const { data, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*')
        .eq('invite_code', inviteCode)
        .single();
    if (error) return null;
    return data;
}

export async function createLiveSession(sessionData) {
    const { data, error } = await supabaseAdmin
        .from('live_sessions')
        .insert(sessionData)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function updateLiveSession(inviteCode, updates) {
    const { data, error } = await supabaseAdmin
        .from('live_sessions')
        .update({ ...updates, last_activity: new Date().toISOString() })
        .eq('invite_code', inviteCode)
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function logUserActivity(userId, email, eventType, metadata = {}) {
    const { error } = await supabaseAdmin
        .from('extension_events')
        .insert({
            user_id: userId,
            email: email,
            event_type: eventType,
            metadata: metadata,
        });
    if (error) {
        console.error('[Error] logUserActivity error:', error.message);
    }
}

// Export a namespace for backward compatibility
const UserService = {
    findByUid, findByEmail, createUser, updateUser, upgradePlan,
    resetQuotaIfNeeded, incrementUsage, countProfiles, findProfiles,
    findAllActiveProfiles, getPlanDistribution, getRecentSignups,
    getRecentUsers, bulkResetTrials, getUsersWithAcquisition,
    getExtensionInstalledCount, getExtensionActiveLastWeek, getTopExtensionUsers,
    createExtensionEvent, getExtensionEvents, getRecentExtensionEvents, getExtensionDailyActivity,
    pushNotification, getUserMoodboards, createMoodboard, deleteMoodboard,
    findSharedMoodboard, createSharedMoodboard, findScanResult, upsertScanResult,
    findCreatorProjects, findCreatorProjectById, createCreatorProject, updateCreatorProject, deleteCreatorProject,
    findDesignPreferences, upsertDesignPreferences, findLiveSession, createLiveSession, updateLiveSession,
    logUserActivity,
};

export default UserService;
