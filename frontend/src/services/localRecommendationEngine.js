// Pinterest-Only LocalRecommendationEngine.js

class LocalRecommendationEngine {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 100;
    this.backendUrl = this.getBackendUrl();

    // Configuration flags
    this.enableBackendPinterest = true;
    this.enableBackendDribbble = true;
    this.enableBackendFreepik = true;
    this.enableBackendMobbin = true;
    this.enableLocalRecommendations = true;

    // Distribution configuration - 5 sources
    this.distributionConfig = {
      local: 0.20,
      pinterest: 0.20,
      dribbble: 0.20,
      freepik: 0.20,
      mobbin: 0.20
    };

    this.totalAssetCount = 0;
    this.statsFetched = false;
  }

  // Get backend URL from environment or default
  getBackendUrl() {
    try {
      if (typeof process !== 'undefined' && process.env && process.env.REACT_APP_BACKEND_URL) {
        return process.env.REACT_APP_BACKEND_URL;
      }
      if (typeof window !== 'undefined' && window.location) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          return 'http://localhost:3001';
        }
        // Assuming VITE_API_URL is available in a modern frontend build setup
        // If not, this might need adjustment based on the actual build system (e.g., process.env.REACT_APP_API_URL for Create React App)
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) {
          return import.meta.env.VITE_API_URL;
        }
        return 'https://your-production-backend.com'; // Replace with your actual backend URL
      }
      return 'http://localhost:3001'; // Default for non-browser/non-process environments
    } catch (error) {
      console.warn('Could not detect backend URL:', error);
      return 'http://localhost:3001';
    }
  }

  // MAIN METHOD - Enhanced with Pinterest scraping + Local recommendations
  async generateRecommendations(targetImage, allResults, limit = 12, offset = 0, authToken = null) {
    if (!this.statsFetched) {
      await this.fetchAssetStats();
    }

    // Dynamic Distribution adjust based on library size
    if (this.totalAssetCount >= 100000) {
      this.distributionConfig = {
        local: 0.40,
        pinterest: 0.15,
        dribbble: 0.15,
        freepik: 0.15,
        mobbin: 0.15
      };
    } else if (this.totalAssetCount >= 10000) {
      this.distributionConfig = {
        local: 0.10, // 10% from library
        pinterest: 0.225,
        dribbble: 0.225,
        freepik: 0.225,
        mobbin: 0.225
      };
    }


    const cacheKey = `${targetImage._internalId}_${allResults.length}_${limit}_${offset}_pinterest_v1`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const startTime = performance.now();

    try {
      let localLimit = limit;
      let pinterestLimit = 0;
      let dribbbleLimit = 0;
      let freepikLimit = 0;
      let mobbinLimit = 0;

      // If we are loading more (offset > 0), prioritize Backend Sources
      if (offset > 0) {
        localLimit = Math.ceil(limit * 0.1);
        const remaining = limit - localLimit;
        pinterestLimit = Math.floor(remaining / 4);
        dribbbleLimit = Math.floor(remaining / 4);
        freepikLimit = Math.floor(remaining / 4);
        mobbinLimit = remaining - pinterestLimit - dribbbleLimit - freepikLimit;

        if (allResults.length < 10) {
          localLimit = 0;
          pinterestLimit = Math.floor(limit / 4);
          dribbbleLimit = Math.floor(limit / 4);
          freepikLimit = Math.floor(limit / 4);
          mobbinLimit = limit - pinterestLimit - dribbbleLimit - freepikLimit;
        }
      } else if (allResults.length >= 3) {
        localLimit = Math.ceil(limit * this.distributionConfig.local);
        const remaining = limit - localLimit;
        pinterestLimit = Math.ceil(remaining / 4);
        dribbbleLimit = Math.ceil(remaining / 4);
        freepikLimit = Math.ceil(remaining / 4);
        mobbinLimit = remaining - pinterestLimit - dribbbleLimit - freepikLimit;
      }

      // Handle disabled sources - Naive redistribution
      if (!this.enableBackendPinterest) pinterestLimit = 0;
      if (!this.enableBackendDribbble) dribbbleLimit = 0;
      if (!this.enableBackendFreepik) freepikLimit = 0;
      if (!this.enableBackendMobbin) mobbinLimit = 0;


      // Generate recommendations from all sources in parallel
      const [localResults, pinterestResults, dribbbleResults, freepikResults, mobbinResults] = await Promise.allSettled([
        this.totalAssetCount > 0
          ? this.getBackendLocalRecommendations(targetImage, localLimit + 5, offset, authToken)
          : this.generateDiverseRecommendations(targetImage, allResults, localLimit + 5, offset),
        this.enableBackendPinterest ? this.getBackendPinterestRecommendations(targetImage, pinterestLimit, offset, authToken) : [],
        this.enableBackendDribbble ? this.getBackendDribbbleRecommendations(targetImage, dribbbleLimit, offset, authToken) : [],
        this.enableBackendFreepik ? this.getBackendFreepikRecommendations(targetImage, freepikLimit, offset, authToken) : [],
        this.enableBackendMobbin ? this.getBackendMobbinRecommendations(targetImage, mobbinLimit, offset, authToken) : []
      ]);

      // Process results from settled promises
      const localRecommendations = localResults.status === 'fulfilled' ? localResults.value : [];
      const pinRecommendations = pinterestResults.status === 'fulfilled' ? pinterestResults.value : [];
      const dribRecommendations = dribbbleResults.status === 'fulfilled' ? dribbbleResults.value : [];
      const freeRecommendations = freepikResults.status === 'fulfilled' ? freepikResults.value : [];
      const mobRecommendations = mobbinResults.status === 'fulfilled' ? mobbinResults.value : [];

      if (dribbbleResults.status === 'rejected') console.warn('[Warning] Dribbble recommendations failed:', dribbbleResults.reason?.message);
      if (freepikResults.status === 'rejected') console.warn('[Warning] Freepik recommendations failed:', freepikResults.reason?.message);
      if (mobbinResults.status === 'rejected') console.warn('[Warning] Mobbin recommendations failed:', mobbinResults.reason?.message);

      // Combine and diversify results
      const allRecommendations = this.combineAndDiversifyResults([
        ...localRecommendations,
        ...pinRecommendations,
        ...dribRecommendations,
        ...freeRecommendations,
        ...mobRecommendations
      ], targetImage);

      this.cacheResults(cacheKey, allRecommendations);

      const endTime = performance.now();

      return allRecommendations.slice(0, limit);

    } catch (error) {
      console.error('[Error] Error generating recommendations:', error);
      // Fallback to local only
      const localOnly = this.generateDiverseRecommendations(targetImage, allResults, limit, offset);
      this.cacheResults(cacheKey, localOnly);
      return localOnly;
    }
  }

  // Backend Pinterest Integration
  async getBackendPinterestRecommendations(targetImage, limit, offset = 0, authToken = null) {
    try {
      const searchQuery = this.createEnhancedPinterestSearchQuery(targetImage);

      // Request slightly more to allow for filtering
      // If offset > 0, we might want to request *more* to skip, or rely on scraper randomness
      // Since scraper is stateless, we can't truly "skip" without overhead.
      // Strategy: Request (limit + offset) and slice the end.
      const totalToRequest = limit + offset + 5;
      // Cap at 60 to avoid excessive timeouts, allowing ~3 pages of results
      const requestLimit = Math.min(totalToRequest, 60);

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.backendUrl}/api/discover-p`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: searchQuery,
          limit: requestLimit
        })
      });

      if (!response.ok) {
        // ... error handling ... 
        const errorData = await response.json().catch(() => ({}));
        console.error('[Error] Pinterest backend error:', response.status, errorData);
        return [];
      }

      const data = await response.json();

      if (data.success && data.results && Array.isArray(data.results)) {
        let validResults = data.results;

        // If we requested significantly more than limit (due to offset), 
        // take the slice that corresponds to the "new" items.
        // E.g. limit=10, offset=10. Request=20. Return items 10-20.
        if (validResults.length > limit && offset > 0) {
          // If we got enough results to strictly offset
          if (validResults.length >= limit + offset) {
            return validResults.slice(offset, offset + limit);
          } else {
            // We didn't get enough to fully offset. Return the *last* 'limit' items.
            return validResults.slice(-limit);
          }
        }

        return validResults.slice(0, limit);
      } else {
        return [];
      }

    } catch (error) {
      console.error('[Error] Backend Pinterest request failed:', error.message);
      return [];
    }
  }

  // Backend Dribbble Integration
  async getBackendDribbbleRecommendations(targetImage, limit, offset = 0, authToken = null) {
    try {
      const searchQuery = this.createEnhancedPinterestSearchQuery(targetImage); // Reuse enhanced query logic

      const totalToRequest = limit + offset + 5;
      const requestLimit = Math.min(totalToRequest, 40);

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.backendUrl}/api/discover-d`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: searchQuery,
          limit: requestLimit
        })
      });

      if (!response.ok) {
        console.error('[Error] Dribbble backend error:', response.status);
        return [];
      }

      const data = await response.json();

      if (data.success && data.results && Array.isArray(data.results)) {
        let validResults = data.results;
        if (validResults.length > limit && offset > 0) {
          if (validResults.length >= limit + offset) {
            return validResults.slice(offset, offset + limit);
          } else {
            return validResults.slice(-limit);
          }
        }
        return validResults.slice(0, limit);
      } else {
        return [];
      }
    } catch (error) {
      console.error('[Error] Backend Dribbble request failed:', error.message);
      return [];
    }
  }

  // Backend Freepik Integration
  async getBackendFreepikRecommendations(targetImage, limit, offset = 0, authToken = null) {
    try {
      const searchQuery = this.createEnhancedPinterestSearchQuery(targetImage);

      // Request slightly more
      const requestLimit = Math.min(limit + offset + 5, 40);

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.backendUrl}/api/freepik-search-recommendations`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: searchQuery,
          limit: requestLimit
        })
      });

      if (!response.ok) return [];

      const data = await response.json();

      if (data.success && data.results) {
        let validResults = data.results;
        if (validResults.length > limit && offset > 0) {
          if (validResults.length >= limit + offset) {
            return validResults.slice(offset, offset + limit);
          } else {
            return validResults.slice(-limit);
          }
        }
        return validResults.slice(0, limit);
      }
      return [];
    } catch (error) {
      console.error('[Error] Backend Freepik request failed:', error.message);
      return [];
    }
  }

  // Backend Asset Stats
  async fetchAssetStats() {
    try {
      const response = await fetch(`${this.backendUrl}/api/asset-stats`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          this.totalAssetCount = data.count || 0;
          this.statsFetched = true;
        }
      }
    } catch (error) {
      console.error('[Error] Failed to fetch asset stats:', error.message);
    }
  }

  // Backend Local Supabase Integration
  async getBackendLocalRecommendations(targetImage, limit, offset = 0, authToken = null) {
    try {
      const searchQuery = targetImage.title || 'design';

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

      const response = await fetch(`${this.backendUrl}/api/local-assets`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: searchQuery,
          limit: limit + offset
        })
      });

      if (!response.ok) return [];
      const data = await response.json();

      if (data.success && data.results) {
        return data.results.slice(offset, offset + limit);
      }
      return [];
    } catch (error) {
      console.error('[Error] Backend Local request failed:', error.message);
      return [];
    }
  }

  // Backend Mobbin Integration
  async getBackendMobbinRecommendations(targetImage, limit, offset = 0, authToken = null) {
    try {
      const searchQuery = this.createEnhancedPinterestSearchQuery(targetImage);

      const requestLimit = Math.min(limit + offset + 5, 40);

      const headers = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${this.backendUrl}/api/discover-m`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          topic: searchQuery,
          limit: requestLimit
        })
      });

      if (!response.ok) return [];

      const data = await response.json();

      if (data.success && data.results) {
        let validResults = data.results;
        if (validResults.length > limit && offset > 0) {
          if (validResults.length >= limit + offset) {
            return validResults.slice(offset, offset + limit);
          } else {
            return validResults.slice(-limit);
          }
        }
        return validResults.slice(0, limit);
      }
      return [];
    } catch (error) {
      console.error('[Error] Backend Mobbin request failed:', error.message);
      return [];
    }
  }

  // Create enhanced Pinterest search query
  createEnhancedPinterestSearchQuery(targetImage) {
    const title = targetImage.title || '';
    const analysis = this.analyzeImageIntelligently(targetImage);

    const keywords = this.extractQualityKeywords(title);
    let searchQuery = keywords;

    if (analysis.category === 'ui' || analysis.category === 'mobile-ui' || analysis.category === 'web-ui') {
      searchQuery += ' ui interface design app';
    } else if (analysis.category === 'website' || analysis.category === 'web') {
      searchQuery += ' web design layout website';
    } else if (analysis.category === 'logo' || analysis.category === 'branding') {
      searchQuery += ' logo branding identity design';
    } else if (analysis.category === 'poster' || analysis.category === 'print') {
      searchQuery += ' graphic design poster print';
    } else if (analysis.category === 'illustration') {
      searchQuery += ' illustration art design creative';
    } else {
      searchQuery += ' design creative inspiration';
    }

    if (analysis.style && analysis.style.length > 0) {
      const mainStyle = analysis.style[0];
      if (['minimal', 'modern', 'vintage', 'bold', 'elegant'].includes(mainStyle)) {
        searchQuery += ` ${mainStyle}`;
      }
    }

    if (analysis.colors && analysis.colors !== 'modern' && analysis.colors !== 'general') {
      searchQuery += ` ${analysis.colors}`;
    }

    const words = searchQuery.split(' ')
      .filter(word => word.length > 2)
      .filter((word, index, arr) => arr.indexOf(word) === index)
      .slice(0, 6);

    return words.join(' ').trim();
  }

  // Extract quality keywords for Pinterest
  extractQualityKeywords(title) {
    if (!title) return 'design';

    const designWords = [
      'ui', 'ux', 'interface', 'web', 'app', 'mobile', 'website', 'dashboard',
      'logo', 'brand', 'branding', 'identity', 'graphic', 'design', 'layout',
      'poster', 'flyer', 'banner', 'card', 'template', 'mockup', 'wireframe',
      'typography', 'font', 'color', 'palette', 'illustration', 'icon',
      'minimal', 'modern', 'vintage', 'clean', 'creative', 'professional',
      'business', 'corporate', 'startup', 'portfolio', 'landing', 'homepage'
    ];

    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .filter(word => designWords.includes(word))
      .slice(0, 4);

    return words.length > 0 ? words.join(' ') : 'design';
  }

  // Combine and diversify results from Pinterest and local sources
  combineAndDiversifyResults(allResults, targetImage) {
    if (!allResults || allResults.length === 0) {
      return [];
    }

    // Remove duplicates based on image URL and similar titles
    const seenUrls = new Set();
    const seenTitles = new Set();
    const uniqueResults = allResults.filter(item => {
      const url = item.image?.image;
      const title = item.image?.title?.toLowerCase().substring(0, 50);

      if (!url || seenUrls.has(url)) {
        return false;
      }

      // Check for very similar titles
      const isSimilarTitle = Array.from(seenTitles).some(existingTitle => {
        const similarity = this.calculateStringSimilarity(title, existingTitle);
        return similarity > 0.8;
      });

      if (isSimilarTitle) {
        return false;
      }

      seenUrls.add(url);
      seenTitles.add(title);
      return true;
    });

    // Group by source for balanced distribution
    const sourceGroups = {
      'Local': [],
      'Pinterest': [],
      'Dribbble': [],
      'Freepik': [],
      'Mobbin': []
    };

    uniqueResults.forEach(item => {
      const source = item.image?.source || 'Unknown';
      if (sourceGroups[source]) {
        sourceGroups[source].push(item);
      } else {
        // Handle any unknown sources by adding to Local
        sourceGroups['Local'].push(item);
      }
    });

    // Interleave results for diversity while maintaining quality
    const interleavedResults = [];
    const maxLength = Math.max(...Object.values(sourceGroups).map(group => group.length));

    for (let i = 0; i < maxLength; i++) {
      // Add one from each source in round-robin fashion
      ['Mobbin', 'Local', 'Freepik', 'Dribbble', 'Pinterest'].forEach(source => {
        if (sourceGroups[source][i]) {
          interleavedResults.push(sourceGroups[source][i]);
        }
      });
    }

    // Final sort by similarity with small diversity factor
    return interleavedResults
      .sort((a, b) => {
        const similarityDiff = (b.similarity || 0) - (a.similarity || 0);
        const diversityFactor = (Math.random() - 0.5) * 0.05;
        return similarityDiff + diversityFactor;
      })
      .slice(0, Math.min(interleavedResults.length, 50));
  }

  // Helper function for string similarity calculation
  calculateStringSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;

    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance calculation
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // LOCAL RECOMMENDATION METHODS
  generateDiverseRecommendations(targetImage, allResults, limit, offset = 0) {

    const recommendations = [];
    const usedIds = new Set([targetImage._internalId]);
    const targetFeatures = this.extractImageFeatures(targetImage);

    const buckets = {
      titleSimilar: [],
      sourceDifferent: [],
      styleSimilar: [],
      colorSimilar: [],
      random: []
    };

    allResults.forEach(img => {
      if (usedIds.has(img._internalId)) return;
      const imgFeatures = this.extractImageFeatures(img);

      if (this.calculateTitleSimilarity(targetFeatures, imgFeatures) > 0.3) {
        buckets.titleSimilar.push({
          image: img,
          similarity: this.calculateTitleSimilarity(targetFeatures, imgFeatures),
          reason: 'Similar content theme'
        });
      }

      if (img.source !== targetImage.source) {
        buckets.sourceDifferent.push({
          image: img,
          similarity: 0.6 + Math.random() * 0.2,
          reason: `Fresh perspective from ${img.source}`
        });
      }

      const styleScore = this.calculateStyleSimilarity(targetFeatures, imgFeatures);
      if (styleScore > 0.4) {
        buckets.styleSimilar.push({
          image: img,
          similarity: styleScore,
          reason: 'Similar design style'
        });
      }

      const colorScore = this.calculateColorSimilarity(targetFeatures, imgFeatures);
      if (colorScore > 0.4) {
        buckets.colorSimilar.push({
          image: img,
          similarity: colorScore,
          reason: 'Similar color palette'
        });
      }

      buckets.random.push({
        image: img,
        similarity: 0.3 + Math.random() * 0.4,
        reason: 'Discover new designs'
      });
    });

    Object.keys(buckets).forEach(key => {
      buckets[key].sort((a, b) => b.similarity - a.similarity);
    });

    const distribution = this.calculateDistribution(limit, buckets);

    Object.entries(distribution).forEach(([bucketName, count]) => {
      const bucket = buckets[bucketName];
      const selected = bucket.slice(0, count);

      selected.forEach(item => {
        if (recommendations.length < limit && !usedIds.has(item.image._internalId)) {
          recommendations.push({
            image: item.image,
            similarity: item.similarity,
            reasons: [item.reason]
          });
          usedIds.add(item.image._internalId);
        }
      });
    });

    if (recommendations.length < limit) {
      const remaining = allResults
        .filter(img => !usedIds.has(img._internalId))
        .sort(() => Math.random() - (0.5 + (offset % 5) * 0.05)) // Use offset to shift sort slightly
        .slice(0, limit - recommendations.length);

      remaining.forEach(img => {
        recommendations.push({
          image: img,
          similarity: 0.4 + Math.random() * 0.3,
          reasons: ['Related design']
        });
      });
    }

    return recommendations.slice(0, limit);
  }

  calculateDistribution(limit, buckets) {
    const distribution = {};
    const availableBuckets = Object.entries(buckets).filter(([_, bucket]) => bucket.length > 0);

    if (availableBuckets.length === 0) {
      return { random: limit };
    }

    const baseDistribution = {
      titleSimilar: 0.25,
      styleSimilar: 0.20,
      colorSimilar: 0.15,
      sourceDifferent: 0.25,
      random: 0.15
    };

    availableBuckets.forEach(([bucketName, bucket]) => {
      const targetCount = Math.ceil(limit * baseDistribution[bucketName]);
      const availableCount = bucket.length;
      distribution[bucketName] = Math.min(targetCount, availableCount);
    });

    const totalAssigned = Object.values(distribution).reduce((sum, count) => sum + count, 0);
    if (totalAssigned < limit) {
      const largestBucket = availableBuckets.reduce((largest, [name, bucket]) =>
        bucket.length > (buckets[largest] || []).length ? name : largest,
        availableBuckets[0][0]
      );
      distribution[largestBucket] = (distribution[largestBucket] || 0) + (limit - totalAssigned);
    }

    return distribution;
  }

  extractImageFeatures(image) {
    return {
      titleWords: this.extractTitleWords(image.title),
      source: image.source,
      styleKeywords: this.extractStyleKeywords(image.title),
      colorKeywords: this.extractColorKeywords(image.title),
      url: image.url
    };
  }

  extractTitleWords(title) {
    if (!title) return [];
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    return title
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .slice(0, 10);
  }

  extractStyleKeywords(title) {
    if (!title) return [];
    const styleKeywords = {
      minimal: ['minimal', 'clean', 'simple', 'modern', 'sleek'],
      vintage: ['vintage', 'retro', '90s', 'classic', 'old'],
      bold: ['bold', 'vibrant', 'striking', 'dramatic'],
      elegant: ['elegant', 'sophisticated', 'luxury', 'premium'],
      playful: ['playful', 'fun', 'creative', 'colorful'],
      corporate: ['corporate', 'business', 'professional']
    };

    const text = title.toLowerCase();
    const foundStyles = [];
    Object.entries(styleKeywords).forEach(([style, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        foundStyles.push(style);
      }
    });
    return foundStyles;
  }

  extractColorKeywords(title) {
    if (!title) return [];
    const colorKeywords = ['blue', 'red', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'gray', 'black', 'white', 'dark', 'light', 'colorful'];
    const text = title.toLowerCase();
    return colorKeywords.filter(color => text.includes(color));
  }

  calculateTitleSimilarity(features1, features2) {
    const words1 = features1.titleWords;
    const words2 = features2.titleWords;
    if (!words1.length || !words2.length) return 0;
    const intersection = words1.filter(word => words2.includes(word)).length;
    const union = new Set([...words1, ...words2]).size;
    return union > 0 ? intersection / union : 0;
  }

  calculateStyleSimilarity(features1, features2) {
    const styles1 = features1.styleKeywords;
    const styles2 = features2.styleKeywords;
    if (!styles1.length || !styles2.length) return 0;
    const commonStyles = styles1.filter(style => styles2.includes(style)).length;
    const totalStyles = new Set([...styles1, ...styles2]).size;
    return totalStyles > 0 ? commonStyles / totalStyles : 0;
  }

  calculateColorSimilarity(features1, features2) {
    const colors1 = features1.colorKeywords;
    const colors2 = features2.colorKeywords;
    if (!colors1.length || !colors2.length) return 0;
    const commonColors = colors1.filter(color => colors2.includes(color)).length;
    const totalColors = new Set([...colors1, ...colors2]).size;
    return totalColors > 0 ? commonColors / totalColors : 0;
  }

  // Image analysis methods
  analyzeImageIntelligently(targetImage) {
    const title = (targetImage.title || '').toLowerCase();

    return {
      category: this.detectCategory(title),
      style: this.detectStyle(title),
      colors: this.detectColors(title),
      industry: this.detectIndustry(title)
    };
  }

  detectCategory(title) {
    if (title.includes('ui') || title.includes('app') || title.includes('interface')) return 'ui';
    if (title.includes('web') || title.includes('website') || title.includes('landing')) return 'web';
    if (title.includes('logo') || title.includes('brand') || title.includes('identity')) return 'branding';
    if (title.includes('poster') || title.includes('print') || title.includes('flyer')) return 'print';
    if (title.includes('motion') || title.includes('video') || title.includes('animation')) return 'motion';
    if (title.includes('illustration') || title.includes('art') || title.includes('drawing')) return 'illustration';
    return 'general';
  }

  detectStyle(title) {
    if (title.includes('minimal') || title.includes('clean') || title.includes('simple')) return ['minimal'];
    if (title.includes('modern') || title.includes('contemporary')) return ['modern'];
    if (title.includes('vintage') || title.includes('retro') || title.includes('classic')) return ['vintage'];
    if (title.includes('bold') || title.includes('vibrant') || title.includes('striking')) return ['bold'];
    if (title.includes('elegant') || title.includes('sophisticated') || title.includes('luxury')) return ['elegant'];
    return ['modern'];
  }

  detectColors(title) {
    if (title.includes('blue')) return 'blue';
    if (title.includes('red')) return 'red';
    if (title.includes('green')) return 'green';
    if (title.includes('dark') || title.includes('black')) return 'dark';
    if (title.includes('light') || title.includes('white')) return 'light';
    if (title.includes('colorful') || title.includes('vibrant')) return 'colorful';
    return 'modern';
  }

  detectIndustry(title) {
    if (title.includes('tech') || title.includes('software') || title.includes('app')) return 'tech';
    if (title.includes('finance') || title.includes('bank') || title.includes('fintech')) return 'finance';
    if (title.includes('health') || title.includes('medical') || title.includes('healthcare')) return 'healthcare';
    if (title.includes('education') || title.includes('school') || title.includes('learning')) return 'education';
    if (title.includes('ecommerce') || title.includes('shop') || title.includes('store')) return 'ecommerce';
    return 'general';
  }

  // Configuration and management methods
  cacheResults(key, results) {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, results);
  }

  clearCache() {
    this.cache.clear();
  }

  setBackendUrl(url) {
    this.backendUrl = url;
    return this;
  }

  enablePinterestScraping(enabled = true) {
    this.enableBackendPinterest = enabled;
    return this;
  }

  setDistributionConfig(config) {
    this.distributionConfig = { ...this.distributionConfig, ...config };
    return this;
  }

  // Get comprehensive engine stats
  getStats() {
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.maxCacheSize,
      backendUrl: this.backendUrl,
      pinterestEnabled: this.enableBackendPinterest,
      localRecommendationsEnabled: this.enableLocalRecommendations,
      distributionConfig: this.distributionConfig,
      features: [
        'Backend Pinterest Integration',
        'Local Dataset Analysis',
        'Smart Recommendation Caching',
        'Intelligent Image Analysis',
        'Multi-Source Diversification',
        'Duplicate Detection & Removal',
        'Error Recovery & Fallbacks'
      ]
    };
  }

  // Health check
  async healthCheck() {
    try {
      const stats = this.getStats();

      // Test backend connectivity
      let backendStatus = 'unknown';
      try {
        const response = await fetch(`${this.backendUrl}/health`, {
          method: 'GET',
          timeout: 5000
        });
        backendStatus = response.ok ? 'healthy' : 'unhealthy';
      } catch (error) {
        backendStatus = 'unreachable';
      }

      return {
        status: 'healthy',
        backend: backendStatus,
        ...stats,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Emergency mode - disable Pinterest if needed
  enableEmergencyMode() {
    this.enableBackendPinterest = false;
    this.distributionConfig = {
      local: 1.0,
      pinterest: 0
    };
    return this;
  }

  // Restore normal operation
  disableEmergencyMode() {
    this.enableBackendPinterest = true;
    this.distributionConfig = {
      local: 0.6,
      pinterest: 0.4
    };
    return this;
  }

  // Deprecated methods (keeping for backward compatibility)
  togglePinterest(enabled = true) {
    console.warn('[Warning] togglePinterest is deprecated. Use enablePinterestScraping instead.');
    return this.enablePinterestScraping(enabled);
  }

  getCacheStats() {
    console.warn('[Warning] getCacheStats is deprecated. Use getStats instead.');
    return this.getStats();
  }
}

// Specialized engine classes for different use cases

// Local-Only Engine (Emergency fallback)
class LocalOnlyRecommendationEngine extends LocalRecommendationEngine {
  constructor() {
    super();
    this.enableBackendPinterest = false;
    this.distributionConfig = {
      local: 1.0,
      pinterest: 0
    };
  }
}

// Pinterest-Enhanced Engine (Main version)
class PinterestRecommendationEngine extends LocalRecommendationEngine {
  constructor() {
    super();
  }
}

// Export the main class and specialized variants
export default LocalRecommendationEngine;
export {
  LocalOnlyRecommendationEngine,
  PinterestRecommendationEngine
};

// Export singleton instance
export const localRecommendationEngine = new PinterestRecommendationEngine();