// collaborationRoutes.js
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabaseClient.js';

// ── Supabase helpers for live_sessions ──
async function dbFindSession(inviteCode) {
  const { data, error } = await supabaseAdmin
    .from('live_sessions')
    .select('*')
    .eq('invite_code', inviteCode)
    .single();
  if (error) return null;
  return data;
}

async function dbCreateSession(sessionData) {
  const { data, error } = await supabaseAdmin
    .from('live_sessions')
    .insert(sessionData)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function dbUpdateSession(inviteCode, updates) {
  await supabaseAdmin
    .from('live_sessions')
    .update({ ...updates, last_activity: new Date().toISOString() })
    .eq('invite_code', inviteCode);
}

async function dbDeleteSession(inviteCode) {
  await supabaseAdmin
    .from('live_sessions')
    .delete()
    .eq('invite_code', inviteCode);
}

// Dummy Socket.IO functions for backwards compatibility
export function setupCollaboration() {
  return null;
}

export function authenticateSocketUser() {
  return null;
}

// Express routes for collaboration
export function setupCollaborationRoutes(app, { authenticateUser }) {

  // Get active session info
  app.get('/api/collaboration/session/:sessionId', authenticateUser, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { data: session, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Check if expired
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await dbDeleteSession(session.invite_code);
        return res.status(410).json({ error: 'Session expired' });
      }

      res.json({
        id: session.id,
        inviteCode: session.invite_code,
        participants: session.participants || [],
        moodboard: {
          title: session.title,
          images: session.images || [],
          edges: session.edges || []
        },
        isHost: session.host_user_id === (req.user.uid || req.user.id),
        createdAt: session.created_at,
        lastActivity: session.last_activity
      });
    } catch (err) {
      console.error('Error fetching session:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Get session by invite code
  app.get('/api/collaboration/invite/:inviteCode', authenticateUser, async (req, res) => {
    try {
      const { inviteCode } = req.params;
      const session = await dbFindSession(inviteCode);

      if (!session) {
        return res.status(404).json({ error: 'Invalid invite code' });
      }

      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await dbDeleteSession(inviteCode);
        return res.status(410).json({ error: 'Invitation expired' });
      }

      const hostParticipant = (session.participants || []).find(p => p.userId === session.host_user_id);

      res.json({
        id: session.id,
        inviteCode: session.invite_code,
        hostDisplayName: hostParticipant?.displayName || 'Unknown',
        participantCount: (session.participants || []).length,
        moodboardTitle: session.title,
        createdAt: session.created_at
      });
    } catch (err) {
      console.error('Error verifying invite:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Get user's current session
  app.get('/api/collaboration/my-session', authenticateUser, async (req, res) => {
    try {
      const userId = req.user.uid || req.user.id;
      
      const { data: sessions, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*');

      if (error) throw error;

      // Find active session where this user is listed as a participant and is NOT expired
      const now = new Date();
      const activeSession = (sessions || []).find(s => {
        const isParticipant = (s.participants || []).some(p => p.userId === userId);
        const isExpired = s.expires_at && new Date(s.expires_at) < now;

        if (isParticipant && isExpired) {
          // Clean up the expired session in the background
          dbDeleteSession(s.invite_code).catch(err =>
            console.error(`[Warning] Failed to auto-delete expired session ${s.invite_code}:`, err.message)
          );
          return false; // Treat as not active
        }

        return isParticipant && !isExpired;
      });

      if (!activeSession) {
        return res.status(404).json({ error: 'No active session' });
      }

      res.json({
        id: activeSession.id,
        inviteCode: activeSession.invite_code,
        participants: activeSession.participants || [],
        moodboard: {
          title: activeSession.title,
          images: activeSession.images || [],
          edges: activeSession.edges || []
        },
        isHost: activeSession.host_user_id === userId,
        createdAt: activeSession.created_at,
        lastActivity: activeSession.last_activity
      });
    } catch (err) {
      console.error('Error fetching my-session:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Create collaboration session
  app.post('/api/collaboration/session/create', authenticateUser, async (req, res) => {
    try {
      const userId = req.user.uid || req.user.id;
      const moodboardData = req.body;

      // Generate unique invite code
      const generateInviteCode = () => Math.random().toString(36).substr(2, 6).toUpperCase();
      let inviteCode = generateInviteCode();

      // Ensure uniqueness
      while (await dbFindSession(inviteCode)) {
        inviteCode = generateInviteCode();
      }

      const initialParticipant = {
        userId,
        displayName: req.user.displayName || req.user.email.split('@')[0],
        photoURL: req.user.photoURL || null,
        joinedAt: new Date().toISOString()
      };

      const dbSession = await dbCreateSession({
        invite_code: inviteCode,
        host_user_id: userId,
        title: moodboardData.title || 'Live Moodboard',
        images: moodboardData.images || [],
        edges: moodboardData.edges || [],
        participants: [initialParticipant],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      });

      console.log(`Collaboration session created: ${inviteCode} by ${req.user.displayName}`);

      res.json({
        success: true,
        sessionId: dbSession.id,
        inviteCode,
        session: {
          id: dbSession.id,
          inviteCode,
          host_user_id: userId,
          participants: [initialParticipant],
          moodboard: {
            title: dbSession.title,
            images: dbSession.images || [],
            edges: dbSession.edges || []
          }
        }
      });
    } catch (err) {
      console.error('Error creating session:', err);
      res.status(500).json({ error: 'Failed to create session', details: err.message });
    }
  });

  // Join collaboration session
  app.post('/api/collaboration/session/join', authenticateUser, async (req, res) => {
    try {
      const userId = req.user.uid || req.user.id;
      const { inviteCode } = req.body;

      if (!inviteCode) {
        return res.status(400).json({ error: 'Invite code is required' });
      }

      const session = await dbFindSession(inviteCode);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        await dbDeleteSession(inviteCode);
        return res.status(410).json({ error: 'Session expired' });
      }

      const participants = session.participants || [];
      const exists = participants.some(p => p.userId === userId);

      if (!exists) {
        participants.push({
          userId,
          displayName: req.user.displayName || req.user.email.split('@')[0],
          photoURL: req.user.photoURL || null,
          joinedAt: new Date().toISOString()
        });
        await dbUpdateSession(inviteCode, { participants });
        console.log(`User ${req.user.displayName} joined session: ${inviteCode}`);
      }

      res.json({
        success: true,
        session: {
          id: session.id,
          inviteCode: session.invite_code,
          host_user_id: session.host_user_id,
          participants,
          moodboard: {
            title: session.title,
            images: session.images || [],
            edges: session.edges || []
          }
        }
      });
    } catch (err) {
      console.error('Error joining session:', err);
      res.status(500).json({ error: 'Failed to join session', details: err.message });
    }
  });

  // Handle moodboard state updates (Stateless mutation)
  app.post('/api/collaboration/session/:sessionId/update', authenticateUser, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { action, payload } = req.body;

      const { data: session, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const images = session.images || [];
      const edges = session.edges || [];
      let title = session.title;

      if (action === 'ADD_REACTION') {
        const { itemId, reaction } = payload;
        const item = images.find(img => img.id === itemId || img._internalId === itemId);
        if (item) {
          if (!item.reactions) item.reactions = [];
          const exists = item.reactions.some(r => r.emoji === reaction.emoji && r.user.userId === reaction.user.userId);
          if (!exists) item.reactions.push(reaction);
        }
      } else if (action === 'REMOVE_REACTION') {
        const { itemId, emoji, userId } = payload;
        const item = images.find(img => img.id === itemId || img._internalId === itemId);
        if (item && item.reactions) {
          item.reactions = item.reactions.filter(r => !(r.emoji === emoji && r.user.userId === userId));
        }
      } else {
        switch (action) {
          case 'ADD_IMAGE':
            images.push(payload.image);
            break;
          case 'REMOVE_IMAGE':
            if (payload.id) {
              const targetId = payload.id;
              const idx = images.findIndex(img => img.id === targetId || img._internalId === targetId || img._id === targetId);
              if (idx !== -1) images.splice(idx, 1);
            } else if (typeof payload.index === 'number') {
              images.splice(payload.index, 1);
            }
            break;
          case 'REORDER_IMAGES':
            const { fromIndex, toIndex } = payload;
            const [moved] = images.splice(fromIndex, 1);
            images.splice(toIndex, 0, moved);
            break;
          case 'UPDATE_TITLE':
            title = payload.title;
            break;
          case 'UPDATE_IMAGE':
            let targetIndex = -1;
            if (payload.id) {
              targetIndex = images.findIndex(img => img._internalId === payload.id || img.id === payload.id || img._id === payload.id);
            }
            if (targetIndex === -1 && !payload.id && typeof payload.index === 'number') {
              targetIndex = payload.index;
            }
            if (targetIndex !== -1 && images[targetIndex]) {
              images[targetIndex] = {
                ...images[targetIndex],
                ...payload.updates
              };
            }
            break;
          case 'ADD_EDGE':
            edges.push(payload.edge);
            break;
          case 'REMOVE_EDGE':
            const edgeIndex = edges.findIndex(edge => edge.id === payload.id);
            if (edgeIndex !== -1) edges.splice(edgeIndex, 1);
            break;
        }
      }

      await dbUpdateSession(session.invite_code, { images, edges, title });

      res.json({
        success: true,
        moodboard: {
          title,
          images,
          edges
        }
      });
    } catch (err) {
      console.error('Error updating moodboard:', err);
      res.status(500).json({ error: 'Failed to update session data', details: err.message });
    }
  });

  // Leave session
  app.post('/api/collaboration/session/:sessionId/leave', authenticateUser, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.uid || req.user.id;

      const { data: session, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const participants = (session.participants || []).filter(p => p.userId !== userId);

      if (participants.length === 0) {
        await dbDeleteSession(session.invite_code);
        console.log(`Cleaned up empty session: ${session.invite_code}`);
      } else {
        let hostId = session.host_user_id;
        if (session.host_user_id === userId) {
          // Transfer host
          hostId = participants[0].userId;
          console.log(`Host transferred to: ${hostId}`);
        }
        await dbUpdateSession(session.invite_code, { participants, host_user_id: hostId });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error leaving session:', err);
      res.status(500).json({ error: 'Failed to leave session', details: err.message });
    }
  });

  // End collaboration session (host only)
  app.delete('/api/collaboration/session/:sessionId', authenticateUser, async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { data: session, error } = await supabaseAdmin
        .from('live_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();

      if (error || !session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      if (session.host_user_id !== (req.user.uid || req.user.id)) {
        return res.status(403).json({ error: 'Only the host can end the session' });
      }

      await dbDeleteSession(session.invite_code);
      console.log(`Session ${session.invite_code} ended by host: ${req.user.displayName}`);

      res.json({
        success: true,
        message: 'Session ended successfully',
        finalMoodboard: {
          title: session.title,
          images: session.images || [],
          edges: session.edges || []
        }
      });
    } catch (err) {
      console.error('Error ending session:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });



  // Health check for collaboration
  app.get('/api/collaboration/health', async (req, res) => {
    try {
      const { data: sessions, error } = await supabaseAdmin
        .from('live_sessions')
        .select('id, participants');

      if (error) throw error;

      res.json({
        status: 'healthy',
        activeSessions: (sessions || []).length,
        totalUsers: (sessions || []).reduce((total, session) => total + (session.participants || []).length, 0),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error checking health:', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });
}
