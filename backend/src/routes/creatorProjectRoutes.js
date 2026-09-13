import { supabaseAdmin } from '../config/supabaseClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const setupCreatorProjectRoutes = async (app, context) => {
    const { authenticateUser } = context;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const flashModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // ============================================
    // PROJECT MANAGEMENT (ML-Enhanced)
    // ============================================

    // Save or update project
    app.post('/api/creator/projects/save', authenticateUser, async (req, res) => {
        try {
            const { projectId, name, description, type, designSystem, sections } = req.body;
            const userId = req.user.uid || req.user.id;

            let project;
            if (projectId) {
                const { data, error } = await supabaseAdmin
                    .from('creator_projects')
                    .update({ name, description, type, design_system: designSystem, sections, updated_at: new Date().toISOString() })
                    .eq('id', projectId)
                    .eq('user_id', userId)
                    .select()
                    .single();
                if (error) throw error;
                project = data;
            } else {
                const { data, error } = await supabaseAdmin
                    .from('creator_projects')
                    .insert({ user_id: userId, name, description, type, design_system: designSystem, sections })
                    .select()
                    .single();
                if (error) throw error;
                project = data;
            }

            await updateUserPreferences(userId, sections);
            res.json({ success: true, project });
        } catch (error) {
            console.error('Project save error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get user's projects
    app.get('/api/creator/projects', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const { data, error } = await supabaseAdmin
                .from('creator_projects')
                .select('*')
                .eq('user_id', userId)
                .order('updated_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            res.json({ success: true, projects: data || [] });
        } catch (error) {
            console.error('Projects fetch error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Delete a project
    app.delete('/api/creator/projects/:projectId', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const { projectId } = req.params;
            await supabaseAdmin.from('creator_projects').delete().eq('id', projectId).eq('user_id', userId);
            res.json({ success: true });
        } catch (error) {
            console.error('Project delete error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get personalized recommendations based on ML
    app.get('/api/creator/recommendations', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const { data: prefs } = await supabaseAdmin
                .from('design_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!prefs) {
                return res.json({
                    success: true,
                    recommendations: {
                        suggestedSections: [
                            { type: 'hero', title: 'Hero Section', prompt: 'Modern hero section with gradient background', reason: 'Great starting point for any website' },
                            { type: 'features', title: 'Features Grid', prompt: 'Features section with icon cards in 3-column grid', reason: 'Showcase your product benefits' },
                            { type: 'pricing', title: 'Pricing Table', prompt: 'Pricing table with 3 tiers and comparison', reason: 'Convert visitors to customers' }
                        ],
                        suggestedStyles: ['modern', 'minimalist', 'professional'],
                        isPersonalized: false
                    }
                });
            }

            const styleProfile = prefs.style_profile || {};
            const aiLearning = prefs.ai_learning || {};
            const stats = prefs.stats || {};

            const topStyles = (styleProfile.preferredStyles || [])
                .sort((a, b) => b.weight - a.weight).slice(0, 3).map(s => s.name).join(', ') || 'modern';
            const topColors = (styleProfile.colorPreferences || [])
                .sort((a, b) => b.frequency - a.frequency).slice(0, 5).map(c => c.color).join(', ') || 'vibrant colors';

            const prefPrompt = `Based on this user's design preferences, suggest 5 website sections they should create next:

User Profile:
- Preferred Styles: ${topStyles}
- Common Colors: ${topColors}
- Total Generations: ${stats.totalGenerations || 0}
- Design Complexity: ${aiLearning.designComplexity || 'moderate'}
- Favorite Section Types: ${Object.entries(stats.favoriteTypes || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]).join(', ')}

Return as JSON array of section suggestions:
[{"type":"section type","title":"suggested title","prompt":"ready-to-use prompt","reason":"why this is recommended"}]`;

            try {
                const result = await flashModel.generateContent(prefPrompt);
                const responseText = result.response.text();
                let suggestions;
                try {
                    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
                    suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
                } catch { suggestions = []; }

                res.json({
                    success: true,
                    recommendations: {
                        suggestedSections: suggestions.length > 0 ? suggestions : [
                            { type: 'custom', title: 'Custom Section', prompt: `Modern ${topStyles} section`, reason: 'Based on your preferences' }
                        ],
                        userStats: stats,
                        isPersonalized: true,
                        insights: { favoriteStyle: topStyles.split(',')[0], complexity: aiLearning.designComplexity, totalCreated: stats.totalGenerations }
                    }
                });
            } catch (aiError) {
                console.error('AI recommendation error:', aiError);
                const favoriteTypes = Object.entries(stats.favoriteTypes || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
                res.json({
                    success: true,
                    recommendations: {
                        suggestedSections: favoriteTypes.map(([type, count]) => ({
                            type, title: `${type.charAt(0).toUpperCase() + type.slice(1)} Section`,
                            prompt: `Create a ${type} section with ${topStyles} style`,
                            reason: `You've created ${count} similar sections before`
                        })),
                        userStats: stats, isPersonalized: true
                    }
                });
            }
        } catch (error) {
            console.error('Recommendations error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Track user interaction for ML learning
    app.post('/api/creator/track-interaction', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const { action, sectionType, prompt, liked } = req.body;
            await updateUserPreferences(userId, null, { action, sectionType, prompt, liked, timestamp: new Date().toISOString() });
            res.json({ success: true });
        } catch (error) {
            console.error('Tracking error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // Get user's design preferences/stats
    app.get('/api/creator/preferences', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const { data: prefs } = await supabaseAdmin
                .from('design_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!prefs) {
                return res.json({ success: true, preferences: null, isNewUser: true });
            }

            const styleProfile = prefs.style_profile || {};
            const aiLearning = prefs.ai_learning || {};

            res.json({
                success: true,
                preferences: {
                    stats: prefs.stats,
                    favoriteColors: (styleProfile.colorPreferences || []).slice(0, 5),
                    favoriteStyles: (styleProfile.preferredStyles || []).slice(0, 5),
                    complexity: aiLearning.designComplexity,
                    recentActivity: (prefs.interaction_history || []).slice(-10)
                },
                isNewUser: false
            });
        } catch (error) {
            console.error('Preferences fetch error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ============================================
    // HELPER FUNCTIONS FOR ML
    // ============================================

    async function updateUserPreferences(userId, sections, interaction) {
        try {
            let { data: prefs } = await supabaseAdmin
                .from('design_preferences')
                .select('*')
                .eq('user_id', userId)
                .single();

            const isNew = !prefs;
            if (isNew) {
                prefs = {
                    user_id: userId,
                    style_profile: { preferredStyles: [], colorPreferences: [], layoutPatterns: [], componentChoices: [] },
                    interaction_history: [],
                    ai_learning: { averagePromptLength: 0, commonKeywords: [], refinementPatterns: [], designComplexity: 'moderate', industryFocus: [] },
                    stats: { totalGenerations: 0, totalRefinements: 0, totalExports: 0, favoriteTypes: {} }
                };
            }

            const styleProfile = prefs.style_profile || {};
            const aiLearning = prefs.ai_learning || {};
            const stats = prefs.stats || {};
            let interactionHistory = prefs.interaction_history || [];

            if (interaction) {
                interactionHistory.push(interaction);
                if (interaction.action === 'generated') stats.totalGenerations = (stats.totalGenerations || 0) + 1;
                if (interaction.action === 'refined') stats.totalRefinements = (stats.totalRefinements || 0) + 1;
                if (interaction.action === 'exported') stats.totalExports = (stats.totalExports || 0) + 1;

                if (interaction.sectionType) {
                    if (!stats.favoriteTypes) stats.favoriteTypes = {};
                    stats.favoriteTypes[interaction.sectionType] = (stats.favoriteTypes[interaction.sectionType] || 0) + 1;
                }

                if (interaction.prompt) {
                    const keywords = interaction.prompt.toLowerCase().split(' ').filter(w => w.length > 4);
                    if (!aiLearning.commonKeywords) aiLearning.commonKeywords = [];
                    keywords.forEach(keyword => {
                        if (!aiLearning.commonKeywords.includes(keyword)) aiLearning.commonKeywords.push(keyword);
                    });
                    const currentAvg = aiLearning.averagePromptLength || 0;
                    const totalInteractions = interactionHistory.length;
                    aiLearning.averagePromptLength = (currentAvg * (totalInteractions - 1) + interaction.prompt.length) / totalInteractions;
                }
            }

            if (sections && Array.isArray(sections)) {
                if (!styleProfile.colorPreferences) styleProfile.colorPreferences = [];
                if (!styleProfile.layoutPatterns) styleProfile.layoutPatterns = [];
                if (!styleProfile.preferredStyles) styleProfile.preferredStyles = [];

                sections.forEach(section => {
                    if (section.code?.colorPalette) {
                        section.code.colorPalette.forEach(color => {
                            const existing = styleProfile.colorPreferences.find(c => c.color === color);
                            if (existing) { existing.frequency++; if (section.type && !existing.contexts.includes(section.type)) existing.contexts.push(section.type); }
                            else { styleProfile.colorPreferences.push({ color, frequency: 1, contexts: section.type ? [section.type] : [] }); }
                        });
                    }
                    const layoutHints = ['grid', 'flex', 'columns', 'rows'];
                    layoutHints.forEach(hint => {
                        if (section.code?.html?.toLowerCase().includes(hint) || section.code?.css?.toLowerCase().includes(hint)) {
                            const existing = styleProfile.layoutPatterns.find(p => p.pattern === hint);
                            if (existing) existing.frequency++; else styleProfile.layoutPatterns.push({ pattern: hint, frequency: 1 });
                        }
                    });
                    const styleHints = ['modern', 'minimalist', 'bold', 'elegant', 'playful', 'corporate'];
                    styleHints.forEach(style => {
                        if (section.prompt?.toLowerCase().includes(style) || section.code?.description?.toLowerCase().includes(style)) {
                            const existing = styleProfile.preferredStyles.find(s => s.name === style);
                            if (existing) existing.weight++; else styleProfile.preferredStyles.push({ name: style, weight: 1 });
                        }
                    });
                });

                const total = stats.totalGenerations || 0;
                const refinements = stats.totalRefinements || 0;
                const refineRatio = total > 0 ? refinements / total : 0;
                if (total > 50 || refineRatio > 0.5) aiLearning.designComplexity = 'complex';
                else if (total > 20 || refineRatio > 0.3) aiLearning.designComplexity = 'moderate';
                else aiLearning.designComplexity = 'simple';
            }

            if (interactionHistory.length > 100) interactionHistory = interactionHistory.slice(-100);
            if (aiLearning.commonKeywords && aiLearning.commonKeywords.length > 50) aiLearning.commonKeywords = aiLearning.commonKeywords.slice(0, 50);
            if (styleProfile.colorPreferences && styleProfile.colorPreferences.length > 100) {
                styleProfile.colorPreferences = styleProfile.colorPreferences.sort((a, b) => b.frequency - a.frequency).slice(0, 100);
            }

            const record = {
                user_id: userId,
                style_profile: styleProfile,
                interaction_history: interactionHistory,
                ai_learning: aiLearning,
                stats,
                updated_at: new Date().toISOString()
            };

            if (isNew) {
                await supabaseAdmin.from('design_preferences').insert(record);
            } else {
                await supabaseAdmin.from('design_preferences').update(record).eq('user_id', userId);
            }

            return record;
        } catch (error) {
            console.error('Preference update error:', error);
            throw error;
        }
    }
};

export default setupCreatorProjectRoutes;
