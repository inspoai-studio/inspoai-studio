import CloudinaryService from '../services/CloudinaryService.js';
import UserService from '../services/userService.js';
import { supabaseAdmin } from '../config/supabaseClient.js';

export default function setupMoodboardRoutes(app, { UserService: _, authenticateUser }) {
  // Use the imported UserService directly (ignore the one from context)
  const HOTLINK_BLOCKED_DOMAINS = [
    'media.licdn.com', 'media-exp1.licdn.com', 'media-exp2.licdn.com',
    'pbs.twimg.com', 'ton.twimg.com', 'instagram.com', 'cdninstagram.com',
    'scontent.cdninstagram.com', 'fbcdn.net', 'scontent.fbcdn.net'
  ];

  const isBlockedDomain = (url) => {
    try {
      const host = new URL(url).hostname;
      return HOTLINK_BLOCKED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
    } catch { return false; }
  };

  const processMoodboardImages = async (images) => {
    if (!images || !Array.isArray(images)) return images;
    const processedImages = await Promise.all(images.map(async (img) => {
      if (typeof img !== 'object') return img;
      const { _fromExtension, _hasBase64, ...rest } = img;
      if (_fromExtension && _hasBase64 && rest.image && rest.image.startsWith('data:')) {
        try {
          const cloudUrl = await CloudinaryService.uploadBase64(rest.image, 'inspoai/user_moodboards');
          return { ...rest, image: cloudUrl, url: rest.url || rest._originalUrl || rest.image, _originalUrl: undefined };
        } catch (error) {
          return { ...rest, image: rest._originalUrl || rest.image, _originalUrl: undefined };
        }
      }
      if (_fromExtension && rest.image && !rest.image.includes('cloudinary.com')) {
        try {
          const cloudUrl = await CloudinaryService.uploadFromUrl(rest.image, 'inspoai/user_moodboards');
          if (isBlockedDomain(cloudUrl)) return { ...rest, image: cloudUrl, _unavailable: true };
          return { ...rest, image: cloudUrl, url: rest.url || rest.image };
        } catch (error) { return rest; }
      }
      return rest;
    }));
    return processedImages;
  };

  // Create a shareable moodboard
  app.post('/api/moodboards/share', authenticateUser, async (req, res) => {
    try {
      let { title, images } = req.body;
      images = await processMoodboardImages(images);

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Moodboard must contain at least one image' });
      }

      const userId = req.user.uid || req.user.id;
      const user = await UserService.findByUid(userId);
      const limits = user ? user.getPlanLimits() : null;

      if (limits && limits.maxImagesPerMoodboard && images.length > limits.maxImagesPerMoodboard) {
        return res.status(403).json({ error: 'Forbidden', message: `Your plan allows max ${limits.maxImagesPerMoodboard} images per moodboard.`, limitReached: true });
      }
      if (user && !user.hasFeatureAccess('shareLinks')) {
        return res.status(403).json({ error: 'Forbidden', message: 'Share link limit reached. Upgrade your plan.', limitReached: true });
      }

      const shareCode = generateShareCode();
      const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .insert({
          user_id: userId,
          title: title || 'My Moodboard',
          images,
          share_code: shareCode,
          is_public: true,
          views: 0
        })
        .select()
        .single();
      if (error) throw error;

      // Increment usage
      if (user) await UserService.incrementUsage(userId, 'shareLinks', user);

      res.status(201).json({ shareCode, message: 'Moodboard shared successfully' });
    } catch (error) {
      console.error('Error sharing moodboard:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to share moodboard' });
    }
  });

  // Save a moodboard as a collection (private by default)
  app.post('/api/moodboards/save', authenticateUser, async (req, res) => {
    try {
      let { title, images } = req.body;
      images = await processMoodboardImages(images);

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'Bad Request', message: 'Moodboard must contain at least one image' });
      }

      const userId = req.user.uid || req.user.id;
      const user = await UserService.findByUid(userId);
      const limits = user ? user.getPlanLimits() : null;

      if (limits && limits.maxImagesPerMoodboard && images.length > limits.maxImagesPerMoodboard) {
        return res.status(403).json({ error: 'Forbidden', message: `Your plan allows max ${limits.maxImagesPerMoodboard} images per moodboard.`, limitReached: true });
      }
      if (user && !user.hasFeatureAccess('moodboards')) {
        return res.status(403).json({ error: 'Forbidden', message: `Your plan allows max ${limits.moodboards} moodboard(s). Upgrade to create more.`, limitReached: true });
      }

      const shareCode = generateShareCode();
      const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .insert({
          user_id: userId,
          title: title || 'My Collection',
          images,
          share_code: shareCode,
          is_public: false,
          views: 0
        })
        .select()
        .single();
      if (error) throw error;

      if (user) await UserService.incrementUsage(userId, 'moodboards', user);

      res.status(201).json({ id: data.id, title: data.title, message: 'Collection saved successfully' });
    } catch (error) {
      console.error('Error saving moodboard collection:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to save collection' });
    }
  });

  // Get a shared moodboard by share code
  app.get('/api/moodboards/shared/:shareCode', async (req, res) => {
    try {
      const shareCode = req.params.shareCode;
      const { data: sm, error } = await supabaseAdmin
        .from('shared_moodboards')
        .select('*')
        .eq('share_code', shareCode)
        .single();

      if (error || !sm) {
        return res.status(404).json({ error: 'Not Found', message: 'Shared moodboard not found' });
      }

      // Note: Moodboards do not expire — expires_at is legacy and ignored

      // Increment views
      await supabaseAdmin.from('shared_moodboards').update({ views: (sm.views || 0) + 1 }).eq('id', sm.id);

      res.json({ title: sm.title, images: sm.images, createdAt: sm.created_at, views: (sm.views || 0) + 1 });
    } catch (error) {
      console.error('Error retrieving shared moodboard:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve shared moodboard' });
    }
  });

  // Get all moodboards for the current user
  app.get('/api/moodboards/shared', authenticateUser, async (req, res) => {
    try {
      const userId = req.user.uid || req.user.id;
      const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      res.json({
        moodboards: (data || []).map(m => ({
          id: m.id,
          title: m.title,
          shareCode: m.share_code,
          isPublic: m.is_public,
          views: m.views || 0,
          createdAt: m.created_at,
          updatedAt: m.updated_at || m.created_at,
          thumbnail: m.images && m.images.length > 0 ?
            (typeof m.images[0] === 'string' ? m.images[0] : m.images[0].image || m.images[0].url) : null,
          imageCount: m.images ? m.images.length : 0,
          images: m.images
        }))
      });
    } catch (error) {
      console.error('Error retrieving shared moodboards:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to retrieve shared moodboards' });
    }
  });

  // Update a moodboard
  app.put('/api/moodboards/:id', authenticateUser, async (req, res) => {
    try {
      const moodboardId = req.params.id;
      let updates = { ...req.body };

      if (updates.images && Array.isArray(updates.images)) {
        updates.images = await processMoodboardImages(updates.images);
        const userId = req.user.uid || req.user.id;
        const user = await UserService.findByUid(userId);
        const limits = user ? user.getPlanLimits() : null;
        if (limits && limits.maxImagesPerMoodboard && updates.images.length > limits.maxImagesPerMoodboard) {
          return res.status(403).json({ error: 'Forbidden', message: `Max ${limits.maxImagesPerMoodboard} images per moodboard.`, limitReached: true });
        }
      }

      const dbUpdates = { updated_at: new Date().toISOString() };
      if (updates.title !== undefined) dbUpdates.title = updates.title;
      if (updates.images !== undefined) dbUpdates.images = updates.images;
      if (updates.isPublic !== undefined) dbUpdates.is_public = updates.isPublic;

      const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .update(dbUpdates)
        .eq('id', moodboardId)
        .eq('user_id', req.user.uid || req.user.id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Not Found', message: 'Moodboard not found or does not belong to you' });
      }

      res.json({ id: data.id, title: data.title, message: 'Moodboard updated successfully' });
    } catch (error) {
      console.error('Error updating moodboard:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to update moodboard' });
    }
  });

  // Update moodboard privacy
  app.put('/api/moodboards/:id/privacy', authenticateUser, async (req, res) => {
    try {
      const { isPublic } = req.body;
      const moodboardId = req.params.id;

      if (isPublic === undefined) {
        return res.status(400).json({ error: 'Bad Request', message: 'isPublic property is required' });
      }

      const { data, error } = await supabaseAdmin
        .from('shared_moodboards')
        .update({ is_public: isPublic, updated_at: new Date().toISOString() })
        .eq('id', moodboardId)
        .eq('user_id', req.user.uid || req.user.id)
        .select()
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Not Found', message: 'Moodboard not found or does not belong to you' });
      }

      res.json({ id: data.id, isPublic: data.is_public, message: 'Moodboard privacy updated successfully' });
    } catch (error) {
      console.error('Error updating moodboard privacy:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to update moodboard privacy' });
    }
  });

  // Delete moodboard
  app.delete('/api/moodboards/:id', authenticateUser, async (req, res) => {
    try {
      const moodboardId = req.params.id;

      const { error } = await supabaseAdmin
        .from('shared_moodboards')
        .delete()
        .eq('id', moodboardId)
        .eq('user_id', req.user.uid || req.user.id);

      if (error) throw error;

      res.json({ message: 'Moodboard deleted successfully' });
    } catch (error) {
      console.error('Error deleting moodboard:', error);
      res.status(500).json({ error: 'Server Error', message: 'Failed to delete moodboard' });
    }
  });
}

function generateShareCode(length = 8) {
  const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}