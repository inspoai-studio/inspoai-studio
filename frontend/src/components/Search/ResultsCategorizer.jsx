class ResultsCategorizer {
  // Configuration
  static ACCURACY_THRESHOLD = 85; 
  
  /**
   * Categorize array of items based on search parameters
   * @param {Array} items - Array of result items to categorize
   * @param {Object} searchParams - Search parameters object (industry, font, designStyle, color)
   * @param {Boolean} isLoadMore - Whether this is being called from loadMore function
   * @param {Boolean} hasFilters - Whether user applied any filters
   * @returns {Object} Object containing categorized arrays of items
   */
  static categorizeResults(items, searchParams, isLoadMore=false, hasFilters=false) {
    
    if (!items || items.length === 0) return {
      industry: [],
      font: [],
      designStyle: [],
      color: [],
      combined: []
    };
    
    // Add originalIndex to each item if not already present
    const itemsWithIndex = items.map((item, index) => {
      if (item.originalIndex === undefined) {
        return { ...item, originalIndex: index };
      }
      return item;
    });
    
    // UPDATED: If isLoadMore is true AND hasFilters is true, return all results in combined without filtering
    // If isLoadMore is true but hasFilters is false, apply normal categorization
    if (isLoadMore && hasFilters) {
      return {
        industry: [],
        font: [],
        designStyle: [],
        color: [],
        // Just add match scores for display purposes but don't filter by threshold
        combined: itemsWithIndex.map(item => ({
          ...item, 
          matchScore: this.calculateScore(item, 'combined', searchParams)
        }))
      };
    }
    
    // Rest of the categorization logic remains the same...
    const industry = searchParams.industry ? searchParams.industry.toLowerCase() : '';
    const font = searchParams.font ? searchParams.font.toLowerCase() : '';
    const designStyle = searchParams.designStyle ? searchParams.designStyle.toLowerCase() : '';
    const color = searchParams.color ? searchParams.color.toLowerCase() : '';
    
    const categorized = {
      industry: industry ? 
        itemsWithIndex
          .map(item => ({...item, matchScore: this.calculateScore(item, 'industry', searchParams)}))
          .filter(item => item.matchScore >= this.ACCURACY_THRESHOLD)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 12) : [],
          
      font: font ? 
        itemsWithIndex
          .map(item => ({...item, matchScore: this.calculateScore(item, 'font', searchParams)}))
          .filter(item => item.matchScore >= this.ACCURACY_THRESHOLD)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 12) : [],
          
      designStyle: designStyle ? 
        itemsWithIndex
          .map(item => ({...item, matchScore: this.calculateScore(item, 'designStyle', searchParams)}))
          .filter(item => item.matchScore >= this.ACCURACY_THRESHOLD)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 12) : [],
          
      color: color ? 
        itemsWithIndex
          .map(item => ({...item, matchScore: this.calculateScore(item, 'color', searchParams)}))
          .filter(item => item.matchScore >= this.ACCURACY_THRESHOLD)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 12) : [],
          
      combined: 
        itemsWithIndex
          .map(item => ({...item, matchScore: this.calculateScore(item, 'combined', searchParams)}))
          .filter(item => item.matchScore >= this.ACCURACY_THRESHOLD)
          .sort((a, b) => b.matchScore - a.matchScore)
          .slice(0, 20)
    };
    
    return categorized;
  }
  
  /**
   * Calculate match score for an item in a specific category
   * @param {Object} item - Result item to calculate score for
   * @param {String} category - Category to calculate score for ('industry', 'font', 'designStyle', 'color', 'combined')
   * @param {Object} searchParams - Search parameters object
   * @returns {Number} Match score (0-100)
   */
  static calculateScore(item, category, searchParams) {
    let score = 0;
    const industry = searchParams.industry ? searchParams.industry.toLowerCase() : '';
    const font = searchParams.font ? searchParams.font.toLowerCase() : '';
    const designStyle = searchParams.designStyle ? searchParams.designStyle.toLowerCase() : '';
    const color = searchParams.color ? searchParams.color.toLowerCase() : '';
    
    // Get combined text from item for matching
    const itemText = [
      item.title || '',
      item.source || '',
      item.description || '',
      item.snippet || '',
      item.category || ''
    ].join(' ').toLowerCase();
    
    switch(category) {
      case 'industry':
        // Weight industry matches highly if found in title or description
        if (industry && itemText.includes(industry)) {
          score = itemText.includes(`${industry} `) || 
                 itemText.includes(` ${industry}`) ? 
                 100 : 90;
        }
        break;
        
      case 'font':
        // Font family matching
        if (font && itemText.includes(font)) {
          score = 100;
        } else if (font === 'serif' && 
                  (itemText.includes('serif') && !itemText.includes('sans-serif'))) {
          score = 95;
        } else if (font === 'sans-serif' && itemText.includes('sans-serif')) {
          score = 95;
        } else if (font === 'monospace' && 
                  (itemText.includes('monospace') || itemText.includes('code') || 
                   itemText.includes('programming'))) {
          score = 90;
        }
        break;
        
      case 'designStyle':
        // Match design style terms
        if (designStyle && itemText.includes(designStyle)) {
          score = 100;
        } else if (designStyle === 'minimalist' && 
                  (itemText.includes('clean') || itemText.includes('simple'))) {
          score = 90;
        } else if (designStyle === 'modern' && 
                  (itemText.includes('contemporary') || itemText.includes('current'))) {
          score = 90;
        }
        break;
        
      case 'color':
        // For color, we make best-guess matches since we don't have image analysis
        if (color && item.colorMatches) {
          score = item.colorMatches.includes(color) ? 100 : 50;
        } else if (color) {
          // If color is in description, good indicator
          if (itemText.includes(color)) {
            score = 95;
          } else {
            // Assign partial score as default for color category
            score = 60;
          }
        }
        break;
        
      case 'combined':
        // Calculate combined score across all parameters
        let totalFactors = 0;
        let matchedFactors = 0;
        
        if (industry) {
          totalFactors++;
          if (itemText.includes(industry)) matchedFactors++;
        }
        
        if (font) {
          totalFactors++;
          if (itemText.includes(font)) {
            matchedFactors++;
          } else if ((font === 'serif' && itemText.includes('serif') && !itemText.includes('sans-serif')) ||
                     (font === 'sans-serif' && itemText.includes('sans-serif')) ||
                     (font === 'monospace' && (itemText.includes('monospace') || itemText.includes('code')))) {
            matchedFactors += 0.8;
          }
        }
        
        if (designStyle) {
          totalFactors++;
          if (itemText.includes(designStyle)) {
            matchedFactors++;
          } else if ((designStyle === 'minimalist' && (itemText.includes('clean') || itemText.includes('simple'))) ||
                     (designStyle === 'modern' && (itemText.includes('contemporary') || itemText.includes('current')))) {
            matchedFactors += 0.8;
          }
        }
        
        if (color) {
          totalFactors++;
          if (itemText.includes(color)) {
            matchedFactors += 0.9;
          } else {
            // Give partial credit for colors
            matchedFactors += 0.5;
          }
        }
        
        // Calculate percentage
        score = totalFactors > 0 ? (matchedFactors / totalFactors) * 100 : 60;
        break;
    }
    
    return score;
  }
}

export default ResultsCategorizer;