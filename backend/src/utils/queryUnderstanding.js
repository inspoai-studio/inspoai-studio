/**
 * queryUnderstanding.js
 * Uses GPT-4o-mini to parse user queries into rich structured intent
 * for high-precision vector search.
 */

import OpenAI from 'openai';

// Lazy initialize — env vars are guaranteed to be set when the server loads
let _openai = null;
const getOpenAI = () => {
    if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openai;
};

// In-memory cache: query → parsed intent (1 hour TTL)
const _cache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

const SYSTEM_PROMPT = `You are an expert UI/UX design search assistant. 
Given a user's search query, extract structured intent for searching a database of 91,000+ real app UI screenshots.
Return ONLY valid JSON — no markdown, no explanation.

The database has these fields:
- title, site_name, source, platform (web|ios)
- tags[] — app/industry keywords
- ux_patterns[] — "Shopping", "Dark Mode", "Booking", "Map", "Reviews & Rating", "Filter & Sorting", "Empty State", "Onboarding", "Calendar", "Stats", "Video Player", etc.
- ui_elements[] — "Button", "Cards & Tiles", "List", "Tabs", "Text Field", "Dropdown", "Accordion & Collapse", "Switch & Toggle", "Progress Bar", etc.
- page_types[] — "Log In", "Sign Up", "Profile & Account", "Settings", "Product Details", "Reset Password", "Verification", etc.

Extract:
{
  "enhanced_query": "enriched search phrase combining all concepts for semantic embedding",
  "industry": "the app category/industry (e.g. food & restaurant, fintech, travel, social, fitness)",
  "platforms": ["web"] or ["ios"] or ["web","ios"] — based on query,
  "ux_patterns": [] — up to 3 matching ux_patterns from the list above,
  "ui_elements": [] — up to 3 matching ui_elements,
  "page_types": [] — up to 2 matching page_types,
  "confidence": 0.0-1.0 — how confident you are in the UI intent
}

Examples:
- "restaurant UI web app" → enhanced_query: "food restaurant ordering delivery web app UI screens design"
- "bank login screen dark mode" → enhanced_query: "fintech banking login authentication dark theme mobile screen"
- "fitness tracking ios" → enhanced_query: "fitness health workout tracking ios mobile app UI screenshots"`;

/**
 * Parse a user query into structured UI search intent using GPT-4o-mini
 */
export async function understandUIQuery(query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return defaultIntent(query);

    // Cache check
    const cached = _cache.get(q);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
        console.log(`Query understanding cache hit: "${q}"`);
        return cached.data;
    }

    try {
        const response = await getOpenAI().chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Parse this search query: "${query}"` }
            ],
            temperature: 0.1,
            max_tokens: 300,
            response_format: { type: 'json_object' },
        });

        const parsed = JSON.parse(response.choices[0].message.content);

        const result = {
            enhanced_query: parsed.enhanced_query || query,
            industry: parsed.industry || '',
            platforms: parsed.platforms || [],
            ux_patterns: parsed.ux_patterns || [],
            ui_elements: parsed.ui_elements || [],
            page_types: parsed.page_types || [],
            confidence: parsed.confidence || 0.7,
            original_query: query,
        };

        console.log(`Query understood: "${query}" → "${result.enhanced_query}" [${result.industry}]`);

        _cache.set(q, { ts: Date.now(), data: result });
        if (_cache.size > 200) _cache.delete(_cache.keys().next().value);

        return result;
    } catch (err) {
        console.error('[Warning] Query understanding failed:', err.message);
        return defaultIntent(query);
    }
}

/**
 * Embed text using OpenAI text-embedding-3-small
 */
export async function embedText(text) {
    const res = await getOpenAI().embeddings.create({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000),
    });
    return res.data[0].embedding;
}

function defaultIntent(query) {
    return {
        enhanced_query: `${query} UI design app screen`,
        industry: '',
        platforms: [],
        ux_patterns: [],
        ui_elements: [],
        page_types: [],
        confidence: 0.5,
        original_query: query,
    };
}
