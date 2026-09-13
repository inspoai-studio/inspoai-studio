import axios from 'axios';
import https from 'https';
import dotenv from 'dotenv';

// Optimized client with Keep-Alive
const apiClient = axios.create({
  httpsAgent: new https.Agent({ keepAlive: true }),
  timeout: 10000
});

dotenv.config();

class GoogleAPIManager {
  constructor() {
    this.apiKeys = [];
    this.searchEngineIds = [];
    this.keyStatus = [];
    this.currentKeyIndex = -1;

    this.initialize();
  }

  initialize() {
    console.log('Initializing Google API Manager with unlimited key support...');

    // Try all three loading methods in sequence, accumulating keys
    this.loadJsonArrays();
    this.loadNumberedKeys();
    this.loadDefaultKey();

    console.log(`Successfully loaded ${this.apiKeys.length} Google API keys`);

    // Initialize status tracking for each key
    this.keyStatus = this.apiKeys.map((_, index) => ({
      index,
      quotaExceeded: false,
      callsToday: 0,
      lastReset: new Date().setHours(0, 0, 0, 0)
    }));

    // Set current key index to the first available key
    this.currentKeyIndex = this.apiKeys.length > 0 ? 0 : -1;

    // Setup daily reset
    this.setupDailyReset();
  }

  // Load API keys from JSON arrays in environment variables
  loadJsonArrays() {
    if (process.env.GOOGLE_API_KEYS && process.env.GOOGLE_SEARCH_ENGINE_IDS) {
      try {
        // Make sure the variables are actually defined before parsing
        const apiKeysStr = process.env.GOOGLE_API_KEYS.trim();
        const searchEngineIdsStr = process.env.GOOGLE_SEARCH_ENGINE_IDS.trim();

        if (apiKeysStr && searchEngineIdsStr) {
          // Parse JSON array from environment variable
          const parsedKeys = JSON.parse(apiKeysStr);
          const parsedIds = JSON.parse(searchEngineIdsStr);

          // Validate that we got arrays
          if (Array.isArray(parsedKeys) && Array.isArray(parsedIds)) {
            // If arrays have different lengths, use the shorter one
            const minLength = Math.min(parsedKeys.length, parsedIds.length);

            if (parsedKeys.length !== parsedIds.length) {
              console.warn(`[Warning] WARNING: GOOGLE_API_KEYS (${parsedKeys.length} items) and GOOGLE_SEARCH_ENGINE_IDS (${parsedIds.length} items) arrays have different lengths. Using the first ${minLength} items from each.`);
            }

            // Add each valid key-id pair
            for (let i = 0; i < minLength; i++) {
              // Skip if key is empty or null
              if (!parsedKeys[i] || !parsedIds[i]) continue;

              // Check for duplicates before adding
              if (!this.apiKeys.includes(parsedKeys[i])) {
                this.apiKeys.push(parsedKeys[i]);
                this.searchEngineIds.push(parsedIds[i]);
              }
            }

            console.log(`Loaded ${minLength} Google API keys from JSON arrays`);
          } else {
            console.error('[Error] Error with Google API keys: Parsed values are not arrays');
          }
        }
      } catch (error) {
        console.error('[Error] Error parsing Google API keys from JSON:', error.message);
        console.log('TIP: Make sure your JSON arrays are formatted correctly with double quotes and no spaces after commas');
        console.log('Example: ["key1","key2","key3"]');
      }
    }
  }

  loadNumberedKeys() {
    let index = 1;
    let keysLoaded = 0;
    let continueLoading = true;

    while (continueLoading) {
      const keyName = `GOOGLE_API_KEY_${index}`;
      const cxName = `GOOGLE_SEARCH_ENGINE_ID_${index}`;

      if (process.env[keyName] && process.env[cxName]) {
        const key = process.env[keyName];
        const cx = process.env[cxName];

        // Only add if this key isn't already in our array
        if (!this.apiKeys.includes(key)) {
          this.apiKeys.push(key);
          this.searchEngineIds.push(cx);
          keysLoaded++;
        }

        index++;
      } else {
        // Stop when we can't find the next numbered key
        continueLoading = false;
      }

      // Safety check - don't loop forever if something goes wrong
      if (index > 100) {
        console.warn('[Warning] Stopped loading numbered keys after 100 attempts - this may indicate an issue');
        break;
      }
    }

    if (keysLoaded > 0) {
      console.log(`Loaded ${keysLoaded} Google API keys from numbered variables`);
    }
  }

  // Load the default key as fallback
  loadDefaultKey() {
    if (process.env.GOOGLE_API_KEY && process.env.GOOGLE_SEARCH_ENGINE_ID) {
      const key = process.env.GOOGLE_API_KEY;

      // Only add if this key isn't already in our array
      if (!this.apiKeys.includes(key)) {
        this.apiKeys.push(key);
        this.searchEngineIds.push(process.env.GOOGLE_SEARCH_ENGINE_ID);
        console.log('Loaded default Google API key');
      }
    }
  }

  // Daily reset of usage counts
  setupDailyReset() {
    const resetQuotas = () => {
      const today = new Date().setHours(0, 0, 0, 0);

      this.keyStatus.forEach(status => {
        if (today > status.lastReset) {
          console.log(`Resetting quota for Google API key ${status.index}`);
          status.callsToday = 0;
          status.quotaExceeded = false;
          status.lastReset = today;
        }
      });
    };

    // Reset quotas immediately (in case server was down during day change)
    resetQuotas();

    // Schedule daily reset at midnight
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeUntilMidnight = midnight - now;

    setTimeout(() => {
      resetQuotas();
      // Setup next day's reset
      setInterval(resetQuotas, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
  }

  // Get the next available API key
  getNextAvailableKey() {
    // If no keys are available, return null
    if (this.apiKeys.length === 0) {
      return null;
    }

    const MAX_CALLS_PER_DAY = 90; // Free tier is 100, using 90 to be safe

    for (let attempt = 0; attempt < this.apiKeys.length; attempt++) {
      // Move to the next key in the rotation
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

      const status = this.keyStatus[this.currentKeyIndex];

      // Reset quota if it's a new day
      const today = new Date().setHours(0, 0, 0, 0);
      if (today > status.lastReset) {
        status.callsToday = 0;
        status.quotaExceeded = false;
        status.lastReset = today;
      }

      // Check if this key is available
      if (!status.quotaExceeded && status.callsToday < MAX_CALLS_PER_DAY) {
        return {
          key: this.apiKeys[this.currentKeyIndex],
          cx: this.searchEngineIds[this.currentKeyIndex],
          index: this.currentKeyIndex
        };
      }
    }

    // If we've gone through all keys and none are available, return null
    return null;
  }

  // Get current key status
  getCurrentKeyStatus() {
    if (this.apiKeys.length === 0 || this.currentKeyIndex < 0 || this.currentKeyIndex >= this.keyStatus.length) {
      return null;
    }
    return this.keyStatus[this.currentKeyIndex];
  }

  // Mark current key as quota exceeded
  markCurrentKeyQuotaExceeded() {
    if (this.apiKeys.length === 0 || this.currentKeyIndex < 0 || this.currentKeyIndex >= this.keyStatus.length) {
      return;
    }
    const status = this.keyStatus[this.currentKeyIndex];
    status.quotaExceeded = true;
    console.warn(`[Warning] Google API key ${this.currentKeyIndex} quota exceeded`);
  }

  // Increment call counter for current key
  incrementCallCounter() {
    if (this.apiKeys.length === 0 || this.currentKeyIndex < 0 || this.currentKeyIndex >= this.keyStatus.length) {
      return;
    }
    const status = this.keyStatus[this.currentKeyIndex];
    status.callsToday++;
    console.log(`Google API key ${this.currentKeyIndex} call count: ${status.callsToday}`);
  }

  // Check if any API keys are available
  hasAvailableKeys() {
    if (this.apiKeys.length === 0) {
      return false;
    }

    const MAX_CALLS_PER_DAY = 90;
    const today = new Date().setHours(0, 0, 0, 0);

    return this.keyStatus.some(status => {
      // Reset if it's a new day
      if (today > status.lastReset) {
        status.callsToday = 0;
        status.quotaExceeded = false;
        status.lastReset = today;
      }

      return !status.quotaExceeded && status.callsToday < MAX_CALLS_PER_DAY;
    });
  }

  // Get API usage stats
  getStats() {
    const MAX_CALLS_PER_DAY = 90;
    return {
      totalKeys: this.apiKeys.length,
      availableKeys: this.apiKeys.length > 0 ?
        this.keyStatus.filter(k => !k.quotaExceeded && k.callsToday < MAX_CALLS_PER_DAY).length : 0,
      keyUsage: this.keyStatus.map(k => ({
        index: k.index,
        callsToday: k.callsToday,
        quotaExceeded: k.quotaExceeded
      }))
    };
  }

  // Execute Google search with automatic fallback
  async executeSearch(params) {
    // Check if we have any available keys before proceeding
    if (!this.hasAvailableKeys()) {
      console.error("[Error] All Google API keys have exceeded their quota or no keys are available");
      throw new Error("All Google API keys have exceeded their quota or no keys are available");
    }

    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      attempts++;

      // Get the next available key
      const keyData = this.getNextAvailableKey();

      // If no keys are available, throw an error
      if (!keyData) {
        console.error("[Error] All Google API keys have exceeded their quota");
        throw new Error("All Google API keys have exceeded their quota");
      }

      try {
        console.log(`Using Google API key ${keyData.index} for search`);

        // Increment the call counter before making the request
        this.incrementCallCounter();

        // Make the request using the current key
        const response = await apiClient.get("https://www.googleapis.com/customsearch/v1", {
          params: {
            ...params,
            key: keyData.key,
            cx: keyData.cx
          },
          timeout: 10000 // Increased timeout for more reliable requests
        });

        // If successful, return the results
        return response.data;
      } catch (error) {
        // Check if error is quota exceeded or access denied
        if (error.response?.status === 429 ||
          error.response?.status === 403 ||
          error.response?.status === 400 ||
          (error.response?.data?.error?.message && error.response.data.error.message.includes('Quota exceeded')) ||
          (typeof error.message === 'string' && error.message.includes('Quota exceeded'))) {

          // Mark the current key as quota exceeded
          this.markCurrentKeyQuotaExceeded();

          // Log the quota error
          console.warn(`[Warning] Google API key ${keyData.index} quota exceeded, trying next key...`);

          // Continue the loop to try the next key
          continue;
        }

        // For other errors, log and try the next key
        console.error(`[Error] Google API error with key ${keyData.index}:`, error.message);
        continue;
      }
    }

    // If we've tried all keys and none worked, throw an error
    throw new Error(`Failed to execute Google search after ${attempts} attempts with different API keys`);
  }

  // Add new API key and search engine ID at runtime
  addApiKey(apiKey, searchEngineId) {
    if (!apiKey || !searchEngineId) {
      console.error("[Error] Cannot add API key: Both API key and search engine ID are required");
      return false;
    }

    // Check if this key already exists
    if (this.apiKeys.includes(apiKey)) {
      console.warn("[Warning] This API key is already in the rotation");
      return false;
    }

    // Add the new key and search engine ID
    this.apiKeys.push(apiKey);
    this.searchEngineIds.push(searchEngineId);

    // Add status tracking for the new key
    this.keyStatus.push({
      index: this.apiKeys.length - 1,
      quotaExceeded: false,
      callsToday: 0,
      lastReset: new Date().setHours(0, 0, 0, 0)
    });

    console.log(`[Success] Added new Google API key at index ${this.apiKeys.length - 1}`);
    return true;
  }

  // Add multiple API keys at once
  addApiKeys(apiKeys, searchEngineIds) {
    if (!Array.isArray(apiKeys) || !Array.isArray(searchEngineIds) ||
      apiKeys.length !== searchEngineIds.length) {
      console.error("[Error] Cannot add API keys: Both arrays must have the same length");
      return 0;
    }

    let addedCount = 0;

    for (let i = 0; i < apiKeys.length; i++) {
      if (this.addApiKey(apiKeys[i], searchEngineIds[i])) {
        addedCount++;
      }
    }

    console.log(`[Success] Added ${addedCount} new Google API keys`);
    return addedCount;
  }

  // Remove API key by index
  removeApiKey(index) {
    if (index < 0 || index >= this.apiKeys.length) {
      console.error(`[Error] Cannot remove API key: Index ${index} is out of bounds`);
      return false;
    }

    // Remove the key, search engine ID, and status
    this.apiKeys.splice(index, 1);
    this.searchEngineIds.splice(index, 1);
    this.keyStatus.splice(index, 1);

    // Update indices in key status
    this.keyStatus.forEach((status, i) => {
      status.index = i;
    });

    // Adjust current key index if needed
    if (this.currentKeyIndex >= this.apiKeys.length) {
      this.currentKeyIndex = this.apiKeys.length > 0 ? 0 : -1;
    } else if (this.currentKeyIndex === index) {
      // If we removed the current key, reset to the first key
      this.currentKeyIndex = this.apiKeys.length > 0 ? 0 : -1;
    }

    console.log(`[Success] Removed Google API key at index ${index}`);
    return true;
  }

  // Reset quota for a specific key (public method to be called from API)
  resetQuota(index) {
    return this.resetKeyQuota(index);
  }

  // Reset quota for a specific key
  resetKeyQuota(index) {
    if (index < 0 || index >= this.apiKeys.length) {
      console.error(`[Error] Cannot reset key quota: Index ${index} is out of bounds`);
      return false;
    }

    const status = this.keyStatus[index];
    status.callsToday = 0;
    status.quotaExceeded = false;
    status.lastReset = new Date().setHours(0, 0, 0, 0);

    console.log(`[Success] Reset quota for Google API key at index ${index}`);
    return true;
  }

  resetAllQuotas() {
    const today = new Date().setHours(0, 0, 0, 0);

    this.keyStatus.forEach(status => {
      status.callsToday = 0;
      status.quotaExceeded = false;
      status.lastReset = today;
    });

    console.log(`[Success] Reset quotas for all ${this.apiKeys.length} Google API keys`);
    return true;
  }
}

const googleAPIManager = new GoogleAPIManager();
export default googleAPIManager;