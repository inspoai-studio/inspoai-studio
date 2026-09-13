import { supabase } from '../config/supabaseClient.js';
import axios from 'axios';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

let openai = null;
try {
    if (process.env.OPENAI_API_KEY) {
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    } else {
        console.warn('[Warning] WARNING: OPENAI_API_KEY not set in logoService. OpenAI features will be disabled.');
    }
} catch (e) {
    console.error('[Error] Failed to initialize OpenAI client in logoService:', e.message);
}
const SERPAPI_KEY = process.env.SERPAPI_KEY;
const BRANDFETCH_KEY = process.env.BRANDFETCH_API_KEY;

class LogoService {
    /**
     * Helper to get cached data from Supabase
     */
    async getCachedSearch(query, type) {
        if (!supabase) return null;
        try {
            const { data, error } = await supabase
                .from('logo_searches')
                .select('*')
                .eq('query', query.toLowerCase().trim())
                .eq('type', type)
                .single();

            if (error) return null;
            return data;
        } catch (e) {
            return null;
        }
    }

    /**
     * Helper to cache data to Supabase
     */
    async cacheSearch(query, type, payload) {
        if (!supabase) return;
        try {
            await supabase
                .from('logo_searches')
                .upsert({
                    query: query.toLowerCase().trim(),
                    type,
                    payload,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'query' });
        } catch (e) {
            console.error('Failed to cache logo search in Supabase:', e.message);
        }
    }

    /**
     * Searches for a brand's logo (SVG & PNG) and its history.
     * @param {string} query e.g. "Nike logo"
     */
    async searchBrandLogo(query) {
        // 1. Check cache
        const cached = await this.getCachedSearch(query, 'brand');
        if (cached) return cached.payload;

        if (!openai) {
            throw new Error('OpenAI API key is missing. Logo search feature is disabled.');
        }

        try {
            // 2. Ask OpenAI for domain and history
            const prompt = `
            The user is searching for the logo and history of a brand based on this query: "${query}".
            Provide a JSON response with the following keys:
            - "brandName": The proper name of the brand.
            - "domain": The primary website domain of the brand (e.g., "nike.com"). Just the domain, no https:// or www.
            - "history": A concise, engaging 2-paragraph history of the brand and its logo evolution.

            Must be valid JSON.
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "You are a helpful brand historian assistant." },
                    { role: "user", content: prompt }
                ]
            });

            const brandInfo = JSON.parse(completion.choices[0].message.content);

            // 3. Fetch Logo via Brandfetch API
            let svgUrl = null;
            let pngUrl = null;

            if (BRANDFETCH_KEY && brandInfo.domain) {
                try {
                    const bfResponse = await axios.get(`https://api.brandfetch.io/v2/brands/${brandInfo.domain}`, {
                        headers: {
                            Authorization: `Bearer ${BRANDFETCH_KEY}`
                        }
                    });

                    // Parse Brandfetch response for logos
                    const logos = bfResponse.data.logos || [];

                    // Prioritize logo types: primary > symbol
                    const bestLogo = logos.find(l => l.type === 'logo') || logos.find(l => l.type === 'symbol') || logos[0];

                    if (bestLogo && bestLogo.formats) {
                        const svgFormat = bestLogo.formats.find(f => f.format === 'svg');
                        const pngFormat = bestLogo.formats.find(f => f.format === 'png');

                        svgUrl = svgFormat ? svgFormat.src : null;
                        pngUrl = pngFormat ? pngFormat.src : null;
                    }

                } catch (bfError) {
                    console.error('Brandfetch API Error:', bfError.response ? bfError.response.data : bfError.message);
                }
            }

            // Fallback to Clearbit if Brandfetch missed PNG
            if (!pngUrl && brandInfo.domain) {
                pngUrl = `https://logo.clearbit.com/${brandInfo.domain}?size=800`;
            }

            const payload = {
                brandName: brandInfo.brandName,
                brandfetchData: true,
                domain: brandInfo.domain,
                history: brandInfo.history,
                logos: {
                    svg: svgUrl,
                    png: pngUrl
                }
            };

            // 5. Cache and return
            await this.cacheSearch(query, 'brand', payload);
            return payload;

        } catch (error) {
            console.error('Error fetching brand logo:', error);
            throw new Error('Failed to fetch brand logo data');
        }
    }

    /**
     * Searches for logo design trends (e.g., "2026 logo trends").
     * @param {string} query 
     */
    async searchLogoTrends(query) {
        // 1. Check cache
        const cached = await this.getCachedSearch(query, 'trend');
        if (cached) return cached.payload;

        if (!openai) {
            throw new Error('OpenAI API key is missing. Logo trends feature is disabled.');
        }

        try {
            let contextText = "";
            let imageResults = [];

            // 2. Fetch context from Google Web Search via SerpAPI
            if (SERPAPI_KEY) {
                const serpResponse = await axios.get('https://serpapi.com/search.json', {
                    params: {
                        engine: 'google',
                        q: query,
                        api_key: SERPAPI_KEY
                    }
                });

                const organicResults = serpResponse.data.organic_results || [];
                contextText = organicResults.slice(0, 5).map(r => `${r.title}: ${r.snippet}`).join('\n');

                // Try to get some image results to match the trends
                const imageSearch = await axios.get('https://serpapi.com/search.json', {
                    params: {
                        engine: 'google_images',
                        q: query,
                        ijn: '0',
                        api_key: SERPAPI_KEY
                    }
                });
                imageResults = (imageSearch.data.images_results || []).slice(0, 10).map(img => img.original);
            }

            // 3. Ask OpenAI to synthesize the trends
            const prompt = `
            The user is searching for: "${query}".
            Based on the following search results context (if any), synthesize a list of the top logo design trends.
            If context is empty, use your vast knowledge base to predict future or analyze current logo trends.
            
            Context:
            ${contextText}

            Provide a JSON response with a "trends" array. Each object in the array MUST have:
            - "title": Trend name (e.g. "Minimalism").
            - "description": 1-2 robust sentences explaining why it's trending or how it looks.
            - "visualKeyword": A highly-descriptive short phrase that visually represents this trend (to map to images).

            Must be valid JSON.
            `;

            const completion = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    { role: "system", content: "You are a top-tier Brand and Design Trends Analyst." },
                    { role: "user", content: prompt }
                ]
            });

            const trendsData = JSON.parse(completion.choices[0].message.content);

            // 4. Attach images to trends as a best effort
            if (trendsData.trends) {
                trendsData.trends = trendsData.trends.map((trend, index) => {
                    return {
                        ...trend,
                        imageUrl: imageResults[index] || null
                    };
                });
            }

            const payload = {
                title: `Logo Design Trends for "${query}"`,
                trends: trendsData.trends || []
            };

            // 5. Cache and return
            await this.cacheSearch(query, 'trend', payload);
            return payload;

        } catch (error) {
            console.error('Error fetching logo trends:', error);
            throw new Error('Failed to fetch logo trends');
        }
    }
}

export const logoService = new LogoService();
