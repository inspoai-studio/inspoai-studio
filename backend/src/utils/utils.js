import axios from 'axios';
import https from 'https';
import natural from 'natural';

// Create optimized Axios client with request pooling
const apiClient = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 10000 // Default timeout
});
import googleAPIManager from './googleApiManager.js';
export const shouldUseGoogleAPI = () => {
  return googleAPIManager.hasAvailableKeys();
};

export const incrementGoogleApiCounter = () => {
  console.log("NOTE: incrementGoogleApiCounter is deprecated, managed by GoogleAPIManager");
};

export const getGoogleAPIStats = () => {
  return googleAPIManager.getStats();
};

const nlpUtils = {
  tokenizer: new natural.WordTokenizer(),
  stemmer: natural.PorterStemmer,
  extractAdvancedColorPalette(aiSuggestions, inputColor = null) {
    const hexCodeRegex = /#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})/g;
    const colorNameRegex = /\b(red|blue|green|yellow|purple|orange|pink|brown|gray|black|white)\b/gi;
    // Extract hex codes and color names
    const hexCodes = aiSuggestions.match(hexCodeRegex) || [];
    const colorNames = (aiSuggestions.match(colorNameRegex) || []).map(c => c.toLowerCase());

    const colorTheoryMappings = {
      'complementary': (baseColor) => this.generateComplementaryColors(baseColor),
      'analogous': (baseColor) => this.generateAnalogousColors(baseColor),
      'triadic': (baseColor) => this.generateTriadicColors(baseColor),
    };
    // Combine and deduplicate colors
    const allColors = [...new Set([
      ...hexCodes,
      ...(inputColor ? [inputColor] : []),
      ...this.generateColorFromNames(colorNames)
    ])];
    // If few colors, generate additional colors using color theory
    if (allColors.length < 3 && allColors.length > 0) {
      const baseColor = allColors[0];
      const generativeScheme = Object.keys(colorTheoryMappings)[
        Math.floor(Math.random() * Object.keys(colorTheoryMappings).length)
      ];
      const additionalColors = colorTheoryMappings[generativeScheme](baseColor);
      allColors.push(...additionalColors);
    }
    return allColors.slice(0, 5);
  },

  // Keep the rest of the nlpUtils functions as they were
  generateColorFromNames(colorNames) {
    const colorMap = {
      'red': ['#FF0000', '#DC143C', '#B22222'],
      'blue': ['#0000FF', '#1E90FF', '#4169E1'],
      'green': ['#008000', '#32CD32', '#3CB371'],
      'yellow': ['#FFD700', '#FFFF00', '#FFA500'],
      'purple': ['#800080', '#8A2BE2', '#9400D3'],
      'orange': ['#FFA500', '#FF4500', '#FF6347'],
      'pink': ['#FFC0CB', '#FF69B4', '#FF1493'],
      'brown': ['#A52A2A', '#8B4513', '#D2691E'],
      'gray': ['#808080', '#A9A9A9', '#D3D3D3'],
      'black': ['#000000', '#111111', '#222222'],
      'white': ['#FFFFFF', '#F5F5F5', '#FAFAFA']
    };
    return colorNames.flatMap(name => colorMap[name] || []);
  },

  generateComplementaryColors(baseColor) {
    // Simple complement calculation
    return [this.adjustColorBrightness(baseColor, 0.2), this.adjustColorBrightness(baseColor, -0.2)];
  },

  generateAnalogousColors(baseColor) {
    // Generate colors close to the base color
    return [
      this.rotateHue(baseColor, 30),
      this.rotateHue(baseColor, -30)
    ];
  },

  generateTriadicColors(baseColor) {
    // Generate colors at 120-degree intervals
    return [
      this.rotateHue(baseColor, 120),
      this.rotateHue(baseColor, -120)
    ];
  },

  // Color manipulation utilities
  rotateHue(hex, degrees) {
    try {
      // Convert hex to HSL, rotate hue, then back to hex
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h, s, l = (max + min) / 2;

      if (max === min) {
        h = s = 0; // achromatic
      } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }

        h /= 6;
      }

      // Rotate hue
      h = (h + degrees / 360) % 1;
      if (h < 0) h += 1;

      // Convert back to RGB
      let r1, g1, b1;

      if (s === 0) {
        r1 = g1 = b1 = l; // achromatic
      } else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;

        r1 = hue2rgb(p, q, h + 1 / 3);
        g1 = hue2rgb(p, q, h);
        b1 = hue2rgb(p, q, h - 1 / 3);
      }

      // Convert to hex
      const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r1)}${toHex(g1)}${toHex(b1)}`;
    } catch (error) {
      console.error('Error rotating hue:', error);
      return hex; // Return original color on error
    }
  },

  adjustColorBrightness(hex, percent) {
    try {
      if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) {
        return hex;
      }

      // Parse hex to RGB
      let r = parseInt(hex.slice(1, 3), 16);
      let g = parseInt(hex.slice(3, 5), 16);
      let b = parseInt(hex.slice(5, 7), 16);

      // Adjust brightness
      r = Math.min(255, Math.max(0, r + Math.round(r * percent)));
      g = Math.min(255, Math.max(0, g + Math.round(g * percent)));
      b = Math.min(255, Math.max(0, b + Math.round(b * percent)));

      // Convert back to hex
      const toHex = (num) => {
        const hex = num.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };

      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    } catch (error) {
      console.error('Error adjusting brightness:', error);
      return hex; // Return original color on error
    }
  }
};

export const makeLinksClickable = (text) => {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
};

// Function to validate image URLs
export const validateImage = async (url) => {
  try {
    const response = await apiClient.head(url, { timeout: 5000 });
    return response.status === 200 && response.headers["content-type"].startsWith("image");
  } catch (error) {
    return false; // Return false if the image is not accessible
  }
};

const filterDesignImages = (images) => {
  // This function remains unchanged
  const designKeywords = [
    'design', 'template', 'layout', 'ui', 'ux', 'interface',
    'graphic', 'art', 'inspiration', 'creative', 'mockup',
    'wireframe', 'website', 'web design', 'app design',
    'typography', 'branding', 'logo', 'illustration', 'dribbble',
    'behance', 'portfolio', 'sketch', 'figma', 'adobe', 'theme'
  ];

  const designDomains = [
    'dribbble.com', 'behance.net', 'awwwards.com',
    'pinterest.com', 'deviantart.com', 'creativemarket.com',
    'graphicriver.net', 'designspiration.com', 'designmodo.com',
    'smashingmagazine.com', 'designshack.net', 'creativebloq.com',
    'adobe.com', 'canva.com', 'sketch.com', 'figma.com'
  ];

  const isDesignRelated = (image) => {
    // Check title, snippet, and url for design keywords
    const contentToCheck = [
      image.title?.toLowerCase() || '',
      image.snippet?.toLowerCase() || '',
      image.url?.toLowerCase() || ''
    ].join(' ');

    // Check if any design keyword is present in the content
    const hasDesignKeyword = designKeywords.some(keyword =>
      contentToCheck.includes(keyword)
    );

    // Check if the image is from a design-focused domain
    const isFromDesignDomain = designDomains.some(domain =>
      (image.url?.toLowerCase() || '').includes(domain)
    );

    // If the image has a high resolution, it's more likely to be a quality design image
    const isHighRes = (image.width >= 800 || image.height >= 800);

    // Return true if any condition is met
    return hasDesignKeyword || isFromDesignDomain || isHighRes;
  };

  // Apply filter
  const designImages = images.filter(isDesignRelated);

  // If we filtered out too many, return original set
  if (designImages.length < Math.min(3, images.length)) {
    console.log("Design filter was too restrictive, returning original image set");
    return images;
  }

  console.log(`Filtered to ${designImages.length} design-related images out of ${images.length}`);
  return designImages;
};

// Reusable function to append design terms
const appendDesignTerms = (query) => {
  const designTermsInQuery = [
    'design', 'template', 'layout', 'ui', 'ux', 'user interface',
    'graphic', 'art', 'inspiration', 'mockup', 'wireframe'
  ];

  const queryLower = query.toLowerCase();
  const hasDesignTerm = designTermsInQuery.some(term => queryLower.includes(term));

  if (hasDesignTerm) {
    return query;
  }

  if (queryLower.includes('website') || queryLower.includes('web') || queryLower.includes('app')) {
    return `${query} ui design inspiration`;
  } else if (queryLower.includes('logo') || queryLower.includes('brand')) {
    return `${query} brand design`;
  } else if (queryLower.includes('banner') || queryLower.includes('ad')) {
    return `${query} graphic design`;
  } else {
    return `${query} design inspiration`;
  }
};

// Updated Google Images fetch function using the API Manager
export const fetchGoogleImages = async (query, limit = 10, offset = 0, skipAppend = false) => {
  try {
    // If we've already determined all keys are at quota, return empty results
    if (!googleAPIManager.hasAvailableKeys()) {
      console.log("[Warning] All Google API keys have reached quota, skipping Google search");
      return [];
    }

    // Get the design query and append exclusion for lapaninja
    let designQuery = skipAppend ? query : appendDesignTerms(query);
    if (!skipAppend) {
      designQuery += " -site:lapaninja.com -site:lapaninja.org -site:lapaninja.net";
    }
    console.log(`Executing Google search with query: "${designQuery}" (limit: ${limit}, offset: ${offset})`);

    // Use our API manager to execute the search with fallback support
    const searchParams = {
      q: designQuery,
      searchType: "image",
      num: Math.min(limit, 10), // Google only allows max 10 per request
      start: offset + 1, // Google uses 1-based indexing
      safe: "active"
    };

    if (!skipAppend) {
      searchParams.imgSize = "xlarge";
      searchParams.imgType = "photo";
      searchParams.rights = "cc_publicdomain,cc_attribute,cc_sharealike";
      searchParams.sort = "relevance";
      searchParams.filter = "1";
    }

    // Execute search with automatic fallback
    const data = await googleAPIManager.executeSearch(searchParams);

    if (!data || !data.items || data.items.length === 0) {
      console.log(`No results found for query: "${designQuery}"`);

      // Try a simplified fallback query if original query fails
      if (query.split(' ').length > 2 && googleAPIManager.hasAvailableKeys()) {
        const simplifiedQuery = query.split(' ').slice(0, 2).join(' ') + " design inspiration -site:lapaninja.com";
        console.log(`Trying simplified fallback query: "${simplifiedQuery}"`);

        // Try with the simplified query
        const fallbackParams = {
          q: simplifiedQuery,
          searchType: "image",
          num: Math.min(limit, 10),
          start: offset + 1,
          safe: "active",
          imgSize: "xlarge"
        };

        const fallbackData = await googleAPIManager.executeSearch(fallbackParams);

        if (!fallbackData || !fallbackData.items) {
          return [];
        }

        // Process the results
        const processedResults = filteredProcessGoogleResults(fallbackData.items);
        return filterDesignImages(processedResults);
      }

      return [];
    }

    // Process the original results
    const processedResults = filteredProcessGoogleResults(data.items);
    return filterDesignImages(processedResults);
  } catch (error) {
    console.error("[Error] Google Custom Search API Error:", error.message);
    return [];
  }
};

// Updated Pinterest via Google function using API Manager with native fallback
export const fetchPinterestViaGoogle = async (query, limit = 10, offset = 0) => {
  let images = [];

  try {
    if (!googleAPIManager.hasAvailableKeys()) {
      console.log("[Warning] Google API quota exhausted in fetchPinterestViaGoogle. Jumping directly to fallback scraper.");
      throw new Error("Google Custom Search API Quota Exceeded");
    }

    console.log(`Executing Pinterest search via Google with query: "${query}"`);
    const searchParams = {
      q: `${query} site:pinterest.com`,
      searchType: "image",
      num: Math.min(limit, 10),
      start: offset + 1,
      safe: "active",
      imgSize: "large"
    };

    const data = await googleAPIManager.executeSearch(searchParams);

    if (!data || !data.items || data.items.length === 0) {
      console.log(`No Pinterest results for query via Google API: "${query}"`);
      throw new Error("Google API returned empty results for Pinterest");
    }

    images = data.items.map((item) => ({
      image: item.link,
      title: item.title?.replace(" | Pinterest", "").replace(" on Pinterest", "") || "Pinterest Inspiration",
      source: "Pinterest",
      url: item.image?.contextLink || item.displayLink || "",
      id: Buffer.from(item.link).toString('base64').substring(0, 12),
      snippet: item.snippet || ""
    })).filter(img => img.image);

    return images;
  } catch (error) {
    console.log("[Error] Pinterest search via Google failed. Falling back to native scraper:", error.message);

    try {
      if (typeof pinterestScraper !== 'undefined') {
        const rawPinterestResults = await pinterestScraper.scrapePinterestImages(query, limit);
        if (rawPinterestResults && rawPinterestResults.length > 0) {
          console.log(`[Success] Native Pinterest scraper fallback found ${rawPinterestResults.length} images`);
          images = rawPinterestResults.map(r => r.image || r);
        }
      }
    } catch (scraperError) {
      console.error("[Error] Native Pinterest scraper fallback error:", scraperError.message);
    }

    return images;
  }
};

// Specialized function to fetch Lapa Ninja and Land-book via Google (Phase 1 turbo)
export const fetchCuratedWebsitesViaGoogle = async (query, limit = 10) => {
  try {
    if (!googleAPIManager.hasAvailableKeys()) return [];

    console.log(`Phase 1: Curated website search via Google for: "${query}"`);
    const searchParams = {
      q: `${query} (site:lapa.ninja OR site:land-book.com)`,
      searchType: "image",
      num: Math.min(limit, 10),
      safe: "active",
      imgSize: "large"
    };

    const data = await googleAPIManager.executeSearch(searchParams);

    if (!data || !data.items) return [];

    return data.items.map((item) => ({
      image: item.link,
      title: item.title?.split('|')[0].trim() || "Website Inspiration",
      source: item.link.includes('lapa.ninja') ? "Lapa Ninja" : "Land-book",
      url: item.image?.contextLink || item.displayLink || "",
      id: Buffer.from(item.link).toString('base64').substring(0, 12),
      relevanceScore: 0.95 // High relevance for curated sources
    })).filter(img => img.image);
  } catch (error) {
    console.error("[Error] Curated website search via Google failed:", error.message);
    return [];
  }
};


// Updated Design Platforms Inspiration function using the API Manager
export const fetchDesignPlatformsInspiration = async (query, options = {}, appSecretKeyId = null) => {
  try {
    const { industry, designStyle, font, limit = 20, offset = 0 } = options;

    // Create more specific queries for better results
    const mainQuery = [query, industry, designStyle, font, 'design'].filter(Boolean).join(' ');
    const alternateQuery = [query, industry, 'inspiration'].filter(Boolean).join(' ');

    // Calculate adjusted limit and offset for each source
    const pinterestLimit = Math.ceil(limit * 0.7); // Allocate 70% of slots to Pinterest
    const pinterestOffset = Math.floor(offset * 0.7); // Apply offset proportionally

    // Skip if Google API quota is exceeded
    if (!googleAPIManager.hasAvailableKeys()) {
      console.log("Skipping general Pinterest search via Google API due to quota limitations");
      console.log("Falling back directly to actual Pinterest Scraper");

      try {
        if (typeof pinterestScraper !== 'undefined') {
          const rawPinterestResults = await pinterestScraper.scrapePinterestImages(mainQuery, limit);

          if (rawPinterestResults && rawPinterestResults.length > 0) {
            console.log(`[Success] Direct Pinterest scraper fallback found ${rawPinterestResults.length} images`);
            return rawPinterestResults.map(r => r.image || r);
          }
        }
      } catch (scraperError) {
        console.error("[Error] Pinterest scraper fallback error:", scraperError.message);
      }

      // If both Google API and Pinterest scraper fail, then fallback to Freepik
      if (appSecretKeyId) {
        console.log("Falling back to Freepik resources only");
        try {
          const freepikResults = await fetchFreepikImages(mainQuery, limit, '', 0, appSecretKeyId);
          return freepikResults;
        } catch (freepikError) {
          console.error("[Error] Freepik fallback error:", freepikError.message);
          return [];
        }
      }

      return [];
    }

    // Fetch Pinterest results via Google API
    let pinterestResults = [];
    try {
      pinterestResults = await fetchPinterestViaGoogle(mainQuery, pinterestLimit, pinterestOffset);
      // If Google Search failed or returned nothing, manually trigger the fallback
      if (!pinterestResults || pinterestResults.length === 0) {
        throw new Error("Google API returned empty results for Pinterest");
      }
    } catch (error) {
      console.log("Failed to fetch Pinterest results via Google:", error.message);

      console.log("Attempting to use Pinterest scraper fallback");
      try {
        if (typeof pinterestScraper !== 'undefined') {
          const rawPinterestResults = await pinterestScraper.scrapePinterestImages(mainQuery, pinterestLimit);
          if (rawPinterestResults && rawPinterestResults.length > 0) {
            console.log(`[Success] Secondary Pinterest scraper fallback found ${rawPinterestResults.length} images`);
            pinterestResults = rawPinterestResults.map(r => r.image || r);
          }
        }
      } catch (scraperError) {
        console.error("[Error] Secondary Pinterest scraper fallback failed:", scraperError.message);
      }

      // If Google API and Scraper both failed... fallback to Freepik
      if (pinterestResults.length === 0 && appSecretKeyId) {
        console.log("Falling back to Freepik resources");
        try {
          const freepikResults = await fetchFreepikImages(mainQuery, limit, '', 0, appSecretKeyId);
          return freepikResults;
        } catch (freepikError) {
          console.error("[Error] Freepik fallback error:", freepikError.message);
        }
      }

      if (pinterestResults.length === 0) return [];
    }

    // If we got few results, try alternate query
    if (pinterestResults.length < pinterestLimit / 2 && googleAPIManager.hasAvailableKeys()) {
      try {
        const altResults = await fetchPinterestViaGoogle(alternateQuery, pinterestLimit / 2, 0);

        // Add unique alternate results
        const seenUrls = new Set(pinterestResults.map(item => item.image));
        for (const item of altResults) {
          if (!seenUrls.has(item.image)) {
            pinterestResults.push(item);
            seenUrls.add(item.image);
          }
        }
      } catch (error) {
        console.log("Failed to fetch alternate Pinterest results:", error.message);
      }
    }

    // If we still have very few results and have Freepik API key, supplement with Freepik results
    if (pinterestResults.length < limit / 2 && appSecretKeyId) {
      try {
        console.log("Supplementing Pinterest results with Freepik resources");
        const freepikResults = await fetchFreepikImages(mainQuery, Math.ceil(limit / 2), '', 0, appSecretKeyId);

        // Add unique Freepik results
        const seenUrls = new Set(pinterestResults.map(item => item.image));
        for (const item of freepikResults) {
          if (!seenUrls.has(item.image)) {
            pinterestResults.push(item);
            seenUrls.add(item.image);
          }
        }
      } catch (error) {
        console.log("Failed to fetch supplementary Freepik results:", error.message);
      }
    }

    return pinterestResults;
  } catch (error) {
    console.error("[Error] Design platforms search error:", error.message);
    return [];
  }
};


// Keep the Freepik functions unchanged
export const fetchFreepikImages = async (query, limit = 10, format = '', offset = 0) => {
  try {
    const params = {
      term: query,
      locale: "en-US",
      page: Math.floor(offset / limit) + 1,
      limit: limit,
      order: "relevance"
    };
    // Add format filter if specified
    if (format && ['vector', 'psd'].includes(format.toLowerCase())) {
      params.format = format.toLowerCase();
    }
    const response = await apiClient.get("https://api.freepik.com/v1/resources", {
      headers: {
        'x-freepik-api-key': process.env.FREEPIK_API_KEY
      },
      params: params,
      timeout: 5000
    });
    if (!response.data || !response.data.data) {
      return [];
    }
    return response.data.data.map(item => ({
      image: item.image?.source?.url || item.image?.regular_url,
      title: item.title || "Design Resource",
      source: "Freepik",
      url: item.url || "",
      author: item.contributor?.username || "Freepik Artist",
      format: item.format || format || "image",
      isPremium: item.is_premium || false,
      id: Buffer.from(item.image?.source?.url || item.image?.regular_url || "").toString('base64').substring(0, 12)
    })).filter(img => img.image);
  } catch (error) {
    console.error("[Error] Freepik API Error:", error.message);
    return [];
  }
};

export const fetchFreepikAIImage = async (prompt, aspectRatio = 'square_1_1') => {
  try {
    const data = {
      prompt,
      aspect_ratio: aspectRatio,
      styling: {
        effects: {
          lighting: 'natural',
          camera: 'portrait'
        },
      },
      seed: Math.floor(Math.random() * 1000000),
    };

    // Log the request for debugging
    console.log(`Freepik AI Request: ${JSON.stringify(data, null, 2)}`);

    const response = await apiClient.post(
      'https://api.freepik.com/v1/ai/text-to-image',
      data,
      {
        headers: {
          'x-freepik-api-key': process.env.FREEPIK_API_KEY,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    // Properly check response structure
    if (response.data && response.data.images && Array.isArray(response.data.images)) {
      return response.data.images.map((img) => ({
        image: img.url,
        title: "AI Generated Design",
        source: "Freepik AI",
        format: "AI Image",
        id: Buffer.from(img.url || "").toString('base64').substring(0, 12)
      }));
    }

    return [];
  } catch (error) {
    if (error.response) {
      console.error("[Error] Freepik AI Error Status:", error.response.status);
      console.error("[Error] Freepik AI Error Data:", error.response.data);
    } else {
      console.error("[Error] Freepik AI Error:", error.message);
    }
    return [];
  }
};


const filteredProcessGoogleResults = (items) => {
  // First filter out any lapaninja results
  const filteredItems = items.filter(item => {
    // Check various properties for lapaninja
    const itemUrl = item.link?.toLowerCase() || '';
    const itemTitle = item.title?.toLowerCase() || '';
    const displayLink = item.displayLink?.toLowerCase() || '';
    const contextLink = item.image?.contextLink?.toLowerCase() || '';
    const snippet = item.snippet?.toLowerCase() || '';

    return !(
      itemUrl.includes('lapaninja') ||
      itemTitle.includes('lapaninja') ||
      displayLink.includes('lapaninja') ||
      contextLink.includes('lapaninja') ||
      snippet.includes('lapaninja')
    );
  });

  if (items.length !== filteredItems.length) {
    console.log(`Filtered out ${items.length - filteredItems.length} lapaninja results`);
  }

  // Generate a unique ID for each image based on URL
  const images = filteredItems.map((item) => ({
    image: item.link,
    title: item.title || "Design Inspiration",
    source: "Google Images",
    url: item.image?.contextLink || item.displayLink || "",
    snippet: item.snippet || "",
    // Add image dimensions if available
    width: item.image?.width || 0,
    height: item.image?.height || 0,
    id: Buffer.from(item.link).toString('base64').substring(0, 12)
  }));

  // Return results without duplicates
  const uniqueImages = [];
  const seenIds = new Set();

  for (const img of images) {
    if (!seenIds.has(img.id)) {
      seenIds.add(img.id);
      uniqueImages.push(img);
    }
  }

  return uniqueImages;
};

export const extractHeading = (aiSuggestions) => {
  const headingMatch = aiSuggestions.match(/^#\s+([^\n]+)|^##\s+([^\n]+)|^(.+?)\n/);
  if (headingMatch) {
    return (headingMatch[1] || headingMatch[2] || headingMatch[3] || "Design Recommendations").trim();
  }
  return "Design Recommendations";
};

// Fetch AI-based design recommendations
// Helper to call OpenAI API
const callOpenAIAPI = async (model, prompt) => {
  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: model,
    messages: [
      {
        role: "system",
        content: "You are a professional design consultant. Provide specific and actionable design recommendations."
      },
      {
        role: "user",
        content: prompt
      }
    ]
  };

  return apiClient.post(url, payload, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
    },
    timeout: 10000
  });
};

export const getDesignSuggestions = async (query, industry, font, colorHex, designStyle) => {
  const prompt = `
    As a professional design consultant, provide specific and actionable design recommendations based on these inputs:
    - Query: "${query}"
    - Industry: "${industry || 'Not specified'}"
    - Font Type: "${font || 'Not specified'}"
    - Color: "${colorHex || 'Not specified'}"
    - Design Style: "${designStyle || 'Not specified'}"
    
    Start with a main title that summarizes the design concept.
    
    Provide your response in this format:
    
    # [MAIN TITLE: DESIGN CONCEPT SUMMARY]
    
    # COLOR PALETTE
    - Primary: #HEXCODE (short description)
    - Secondary: #HEXCODE (short description)
    - Accent 1: #HEXCODE (short description)
    - Accent 2: #HEXCODE (short description)
    
    # TYPOGRAPHY RECOMMENDATIONS
    1. Font Name (style, weight) - specific usage
    2. Font Name (style, weight) - specific usage
    3. Font Name (style, weight) - specific usage
    
    # BRAND INSPIRATION
    1. Brand Name - brief description
    2. Brand Name - brief description
    3. Brand Name - brief description
    
    # DESIGN LANGUAGE RECOMMENDATIONS
    1. Specific design element - explanation
    2. Specific design element - explanation
    3. Specific design element - explanation
    
    # FONT PAIRING RECOMMENDATIONS
    1. Headline: Font Name + Body: Font Name - context
    2. Headline: Font Name + Body: Font Name - context
    3. Headline: Font Name + Body: Font Name - context
    
    # KEY DESIGN ELEMENTS
    1. Element - purpose and impact
    2. Element - purpose and impact
    3. Element - purpose and impact
    
    # LAYOUT SUGGESTIONS
    1. Specific layout for ${industry || 'this industry'} - description
    2. Specific layout for ${industry || 'this industry'} - description
    3. Specific layout for ${industry || 'this industry'} - description
  `;

  try {
    console.log("Attempting generation with gpt-4o-mini...");
    const response = await callOpenAIAPI('gpt-4o-mini', prompt);
    return processOpenAIResponse(response);
  } catch (error) {
    console.error("[Error] OpenAI API Error:", error.response?.data || error.message);
    return `Could not generate AI suggestions. Error: ${error.response?.data?.error?.message || error.message || 'Unknown error'}`;
  }
};

const processOpenAIResponse = (response) => {
  let aiText = response.data.choices?.[0]?.message?.content || "No AI suggestions available.";
  aiText = aiText.replace(/\*\*/g, '');
  aiText = aiText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  aiText = makeLinksClickable(aiText);
  aiText = aiText.replace(/# ([^\n]+)/g, '<h1>$1</h1>');
  aiText = aiText.replace(/## ([^\n]+)/g, '<h2>$1</h2>');
  return aiText;
};

const processGeminiResponse = (response) => {
  let aiText = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No AI suggestions available.";
  aiText = aiText.replace(/\*\*/g, '');
  aiText = aiText.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  aiText = makeLinksClickable(aiText);
  aiText = aiText.replace(/# ([^\n]+)/g, '<h1>$1</h1>');
  aiText = aiText.replace(/## ([^\n]+)/g, '<h2>$1</h2>');
  return aiText;
};

export const extractColorPalette = (aiSuggestions, inputColor = null) => {
  return nlpUtils.extractAdvancedColorPalette(aiSuggestions, inputColor);
};
