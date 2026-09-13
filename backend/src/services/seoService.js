import NodeCache from 'node-cache';

const seoCache = new NodeCache({ stdTTL: 86400 }); // Cache for 24 hours

/**
 * Generates SEO metadata and helpful content for a given query.
 * In a real scenario, this would call Gemini/OpenAI.
 * For now, it uses a template-based approach with AI-ready structures.
 */
export async function getSEOMetadata(category, query, openai) {
    const cacheKey = `seo_${category}_${query}`;
    if (seoCache.has(cacheKey)) return seoCache.get(cacheKey);

    const formattedQuery = query.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const formattedCategory = category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    let aiDescription = "";

    try {
        if (openai) {
            const completion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: "You are an expert design critic and SEO specialist." },
                    { role: "user", content: `Write a 2-sentence professional explanation for designers about why ${formattedQuery} in ${formattedCategory} is a popular or effective design choice. Be concise and helpful.` }
                ],
                max_tokens: 100
            });
            aiDescription = completion.choices[0].message.content;
        }
    } catch (err) {
        console.error("SEO AI Generation failed:", err);
    }

    if (!aiDescription) {
        aiDescription = `${formattedQuery} in ${formattedCategory} is a trending design pattern known for its efficiency and aesthetic appeal. Explore the best curated examples for your next project.`;
    }

    const metadata = {
        title: `${formattedQuery} ${formattedCategory} Inspiration | InspoAI`,
        description: aiDescription,
        keywords: `${query}, ${category}, design inspiration, UI design, UX, ${formattedQuery} examples`,
        h1: `${formattedQuery} ${formattedCategory}`,
        helpfulContent: aiDescription
    };

    seoCache.set(cacheKey, metadata);
    return metadata;
}

/**
 * Injects SEO metadata into the HTML template
 */
export function injectMetadata(html, metadata) {
    return html
        .replace(/<title>.*?<\/title>/, `<title>${metadata.title}</title>`)
        .replace('</head>', `
    <meta name="description" content="${metadata.description}">
    <meta name="keywords" content="${metadata.keywords}">
    <meta property="og:title" content="${metadata.title}">
    <meta property="og:description" content="${metadata.description}">
    <meta name="twitter:card" content="summary_large_image">
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "${metadata.title}",
      "description": "${metadata.description}"
    }
    </script>
</head>`);
}
