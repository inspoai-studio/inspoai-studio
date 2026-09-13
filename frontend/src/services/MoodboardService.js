import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class MoodboardService {
  // Get current user's token
  static async getAuthToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    return await user.getIdToken();
  }

  // Helper method to handle API responses
  static async handleResponse(response) {
    if (!response.ok) {
      let errorMessage = `HTTP error! status: ${response.status}`;

      let errorData = {};
      try {
        errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (parseError) {
        // If response is not JSON, use the status text or default message
        errorMessage = response.statusText || errorMessage;
      }

      const error = new Error(errorMessage);
      if (errorData.limitReached) {
        error.limitReached = true;
      }
      throw error;
    }

    // Handle empty responses (like 204 No Content)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    } else {
      return {}; // Return empty object for non-JSON responses
    }
  }

  // Helper method for making authenticated requests
  static async makeAuthenticatedRequest(url, options = {}) {
    try {
      const token = await this.getAuthToken();

      const defaultHeaders = {
        'Authorization': `Bearer ${token}`,
        ...options.headers
      };

      const response = await fetch(url, {
        ...options,
        headers: defaultHeaders
      });

      return await this.handleResponse(response);
    } catch (error) {
      console.error(`API request failed for ${url}:`, error);
      throw error;
    }
  }

  // Create a shareable moodboard
  static async createShareableMoodboard(images, title = 'My Moodboard') {
    try {
      // Validate input
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new Error('Images array is required and cannot be empty');
      }

      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        throw new Error('Title is required and must be a non-empty string');
      }

      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          images
        })
      });
    } catch (error) {
      console.error('Error creating shareable moodboard:', error);
      throw error;
    }
  }

  // Save a moodboard as a private collection
  static async saveCollection(images, title = 'My Collection') {
    try {
      // Validate input
      if (!images || !Array.isArray(images) || images.length === 0) {
        throw new Error('Images array is required and cannot be empty');
      }

      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: title.trim(),
          images
        })
      });
    } catch (error) {
      console.error('Error saving moodboard collection:', error);
      throw error;
    }
  }

  // Get all shared moodboards for the current user
  static async getUserSharedMoodboards() {
    try {
      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/shared`);
    } catch (error) {
      console.error('Error fetching user shared moodboards:', error);
      throw error;
    }
  }

  // Get a specific shared moodboard by share code
  static async getSharedMoodboard(shareCode) {
    try {
      // Validate share code
      if (!shareCode || typeof shareCode !== 'string' || shareCode.trim().length === 0) {
        throw new Error('Share code is required and must be a non-empty string');
      }

      const response = await fetch(`${API_URL}/api/moodboards/shared/${encodeURIComponent(shareCode.trim())}`);
      return await this.handleResponse(response);
    } catch (error) {
      console.error('Error fetching shared moodboard:', error);
      throw error;
    }
  }

  // Get all moodboards for the current user
  static async getUserMoodboards() {
    try {
      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards`);
    } catch (error) {
      console.error('Error fetching user moodboards:', error);
      throw error;
    }
  }

  // Get active collaboration session for the current user
  static async getActiveCollaborationSession() {
    try {
      return await this.makeAuthenticatedRequest(`${API_URL}/api/collaboration/my-session`);
    } catch (error) {
      // 404 is expected if no session
      if (error.message.includes('404') || error.message.includes('No active session')) {
        return null;
      }
      console.error('Error fetching active session:', error);
      return null;
    }
  }

  // Update a moodboard's general properties
  static async updateMoodboard(moodboardId, updates) {
    try {
      // Validate input
      if (!moodboardId) {
        throw new Error('Moodboard ID is required');
      }

      if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
        throw new Error('Updates object is required and cannot be empty');
      }

      // Clean up updates object - remove undefined values
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined)
      );

      if (Object.keys(cleanUpdates).length === 0) {
        throw new Error('No valid updates provided');
      }

      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/${encodeURIComponent(moodboardId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cleanUpdates)
      });
    } catch (error) {
      console.error('Error updating moodboard:', error);
      throw error;
    }
  }

  // Update a moodboard's privacy setting (public/private)
  static async updateMoodboardPrivacy(moodboardId, isPublic) {
    try {
      // Validate input
      if (!moodboardId) {
        throw new Error('Moodboard ID is required');
      }

      if (typeof isPublic !== 'boolean') {
        throw new Error('isPublic must be a boolean value');
      }

      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/${encodeURIComponent(moodboardId)}/privacy`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isPublic })
      });
    } catch (error) {
      console.error('Error updating moodboard privacy:', error);
      throw error;
    }
  }

  // Delete a moodboard
  static async deleteMoodboard(moodboardId) {
    try {
      // Validate input
      if (!moodboardId) {
        throw new Error('Moodboard ID is required');
      }

      return await this.makeAuthenticatedRequest(`${API_URL}/api/moodboards/${encodeURIComponent(moodboardId)}`, {
        method: 'DELETE'
      });
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      throw error;
    }
  }

  // Additional utility methods

  // Check if user is authenticated
  static isAuthenticated() {
    return auth.currentUser !== null;
  }

  // Get current user info
  static getCurrentUser() {
    return auth.currentUser;
  }

  // Retry mechanism for failed requests
  static async retryRequest(requestFunction, maxRetries = 3, delay = 1000) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFunction();
      } catch (error) {
        lastError = error;

        // Don't retry authentication errors or client errors (4xx)
        if (error.message.includes('not authenticated') ||
          error.message.includes('HTTP error! status: 4')) {
          throw error;
        }

        if (attempt === maxRetries) {
          throw error;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }

    throw lastError;
  }
}

export default MoodboardService;
