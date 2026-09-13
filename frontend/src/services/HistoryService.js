import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class HistoryService {
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

            try {
                const errorData = await response.json();
                errorMessage = errorData.message || errorData.error || errorMessage;
            } catch (parseError) {
                errorMessage = response.statusText || errorMessage;
            }

            throw new Error(errorMessage);
        }

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            return {};
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

    /**
     * Save search to history
     * @param {string} query - Search query
     * @param {object} params - Search parameters (industry, style, etc.)
     * @param {array} images - Array of result images
     */
    static async saveSearch(query, params, images) {
        try {
            if (!query || !images || !Array.isArray(images) || images.length === 0) {
                throw new Error('Query and images are required');
            }

            return await this.makeAuthenticatedRequest(`${API_URL}/api/history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    query,
                    params,
                    images: images.slice(0, 10) // Limit to 10 images
                })
            });
        } catch (error) {
            console.error('Error saving search to history:', error);
            throw error;
        }
    }

    /**
     * Get user's search history
     */
    static async getHistory() {
        try {
            return await this.makeAuthenticatedRequest(`${API_URL}/api/history`);
        } catch (error) {
            console.error('Error fetching history:', error);
            throw error;
        }
    }

    /**
     * Delete specific history entry
     * @param {number} index - Index of history entry to delete
     */
    static async deleteHistoryEntry(index) {
        try {
            if (typeof index !== 'number' || index < 0) {
                throw new Error('Invalid index');
            }

            return await this.makeAuthenticatedRequest(`${API_URL}/api/history/${index}`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error deleting history entry:', error);
            throw error;
        }
    }

    /**
     * Clear all history
     */
    static async clearAllHistory() {
        try {
            return await this.makeAuthenticatedRequest(`${API_URL}/api/history`, {
                method: 'DELETE'
            });
        } catch (error) {
            console.error('Error clearing history:', error);
            throw error;
        }
    }

    // Check if user is authenticated
    static isAuthenticated() {
        return auth.currentUser !== null;
    }

    // Get current user info
    static getCurrentUser() {
        return auth.currentUser;
    }
}

export default HistoryService;
