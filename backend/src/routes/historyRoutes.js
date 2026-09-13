// historyRoutes.js - Search History Management
import CloudinaryService from '../services/CloudinaryService.js';
import UserService from '../services/userService.js';

export default function setupHistoryRoutes(app, { UserService: _, authenticateUser }) {
    // Use the imported UserService directly

    app.post('/api/history', authenticateUser, async (req, res) => {
        try {
            const { query, params, images } = req.body;
            if (!query || !images || !Array.isArray(images)) {
                return res.status(400).json({ error: 'Bad Request', message: 'Query and images array are required' });
            }

            const userId = req.user.uid || req.user.id;
            const user = await UserService.findByUid(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const historyLimit = user.getPlanLimits().historySaved || 5;

            const processedImages = await Promise.all(
                images.slice(0, 3).map(async (img) => {
                    try {
                        const cloudinaryUrl = await CloudinaryService.uploadFromUrl(img.image || img.url, `inspoai/history/${userId}`);
                        return { url: cloudinaryUrl, title: img.title || 'Design Inspiration', source: img.source || 'Unknown', thumbnail: cloudinaryUrl };
                    } catch (error) {
                        return { url: img.image || img.url, title: img.title || 'Design Inspiration', source: img.source || 'Unknown', thumbnail: img.image || img.url };
                    }
                })
            );

            const historyEntry = { query, params: params || {}, images: processedImages, timestamp: new Date().toISOString() };
            const history = [...(user.search_history || [])];
            history.unshift(historyEntry);

            // Trim to limit
            if (history.length > historyLimit) {
                const removedEntries = history.splice(historyLimit);
                for (const entry of removedEntries) {
                    for (const img of (entry.images || [])) {
                        if (img.url && img.url.includes('cloudinary')) {
                            const publicId = CloudinaryService.extractPublicId(img.url);
                            if (publicId) await CloudinaryService.deleteImage(publicId);
                        }
                    }
                }
            }

            await UserService.updateUser(userId, { search_history: history });

            res.status(201).json({ message: 'Search saved to history', historyCount: history.length, limit: historyLimit });
        } catch (error) {
            console.error('Error saving search history:', error);
            res.status(500).json({ error: 'Server Error', message: 'Failed to save search history' });
        }
    });

    app.get('/api/history', authenticateUser, async (req, res) => {
        try {
            const user = await UserService.findByUid(req.user.uid || req.user.id);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const historyLimit = user.getPlanLimits().historySaved || 5;
            res.json({ history: user.search_history || [], limit: historyLimit, count: (user.search_history || []).length });
        } catch (error) {
            console.error('Error fetching search history:', error);
            res.status(500).json({ error: 'Server Error', message: 'Failed to fetch search history' });
        }
    });

    app.delete('/api/history/:index', authenticateUser, async (req, res) => {
        try {
            const index = parseInt(req.params.index);
            if (isNaN(index) || index < 0) return res.status(400).json({ error: 'Invalid index' });

            const userId = req.user.uid || req.user.id;
            const user = await UserService.findByUid(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const history = [...(user.search_history || [])];
            if (index >= history.length) return res.status(404).json({ error: 'History entry not found' });

            const entry = history[index];
            for (const img of (entry.images || [])) {
                if (img.url && img.url.includes('cloudinary')) {
                    const publicId = CloudinaryService.extractPublicId(img.url);
                    if (publicId) await CloudinaryService.deleteImage(publicId);
                }
            }

            history.splice(index, 1);
            await UserService.updateUser(userId, { search_history: history });

            res.json({ message: 'History entry deleted', remainingCount: history.length });
        } catch (error) {
            console.error('Error deleting history entry:', error);
            res.status(500).json({ error: 'Server Error', message: 'Failed to delete history entry' });
        }
    });

    app.delete('/api/history', authenticateUser, async (req, res) => {
        try {
            const userId = req.user.uid || req.user.id;
            const user = await UserService.findByUid(userId);
            if (!user) return res.status(404).json({ error: 'User not found' });

            for (const entry of (user.search_history || [])) {
                for (const img of (entry.images || [])) {
                    if (img.url && img.url.includes('cloudinary')) {
                        const publicId = CloudinaryService.extractPublicId(img.url);
                        if (publicId) await CloudinaryService.deleteImage(publicId);
                    }
                }
            }

            await UserService.updateUser(userId, { search_history: [] });
            res.json({ message: 'All history cleared' });
        } catch (error) {
            console.error('Error clearing history:', error);
            res.status(500).json({ error: 'Server Error', message: 'Failed to clear history' });
        }
    });
}
