import express from 'express';
import OpenAI from 'openai';
import { websiteScanner } from '../scrapers/websiteScanner.js';
import { supabaseAdmin } from '../config/supabaseClient.js';
import UserService from '../services/userService.js';

// Helper: find cached scan result by URL
async function findCachedScan(url) {
    const { data, error } = await supabaseAdmin
        .from('scan_results')
        .select('*')
        .eq('url', url)
        .single();
    if (error) return null;
    return data;
}

// Helper: upsert scan result
async function upsertScan(url, scanData) {
    await supabaseAdmin
        .from('scan_results')
        .upsert({ url, data: scanData, updated_at: new Date().toISOString() }, { onConflict: 'url' });
}

// Helper: update scan data field
async function updateScanData(url, existingData, field, value) {
    const updated = { ...existingData, [field]: value };
    await supabaseAdmin
        .from('scan_results')
        .update({ data: updated, updated_at: new Date().toISOString() })
        .eq('url', url);
}

const router = express.Router();

// Analyze a website URL
router.post('/scan', async (req, res) => {
    let { url, refresh } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    url = url.trim();
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
        }

        // Check if user has reached brand scan limit
        if (!user.hasFeatureAccess('brandScanner')) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'You have reached your limit for Brand Scans on your current plan.',
                limitReached: true,
                quota: user.getUsageStats()
            });
        }

        // 1. Check Cache unless Refresh is forced
        if (!refresh) {
            const cachedResult = await findCachedScan(url);
            if (cachedResult) {
                console.log(`[TITAN] Returning cached result for: ${url}`);
                return res.json({ ...cachedResult.data, isCached: true });
            }
        }

        // 2. Perform Fresh Scan
        const data = await websiteScanner.scan(url);

        // 3. Increment feature usage
        await UserService.incrementUsage(user.uid || user.id, 'brandScanner', user);

        // 4. Update/Save to Cache
        await upsertScan(url, data);

        res.json({ ...data, isCached: false });
    } catch (error) {
        console.error('Scan error:', error);
        res.status(500).json({ error: 'Failed to analyze website. Please check the URL and try again.' });
    }
});
router.post('/competitors', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    url = url.trim();
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });

        // Try to fetch context from the scanned result for better AI understanding
        let scanContext = "NO CONTENT AVAILABLE. Use your best judgement based on the URL name.";
        let hasContent = false;

        const cachedResult = await findCachedScan(url);
        if (cachedResult && cachedResult.data) {
            const { title, description, contentSnippet } = cachedResult.data;
            let combinedText = '';
            if (title) combinedText += `Title: ${title}\n`;
            if (description) combinedText += `Description: ${description}\n`;
            if (contentSnippet && contentSnippet.length > 20) {
                combinedText += `Page Text Elements (THIS IS THE SOURCE OF TRUTH): ${contentSnippet}\n`;
            }

            if (combinedText.length > 10) {
                hasContent = true;
                scanContext = `Here is the ONLY text you are allowed to analyze. It was extracted directly from the website.\n\n${combinedText}`;
            }
        }

        if (!hasContent) {
            return res.status(400).json({ error: 'Missing page content data. Please click the round "Force Clear & Refresh DNA" button next to your URL bar to re-scan the site, so the AI can read the raw text!' });
        }

        // Return cached competitors if they exist
        if (cachedResult && cachedResult.data && cachedResult.data.competitors) {
            console.log(`Retrieved Competitors from MongoDB Cache [Collection: scanresults] for ${url}`);
            return res.json(cachedResult.data.competitors);
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are a world-class startup analyst, venture capitalist, and market researcher. 
Your only purpose is to find the absolute closest, 1-to-1 substitute products and direct competitors for a given company.

CRITICAL RULES FOR IDENTIFYING DIRECT COMPETITORS:
1. DO NOT HALLUCINATE based on the domain name! (example: If you see "sendnow.live" and the text talks about file-sharing and doc tracking, DO NOT list email marketing competitors or mailchimp!). Only list competitors based strictly on the text provided.
2. They MUST serve the EXACT same target audience as described in the text.
3. They MUST solve the EXACT same core problem as described in the text.
4. If the input company ceased to exist tomorrow, these are the apps users would immediately migrate to.
5. Do NOT include generic ecosystem players (e.g. if the input is a specific React framework like Next.js, do NOT list general things like "Google Cloud" or "AWS").
6. Do NOT hallucinate. Include only real, actively functioning companies.

Output ONLY valid JSON containing a 'competitors' array. Each object in the array must have EXACTLY 3 fields:
- 'url': The competitor's official website URL (starting with https://).
- 'logo': Use the format https://www.google.com/s2/favicons?domain=[CLEAN_DOMAIN_ONLY]&sz=128 (e.g., if the URL is https://openai.com, use domain=openai.com).
- 'meta': A sharp, 1-sentence explanation of exactly why they are a 1-to-1 alternative (mentioning the shared core features).`
                },
                {
                    role: "user",
                    content: `Analyze this company and return 10 to 12 of their closest DIRECT competitors.
                    
Company URL: ${url}
${scanContext}

THINK deeply before outputting. Who is their 1-to-1 equivalent? Return the JSON.`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2 // Lowering temperature to make outputs heavily deterministic and accurate
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log(`[Competitor Analysis] Deep research results for ${url}:`, JSON.stringify(result.competitors, null, 2));

        // Cache the competitors using updateOne to guarantee it saves to the Mixed data object
        if (cachedResult) {
            await updateScanData(url, cachedResult.data, 'competitors', result.competitors);
            console.log(`[Success] Successfully saved Competitors to Supabase for ${url}`);
        }

        res.json(result.competitors);
    } catch (error) {
        console.error('Competitor analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze competitors.' });
    }
});

// Reverse Engineer ICP using OpenAI
router.post('/icp', async (req, res) => {
    let { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    url = url.trim();
    if (!url.startsWith('http')) {
        url = `https://${url}`;
    }

    try {
        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });

        if (!user.hasFeatureAccess('brandScanner')) {
            return res.status(403).json({
                error: 'Forbidden',
                upgradeRequired: true,
                message: 'Target Audience generation requires a paid plan. Please upgrade to access this feature.'
            });
        }

        let scanContext = "";
        let hasContent = false;

        const cachedResult = await findCachedScan(url);
        if (cachedResult && cachedResult.data) {
            const { title, description, contentSnippet } = cachedResult.data;
            let combinedText = '';
            if (title) combinedText += `Title: ${title}\n`;
            if (description) combinedText += `Description: ${description}\n`;
            if (contentSnippet && contentSnippet.length > 20) {
                combinedText += `Page Text Elements (THIS IS THE SOURCE OF TRUTH): ${contentSnippet}\n`;
            }

            if (combinedText.length > 10) {
                hasContent = true;
                scanContext = `Here is the ONLY text you are allowed to analyze. It was extracted directly from the website.\n\n${combinedText}`;
            }
        }

        if (!hasContent) {
            return res.status(400).json({ error: 'Missing page content data. Please click the round "Force Clear & Refresh DNA" button next to your URL bar to re-scan the site, so the AI can read the raw text!' });
        }

        console.log(`[DEBUG ICP] checking cache for ${url}. Has data.icp?`, !!(cachedResult && cachedResult.data && cachedResult.data.icp),
            `Array?`, Array.isArray(cachedResult?.data?.icp));

        // Return cached ICP if it exists
        if (cachedResult && cachedResult.data && cachedResult.data.icp) {
            console.log(`Retrieved ICP from MongoDB Cache [Collection: scanresults] for ${url}`);
            return res.json(cachedResult.data.icp);
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert marketing strategist and audience researcher. Your task is to deeply analyze the provided website text and reverse-engineer its EXACT Target Audience and Ideal Customer Profile (ICP).

CRITICAL RULES:
1. DO NOT HALLUCINATE based on the domain name! Rely ONLY on the text provided. Only map out ICPs for the actual product described in the text.
2. Your analysis MUST be entirely dynamic based on the context of the website provided. Do not jump to conclusions or assume it is a B2B SaaS. If it is a B2C e-commerce brand, a local service business, or a creator portfolio, adapt your target segments accordingly.

Output ONLY valid JSON. Do not include markdown formatting or extra text.
The JSON must perfectly match this structure, generating 3 to 4 distinct target segments tailored specifically for this business:
{
  "icp": [
    {
      "industry": "String (Identify the specific industry, market vertical, or broad demographic that this segment belongs to).",
      "roles": ["Array of Strings (Identify the exact job titles, buyer personas, or types of consumers who make the purchasing decision)."],
      "useCase": "String (A detailed explanation of exactly what this specific user segment uses the product/service for and the specific pain point it solves for them)."
    }
  ]
}
Be comprehensive and highly accurate based ONLY on the provided website context.`
                },
                {
                    role: "user",
                    content: `Reverse engineer the Target Audience and ICP for: ${url}\n${scanContext}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log(`[ICP Analysis] Extracted ICP for ${url}:`, JSON.stringify(result.icp, null, 2));

        // Cache the ICP using updateOne
        if (cachedResult) {
            await updateScanData(url, cachedResult.data, 'icp', result.icp);
            console.log(`[Success] Successfully saved ICP to Supabase for ${url}`);
        }

        res.json(result.icp);
    } catch (error) {
        console.error('ICP analysis error:', error);
        res.status(500).json({ error: 'Failed to analyze ICP.' });
    }
});

// Post route to perform Full Growth & CRO Audit
router.post('/audit', async (req, res) => {
    try {
        let { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required.' });

        url = url.trim();
        if (!url.startsWith('http')) {
            url = `https://${url}`;
        }

        const user = req.user;
        if (!user) return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });

        if (!user.hasFeatureAccess('brandScanner')) {
            return res.status(403).json({
                error: 'Forbidden',
                upgradeRequired: true,
                message: 'Growth Ideas & Audits require a paid plan. Please upgrade to access this feature.'
            });
        }

        // Retrieve scan context
        const cachedResult = await findCachedScan(url);

        let scanContext = "";
        let hasContent = false;

        if (cachedResult && cachedResult.data) {
            const { title, description, contentSnippet } = cachedResult.data;
            let combinedText = '';
            if (title) combinedText += `Title: ${title}\n`;
            if (description) combinedText += `Description: ${description}\n`;
            if (contentSnippet && contentSnippet.length > 20) {
                combinedText += `Page Text Elements (THIS IS THE SOURCE OF TRUTH): ${contentSnippet}\n`;
            }

            if (combinedText.length > 10) {
                hasContent = true;
                scanContext = `Here is the ONLY text you are allowed to analyze. It was extracted directly from the website.\n\n${combinedText}`;
            }
        }

        if (!hasContent) {
            return res.status(400).json({ error: 'Missing page content data. Please click the round "Force Clear & Refresh DNA" button next to your URL bar to re-scan the site, so the AI can read the raw text!' });
        }

        // Return cached audit/growth ideas if they exist
        if (cachedResult && cachedResult.data && cachedResult.data.audit) {
            console.log(`Retrieved Growth Ideas from MongoDB Cache [Collection: scanresults] for ${url}`);
            return res.json(cachedResult.data.audit);
        }

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an elite Growth Hacker and SEO expert. 
Your task is to analyze ONLY the provided landing page content and generate highly actionable, product-led growth features and SEO blog ideas.

CRITICAL RULES:
1. DO NOT HALLUCINATE based on the domain name. If the website is a file-sharing tool, DO NOT call it an email marketing tool. Rely ONLY on the exact text provided in the prompt.
2. Generate "Engineering as Marketing" ideas. These are free, mini interactive tools or calculators the company could build on their website to capture leads. The tools MUST be highly relevant to their actual core product. Explain exactly how the tool helps them rank fast on Google Search.
3. Generate highly targeted "SEO Content Keywords" for blog topics based strictly on the product's actual use-case. Focus on high-intent variations.

Output ONLY valid JSON perfectly matching this schema:
{
  "tools": [
    {
      "name": "String (Name of the free tool)",
      "description": "String (Exactly how this tool works to capture leads for this specific product)",
      "seoBenefit": "String (Explain how offering this exact free tool will help them index fast and rank on Google Search for specific high-volume queries)"
    }
  ],
  "keywords": [
    {
      "keyword": "String (The exact search phrase or blog topic)",
      "reason": "String (Why writing a dedicated blog on this drives high-intent buyers)"
    }
  ]
}
Generate exactly 6 tools and 10 keywords.`
                },
                {
                    role: "user",
                    content: `Diagnose the landing page and generate growth ideas: ${url}\n${scanContext}`
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3
        });

        const result = JSON.parse(completion.choices[0].message.content);
        console.log(`[Full Audit] Generated for ${url}`);

        // Cache the audit/growth ideas using updateOne
        if (cachedResult) {
            await updateScanData(url, cachedResult.data, 'audit', result);
            console.log(`[Success] Successfully saved Growth Ideas to Supabase for ${url}`);
        }

        res.json(result);
    } catch (error) {
        console.error('Audit error:', error);
        res.status(500).json({ error: 'Failed to perform audit.' });
    }
});

export default router;
