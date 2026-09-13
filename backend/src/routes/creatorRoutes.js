import { GoogleGenerativeAI } from '@google/generative-ai';
import { spawn } from 'child_process';
import path from 'path';
import { validateSafeUrl } from '../utils/ssrfGuard.js';

const setupCreatorRoutes = (app, context) => {
    const { authenticateUser } = context;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const proModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // Helper: Call Gemini Pro
    const callGeminiPro = async (prompt, systemInstruction) => {
        try {
            const model = genAI.getGenerativeModel({
                model: "gemini-1.5-pro", // Stable and powerful
                systemInstruction: systemInstruction
            });

            const result = await model.generateContent(prompt);
            const text = result.response.text();

            try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                return jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: text };
            } catch (e) {
                console.error("[Error] Failed to parse Gemini JSON:", e);
                console.log("Raw Response:", text);
                return { raw: text };
            }
        } catch (error) {
            console.error("[Error] Gemini API Call Failed:", error);
            throw error;
        }
    };

    app.post('/api/creator/generate-code', authenticateUser, async (req, res) => {
        const { prompt, sectionType, designPreferences, previousCode, styleProfile } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }

        // --- CREDIT ENFORCEMENT ---
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (!user.hasFeatureAccess('creatorStudio')) {
            return res.status(403).json({ error: 'Creator Studio is only available on Pro and Lifetime plans. Please upgrade.' });
        }

        const planLimits = user.getPlanLimits();
        const cost = planLimits.creatorStudioCreditCost || 1;

        if (!user.hasCredits(cost)) {
            return res.status(402).json({ error: 'Insufficient credits. Please upgrade or top up.' });
        }
        // Deduct credits upfront via UserService
        const credits = { ...(user.credits || {}) };
        credits.used = (credits.used || 0) + cost;
        const usage = { ...(user.usage || {}) };
        usage.creatorStudio = (usage.creatorStudio || 0) + 1;
        const UserService = (await import('../services/userService.js')).default;
        await UserService.updateUser(user.id, { credits, usage });
        // --------------------------

        console.log(`Generating ELITE ${sectionType || 'design'} via Gemini 2.0 Pro: "${prompt}"`);

        try {
            const eliteSystemPrompt = `You are a world-class Lead UI/UX Engineer and Design Architect.
Your goal is to produce "International Level" React/HTML/CSS code that matches the aesthetics of Stripe, Apple, Linear, and Vercel.

DESIGN MASTERCLASS PRINCIPLES (MANDATORY):
1. SPACING: Use an 8px grid system. Use generous padding (e.g., 80px-120px for sections). Never crowd content.
2. TYPOGRAPHY: Editorial level hierarchy. Use modern sans-serifs (Inter, Geist, SF Pro). Bold, tight headings with letter-spacing -0.02em. Readable body text (line-height 1.6).
3. COLOR & HARMONY: Sophisticated palettes. Use neutrals with a single high-quality accent. Proper contrast (WCAG AA+).
4. MODERN EFFECTS:
   - Subtle glassmorphism (backdrop-filter: blur).
   - Mesh gradients or very subtle linear gradients.
   - High-precision shadows (layered box-shadows for realism).
   - "Stripe-style" animated gradients or "Linear-style" borders where appropriate.
5. RESPONSIVENESS: Fluid layouts using clamp() for font sizes and aspect-ratio for containers.
6. MICRO-INTERACTIONS: Fluid CSS transitions (cubic-bezier(0.4, 0, 0.2, 1)).

${styleProfile ? `CONTEXTUAL STYLE (ADHERE STRICTLY):
- Analysis: ${styleProfile.style}
- Vibe: ${styleProfile.vibe}
- Key Palette: ${styleProfile.colorPalette?.join(', ')}
- Typography Logic: ${JSON.stringify(styleProfile.typography)}
- Structural Preference: ${styleProfile.layout?.structure}
` : ''}

TYPE-SPECIFIC REQUIREMENTS:
- Section: Focus on a single, impactful component (Hero, Features, etc.)
- Full Screen/Landing Page: Create a cohesive STORY. Multiple sections (Nav -> Hero -> Value Prop -> Social Proof -> Footer). Use consistent variables throughout.

Generate production-ready code. No external libraries unless they are absolute standard (like Lucide icons).
Use modern, semantic HTML5 and sophisticated Vanilla CSS.

RETURN ONLY JSON:
{
  "html": "full HTML markup with semantic tags",
  "css": "sophisticated CSS with variables, grid/flex, animations",
  "reactComponent": "Equivalent React (JSX/Lucide) implementation",
  "description": "Short elite design description",
  "designNotes": "Explanation of the 'International Quality' decisions",
  "colorPalette": ["#hex", "#hex", "#hex"],
  "improvements": ["suggestion for next iteration"]
}`;

            const fullPrompt = `Request: ${prompt}
Section Type: ${sectionType || 'website section'}
${designPreferences ? `Preferences: ${JSON.stringify(designPreferences)}` : ''}
${previousCode ? `Refine this existing code: ${previousCode}` : ''}
${styleProfile ? `Style Profile: ${JSON.stringify(styleProfile)}` : ''}`;

            const codeData = await callGeminiPro(fullPrompt, eliteSystemPrompt);

            res.json({
                success: true,
                code: codeData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Gemini Pro generation error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // MOODBOARD STYLE ANALYZER (Multi-Image Vision)
    // ============================================
    app.post('/api/creator/analyze-moodboard', authenticateUser, async (req, res) => {
        try {
            const { images } = req.body;

            if (!images || !Array.isArray(images) || images.length === 0) {
                return res.status(400).json({ error: 'At least one image is required for analysis' });
            }

            console.log(`Analyzing moodboard style from ${images.length} images`);

            // Process up to 5 images for the best balance of context and performance
            const imagesToAnalyze = images.slice(0, 5);

            const visionParts = [];
            for (const imageUrl of imagesToAnalyze) {
                const urlToUse = typeof imageUrl === 'string' ? imageUrl : (imageUrl?.url || imageUrl?.image);
                if (!urlToUse || typeof urlToUse !== 'string') continue;

                if (urlToUse.startsWith('data:image/')) {
                    const parts = urlToUse.split(',');
                    if (parts.length === 2) {
                        const mimeMatch = parts[0].match(/:(.*?);/);
                        visionParts.push({
                            inlineData: {
                                data: parts[1],
                                mimeType: mimeMatch ? mimeMatch[1] : 'image/jpeg'
                            }
                        });
                        continue;
                    }
                }

                const urlValidation = await validateSafeUrl(urlToUse);
                if (!urlValidation.isSafe) {
                    return res.status(400).json({ error: `Disallowed image URL: ${urlValidation.error}` });
                }

                const imageResponse = await fetch(urlToUse);
                if (!imageResponse.ok) {
                    continue;
                }
                const imageBuffer = await imageResponse.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
                visionParts.push({
                    inlineData: {
                        data: base64Image,
                        mimeType: contentType.split(';')[0]
                    }
                });
            }

            if (visionParts.length === 0) {
                return res.status(400).json({ error: 'No valid, accessible images provided for analysis' });
            }

            const visionPrompt = `Analyze these ${imagesToAnalyze.length} design images collectively to extract a unified "Design Language" or "Style Profile".
Identify common themes across all images to create a cohesive style guide.

Look for:
1. Aggregate Color Palette (most dominant/consistent hex codes)
2. Typography Characteristics (consistent font pairings, weights, and styles)
3. Common Design Patterns (card styles, border radii, shadow depths)
4. Layout Logic (how content is typically structured across these examples)
5. Overall Aesthetic "Vibe" (e.g., "Minimalist Tech", "Organic Brutalism", "Luxurious Editorial")

Return as structured JSON:
{
  "style": "Overall aesthetic description (e.g., Apple-inspired minimalism)",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4", "#hex5"],
  "typography": { 
    "headings": "description of heading style (font weight, size, spacing)", 
    "body": "description of body style" 
  },
  "layout": { "structure": "description of the structural patterns observed" },
  "components": ["key design elements like 'heavy blurs', 'thin borders', 'high density'"],
  "vibe": "a 3-word summary of the aesthetic",
  "designPhilosophy": "A short summary of the design approach to follow"
}`;

            const visionModel = genAI.getGenerativeModel({
                model: "gemini-2.0-flash"
            });

            const result = await visionModel.generateContent([
                visionPrompt,
                ...visionParts
            ]);

            const analysisText = result.response.text();
            let styleProfile;

            try {
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                styleProfile = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: analysisText };
            } catch {
                styleProfile = { raw: analysisText };
            }

            res.json({
                success: true,
                styleProfile: styleProfile,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Moodboard analysis error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // INTELLIGENT IMAGE SELECTION WITH VISION AI
    // ============================================
    app.post('/api/creator/smart-image-search', authenticateUser, async (req, res) => {
        try {
            const { prompt, sectionContext, colorScheme, mood, limit = 8 } = req.body;

            if (!prompt) {
                return res.status(400).json({ error: 'Prompt is required' });
            }

            console.log(`Smart image search for: "${prompt}"`);

            // First, use AI to generate optimized search queries
            const searchOptimizationPrompt = `As an expert in visual design and search optimization, generate 3 highly specific search queries to find the perfect images for this context:

Section: ${prompt}
Context: ${sectionContext || 'modern website section'}
Color Scheme: ${colorScheme || 'any'}
Mood: ${mood || 'professional'}

Return ONLY a JSON array of search queries, most specific first:
["query1", "query2", "query3"]`;

            let searchQueries;

            try {
                const queries = await callOpenAI([
                    { role: "user", content: searchOptimizationPrompt }
                ], 'gpt-4o', true);

                searchQueries = Array.isArray(queries) ? queries : [prompt];
            } catch (err) {
                console.error("OpenAI Search Optimization Failed, falling back to prompt:", err);
                searchQueries = [prompt];
            }

            // Search Freepik with optimized queries
            const imagePromises = searchQueries.map(async (query) => {
                try {
                    const response = await fetch(`https://api.freepik.com/v1/resources?locale=en-US&page=1&limit=${Math.ceil(limit / searchQueries.length)}&order=relevance&term=${encodeURIComponent(query)}`, {
                        headers: {
                            'Accept-Language': 'en-US',
                            'Accept': 'application/json',
                            'X-Freepik-API-Key': process.env.FREEPIK_API_KEY
                        }
                    });

                    if (!response.ok) return [];

                    const data = await response.json();
                    return data.data.map(item => ({
                        id: item.id,
                        title: item.title,
                        url: item.image.source.url,
                        thumbnail: item.thumbnails?.[0]?.url || item.image.source.url,
                        preview: item.image.source.url,
                        author: item.author?.name || 'Freepik',
                        source: 'Freepik',
                        searchQuery: query,
                        relevanceScore: Math.random() * 0.3 + 0.7 // Placeholder for actual ML scoring
                    }));
                } catch (err) {
                    console.error(`Search failed for "${query}":`, err.message);
                    return [];
                }
            });

            const imageResults = await Promise.all(imagePromises);
            const allImages = imageResults.flat();

            // Score and rank images (in production, use a vision model)
            const rankedImages = allImages
                .sort((a, b) => b.relevanceScore - a.relevanceScore)
                .slice(0, limit);

            res.json({
                success: true,
                images: rankedImages,
                searchQueries: searchQueries,
                count: rankedImages.length
            });

        } catch (error) {
            console.error('Smart image search error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // DESIGN PATTERN ANALYZER
    // ============================================
    app.post('/api/creator/analyze-design', authenticateUser, async (req, res) => {
        try {
            const { imageUrl, analysisType } = req.body;

            if (!imageUrl) {
                return res.status(400).json({ error: 'Image URL is required' });
            }

            console.log(`Analyzing design pattern from: ${imageUrl}`);

            // Download and analyze image with Gemini Vision
            const imageResponse = await fetch(imageUrl);
            const imageBuffer = await imageResponse.arrayBuffer();
            const base64Image = Buffer.from(imageBuffer).toString('base64');

            const visionPrompt = `Analyze this design image and extract:
1. Color palette (hex codes)
2. Typography characteristics (font families, sizes, weights)
3. Layout structure (grid, flex, positioning)
4. Design patterns used (cards, hero sections, etc.)
5. Spacing and rhythm
6. Visual hierarchy
7. Key UI components
8. Design style (minimalist, bold, corporate, etc.)

Return as structured JSON:
{
  "colorPalette": ["#hex1", "#hex2", ...],
  "typography": { "headings": "description", "body": "description" },
  "layout": { "type": "grid/flex", "columns": number, "structure": "description" },
  "patterns": ["pattern1", "pattern2"],
  "spacing": "description",
  "hierarchy": "description",
  "components": ["component1", "component2"],
  "style": "style description",
  "codeTemplate": "approximate HTML/CSS structure"
}`;

            const visionModel = genAI.getGenerativeModel({
                model: "gemini-2.5-flash-lite"
            });

            const result = await visionModel.generateContent([
                visionPrompt,
                {
                    inlineData: {
                        data: base64Image,
                        mimeType: 'image/jpeg'
                    }
                }
            ]);

            const analysisText = result.response.text();
            let analysisData;

            try {
                const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
                analysisData = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: analysisText };
            } catch {
                analysisData = { raw: analysisText };
            }

            res.json({
                success: true,
                analysis: analysisData,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Design analysis error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // FREEPIK SEARCH (Enhanced)
    // ============================================
    app.post('/api/creator/freepik-search', authenticateUser, async (req, res) => {
        try {
            const { prompt, limit = 10, filters } = req.body;

            if (!prompt) {
                return res.status(400).json({ error: 'Prompt is required' });
            }

            console.log(`Creator Studio: Searching Freepik for "${prompt}"`);

            const response = await fetch(`https://api.freepik.com/v1/resources?locale=en-US&page=1&limit=${limit}&order=relevance&term=${encodeURIComponent(prompt)}&filters[content_type][vector]=1&filters[content_type][photo]=1&filters[content_type][psd]=1`, {
                headers: {
                    'Accept-Language': 'en-US',
                    'Accept': 'application/json',
                    'X-Freepik-API-Key': process.env.FREEPIK_API_KEY
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Freepik API Error: ${response.status} ${errorText}`);
            }

            const data = await response.json();

            const images = data.data.map(item => ({
                id: item.id,
                title: item.title,
                url: item.image.source.url,
                thumbnail: item.image.source.url,
                preview: item.image.source.url,
                author: item.author.name,
                source: 'Freepik'
            }));

            res.json({ success: true, images });

        } catch (error) {
            console.error('Creator Studio Freepik Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // AI DESIGN ASSISTANT CHAT (Enhanced)
    // ============================================
    app.post('/api/creator/chat', authenticateUser, async (req, res) => {
        try {
            const { message, history, currentProject } = req.body;

            const systemPrompt = `You are the InspoAI Design Assistant for the Creator Studio - an advanced AI specialized in website design and development.

Your role is to help users design and build websites section by section with expert guidance.

CAPABILITIES:
[Success] UI/UX design patterns and best practices
[Success] Color theory and palette generation
[Success] Typography and font pairing
[Success] Layout structures (Grid, Flexbox, modern CSS)
[Success] Visual hierarchy and composition
[Success] Design trends and inspiration
[Success] Responsive design principles
[Success] Accessibility (WCAG) guidelines
[Success] Component architecture
[Success] HTML/CSS/React code suggestions

RESTRICTIONS:
[Error] Do NOT discuss backend development, databases, or server-side logic
[Error] Do NOT provide solutions for non-design topics
[Error] Keep focus strictly on visual design and frontend UI/UX

${currentProject ? `CURRENT PROJECT CONTEXT:
Type: ${currentProject.type || 'website'}
Style: ${currentProject.style || 'modern'}
Sections: ${currentProject.sections?.length || 0} created
` : ''}

COMMUNICATION STYLE:
- Be concise but thorough
- Provide actionable suggestions
- Include relevant design principles
- Suggest specific color codes, spacing values when relevant
- End with a "Next Step" or "Try this" suggestion
- Use markdown formatting for clarity

When users ask for a section, describe:
1. Visual structure and layout
2. Key components needed
3. Recommended color/typography approach
4. A suggested prompt for code generation`;

            // Convert history to OpenAI format
            const messages = [
                { role: "system", content: systemPrompt },
                ...(history || []).map(msg => ({
                    role: msg.role === 'model' ? 'assistant' : 'user', // Map 'model' to 'assistant'
                    content: msg.message || msg.parts?.[0]?.text || ""
                })),
                { role: "user", content: message }
            ];

            const responseText = await callOpenAI(messages, 'gpt-4o');
            res.json({ reply: responseText });

        } catch (error) {
            console.error('Creator Studio Chat Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // DESIGN SYSTEM GENERATOR
    // ============================================
    app.post('/api/creator/generate-design-system', authenticateUser, async (req, res) => {
        try {
            const { brandDescription, industry, mood } = req.body;

            console.log(`Generating design system for: ${brandDescription}`);

            const designSystemPrompt = `As an expert brand designer, create a comprehensive design system for:

Brand: ${brandDescription}
Industry: ${industry || 'general'}
Mood: ${mood || 'professional'}

Generate a complete design system with:
1. Color Palette (primary, secondary, accent, neutrals with hex codes)
2. Typography Scale (font families, sizes, weights, line heights)
3. Spacing System (base unit and scale)
4. Component Styles (buttons, cards, inputs, etc.)
5. Shadow System
6. Border Radius Scale

Return as JSON:
{
  "colors": {
    "primary": { "main": "#hex", "light": "#hex", "dark": "#hex" },
    "secondary": { "main": "#hex", "light": "#hex", "dark": "#hex" },
    "accent": "#hex",
    "neutrals": { "white": "#fff", "gray": ["#hex1", "#hex2"], "black": "#000" }
  },
  "typography": {
    "fontFamily": { "heading": "font", "body": "font" },
    "scale": { "h1": "size", "h2": "size", "body": "size" }
  },
  "spacing": { "base": "8px", "scale": [0, 4, 8, 16, 24, 32, 48, 64] },
  "shadows": ["shadow1", "shadow2"],
  "borderRadius": { "sm": "4px", "md": "8px", "lg": "16px" }
}`;

            const designSystem = await callOpenAI([
                { role: "user", content: designSystemPrompt }
            ], 'gpt-4o', true);

            res.json({ success: true, designSystem });

        } catch (error) {
            console.error('Design system generation error:', error);
            res.status(500).json({ error: error.message });
        }
    });
};

export default setupCreatorRoutes;
