/**
 * contentModerationService.js
 *
 * Provides fast blocklist-based keyword screening for Agentic UI prompts.
 * Helps prevent sexually explicit, nude, harmful, or illegal prompt requests.
 */

// Curated blocklist of terms related to adult content, nudity, extreme violence, and illegal activities.
const BLOCKED_KEYWORDS = [
  // Sexually Explicit & Adult Content
  'nude', 'naked', 'nudity', 'nsfw', 'porn', 'pornography', 'xxx', 'sexy', 'erotic', 'erotica',
  'sensual', 'escort', 'sex', 'sexual', 'intercourse', 'arousal', 'stripclub', 'stripper',
  'playboy', 'hentai', 'milf', 'blowjob', 'pussy', 'penis', 'cock', 'dick', 'boobs', 'breast',
  'tits', 'butt', 'asshole', 'vagina', 'fetish', 'bdsm', 'kinky', 'masturbate', 'masturbation',
  
  // Illegal Activities & Harmful Tech
  'darkweb', 'hack', 'hacking', 'hacker', 'exploit', 'exploits', 'cyberattack', 'malware', 'ransomware',
  'phishing', 'scam', 'scams', 'scamming', 'cloned bank', 'drugs dealer', 'weed shop illegal', 'cocaine',
  'methamphetamine', 'illegal firearms', 'weapons black market'
];

/**
 * Checks a user prompt against safety guidelines.
 * Returns an object: { isSafe: boolean, triggerTerm: string | null }
 */
export function checkPromptSafety(prompt) {
  if (!prompt || typeof prompt !== 'string') {
    return { isSafe: true, triggerTerm: null };
  }

  const normalized = prompt.toLowerCase().trim();

  // 1. Exact or partial keyword checks
  for (const keyword of BLOCKED_KEYWORDS) {
    // Word boundary check to prevent false positives (e.g., "asset" containing "ass")
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(normalized)) {
      return {
        isSafe: false,
        triggerTerm: keyword
      };
    }
  }

  return { isSafe: true, triggerTerm: null };
}
