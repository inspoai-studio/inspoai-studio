// Credit limits configuration for each plan tier
// Each key maps to a user role, values define feature caps

const CREDIT_LIMITS = {
    // ── Trial (7-day free trial = same limits as Lite) ──
    trial: {
        credits: 25,
        searches: 25,           // 25 searches / day
        moodboards: 3,
        maxImagesPerMoodboard: 50,
        shareLinks: 3,
        liveCollab: true,
        designAudits: 5,
        brandScanner: 5,
        creatorStudio: true,
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: true,
        agenticGenerations: 5,  // 5 lifetime trial generations (never resets)
        price: 0
    },

    // ── Lite ($12/m) ──
    lite: {
        credits: 25,
        searches: 25,           // 25 searches / day
        moodboards: 3,
        maxImagesPerMoodboard: 50,
        shareLinks: 3,
        liveCollab: true,
        designAudits: 5,
        brandScanner: 5,
        creatorStudio: true,
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: true,
        agenticGenerations: 30,  // 30 generations / month
        price: 12
    },

    // ── Freelancer ($22/m) ──
    freelancer: {
        credits: 100,
        searches: 100,          // 100 searches / day
        moodboards: 30,
        maxImagesPerMoodboard: 100,
        shareLinks: 30,
        liveCollab: true,
        designAudits: 30,
        brandScanner: 30,
        creatorStudio: true,
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: true,
        agenticGenerations: 60,  // 60 generations / month
        price: 22
    },

    // ── Team (Pro) ($39/m) ──
    team: {
        credits: 300,
        searches: 300,          // 300 searches / day
        moodboards: Infinity,
        maxImagesPerMoodboard: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: 1000,
        brandScanner: 1000,
        creatorStudio: true,
        maxTeamMembers: 2,      // 1 Owner + 2 Members
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: true,
        agenticGenerations: 100,  // 100 generations / month
        price: 39
    },

    // ── Lifetime ($199 one-time) ──
    lifetime: {
        credits: Infinity,
        searches: Infinity,
        moodboards: Infinity,
        maxImagesPerMoodboard: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: 500,
        brandScanner: 500,
        creatorStudio: true,
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: false,
        agenticGenerations: 500,
        price: 199
    },

    // ── Admin (internal) ──
    admin: {
        credits: Infinity,
        searches: Infinity,
        moodboards: Infinity,
        maxImagesPerMoodboard: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: Infinity,
        brandScanner: Infinity,
        creatorStudio: true,
        creatorStudioCreditCost: 0,
        historySaved: Infinity,
        moodboardViews: Infinity,
        chromeExtension: true,
        curatedIndex: true,
        premiumScreens: true,
        creditsExpire: false,
        agenticGenerations: Infinity,
        price: 0
    },

    // ══════════ API Plans (unchanged) ══════════

    api_free: {
        credits: 10,
        searches: 10,
        moodboards: 1,
        maxImagesPerMoodboard: 20,
        shareLinks: 0,
        liveCollab: true,
        designAudits: 1,
        brandScanner: 1,
        creatorStudio: false,
        historySaved: 5,
        creditsExpire: true,
        price: 0
    },
    api_growth: {
        credits: 5000,
        searches: 5000,
        moodboards: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: Infinity,
        brandScanner: Infinity,
        creatorStudio: true,
        creatorStudioCreditCost: 1,
        creatorStudioBonusCredits: 0,
        historySaved: Infinity,
        creditsExpire: true,
        price: 49
    },
    api_scale: {
        credits: 50000,
        searches: 50000,
        moodboards: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: Infinity,
        brandScanner: Infinity,
        creatorStudio: true,
        creatorStudioCreditCost: 1,
        creatorStudioBonusCredits: 0,
        historySaved: Infinity,
        creditsExpire: true,
        price: 199
    },
    api_lifetime: {
        credits: 1000000,
        searches: 1000000,
        moodboards: Infinity,
        shareLinks: Infinity,
        liveCollab: true,
        designAudits: Infinity,
        brandScanner: Infinity,
        creatorStudio: true,
        creatorStudioCreditCost: 1,
        creatorStudioBonusCredits: 0,
        historySaved: Infinity,
        creditsExpire: false,
        price: 499
    }
};

// ── Backward-compatible aliases for existing users with old role names ──
// Old DB records may still have these — map them to the new tiers
CREDIT_LIMITS.free = CREDIT_LIMITS.trial;         // old free → trial
CREDIT_LIMITS.solo = CREDIT_LIMITS.freelancer;     // old solo → freelancer
CREDIT_LIMITS.solo_annual = { ...CREDIT_LIMITS.freelancer, price: 220, agenticGenerations: 50 };
CREDIT_LIMITS.lite_annual = { ...CREDIT_LIMITS.lite, price: 120, agenticGenerations: 25 };       // $10/mo × 12
CREDIT_LIMITS.freelancer_annual = { ...CREDIT_LIMITS.freelancer, price: 220, agenticGenerations: 50 }; // $18.33/mo × 12
CREDIT_LIMITS.team_annual = { ...CREDIT_LIMITS.team, price: 390, agenticGenerations: 90 };      // $32.50/mo × 12
CREDIT_LIMITS.growth = CREDIT_LIMITS.api_growth;   // old growth → api_growth
CREDIT_LIMITS.scale = CREDIT_LIMITS.api_scale;     // old scale → api_scale
CREDIT_LIMITS.enterprise = CREDIT_LIMITS.api_lifetime;

// Feature keys used for access checks
const FEATURES = {
    SEARCH: 'searches',
    MOODBOARD: 'moodboards',
    SHARE_LINK: 'shareLinks',
    LIVE_COLLAB: 'liveCollab',
    DESIGN_AUDIT: 'designAudits',
    BRAND_SCANNER: 'brandScanner',
    CREATOR_STUDIO: 'creatorStudio',
    HISTORY: 'historySaved'
};

export { CREDIT_LIMITS, FEATURES };
export default CREDIT_LIMITS;
