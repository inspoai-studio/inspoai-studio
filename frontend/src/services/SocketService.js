import { supabase } from '../supabaseClient';
import { auth } from '../firebase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SocketService {
    constructor() {
        this.channel = null;
        this.listeners = new Map();
        this.sessionId = null;
        this.inviteCode = null;
        this.token = null;
        
        this.userId = null;
        this.displayName = null;
        this.photoURL = null;
    }

    // Connect and set user profile
    connect(token) {
        this.token = token;
        
        const currentUser = auth.currentUser;
        if (currentUser) {
            this.userId = currentUser.uid;
            this.displayName = currentUser.displayName || currentUser.email.split('@')[0];
            this.photoURL = currentUser.photoURL || null;
        }
        
        
        // Emulate Socket.IO connect callback
        setTimeout(() => {
            this.trigger('connect');
        }, 100);
    }

    // Create a new collaboration session via REST, then join channel
    async createSession(moodboardData) {
        if (!this.token) throw new Error('Not connected / authenticated');

        const response = await fetch(`${API_URL}/api/collaboration/session/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify(moodboardData)
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to create session');
        }

        const data = await response.json();
        if (data.success) {
            this.sessionId = data.sessionId;
            this.inviteCode = data.inviteCode;
            this.joinRealtimeChannel(data.sessionId, data.session.host_user_id);
            return data;
        } else {
            throw new Error(data.error);
        }
    }

    // Join an existing session via REST, then join channel
    async joinSession(inviteCode) {
        if (!this.token) throw new Error('Not connected / authenticated');

        const response = await fetch(`${API_URL}/api/collaboration/session/join`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ inviteCode })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to join session');
        }

        const data = await response.json();
        if (data.success) {
            this.sessionId = data.session.id;
            this.inviteCode = inviteCode;
            this.joinRealtimeChannel(data.session.id, data.session.host_user_id);
            return data;
        } else {
            throw new Error(data.error);
        }
    }

    // Subscribe to Supabase Realtime channel for presence and broadcasts
    joinRealtimeChannel(sessionId, hostUserId) {
        if (this.channel) {
            this.channel.unsubscribe();
        }

        const channelName = `session_${sessionId}`;
        this.channel = supabase.channel(channelName, {
            config: {
                presence: {
                    key: this.userId,
                },
            },
        });

        this.channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = this.channel.presenceState();
                const participants = [];
                
                Object.entries(presenceState).forEach(([userId, presences]) => {
                    presences.forEach(presence => {
                        participants.push({
                            userId,
                            displayName: presence.displayName || 'Anonymous',
                            photoURL: presence.photoURL || null,
                            isHost: userId === hostUserId,
                            cursor: presence.cursor || null
                        });
                    });
                });
                
                const currentParticipant = participants.find(p => p.userId === this.userId);
                
                // Emulate client join/leave events
                this.trigger('participant-joined', {
                    participant: currentParticipant,
                    participants
                });
                
                this.trigger('participant-left', {
                    participants
                });
            })
            .on('broadcast', { event: 'cursor-moved' }, ({ payload }) => {
                this.trigger('cursor-moved', payload);
            })
            .on('broadcast', { event: 'item-moved' }, ({ payload }) => {
                this.trigger('item-moved', payload);
            })
            .on('broadcast', { event: 'user-typing' }, ({ payload }) => {
                this.trigger('user-typing', payload);
            })
            .on('broadcast', { event: 'moodboard-updated' }, ({ payload }) => {
                this.trigger('moodboard-updated', payload);
            })
            .on('broadcast', { event: 'reaction-added' }, ({ payload }) => {
                this.trigger('reaction-added', payload);
            })
            .on('broadcast', { event: 'reaction-removed' }, ({ payload }) => {
                this.trigger('reaction-removed', payload);
            })
            .on('broadcast', { event: 'session-ended' }, ({ payload }) => {
                this.trigger('session-ended', payload);
            })
            .subscribe(async (status, err) => {
                if (status === 'SUBSCRIBED') {
                    await this.channel.track({
                        displayName: this.displayName,
                        photoURL: this.photoURL,
                        joinedAt: new Date().toISOString()
                    });
                } else if (status === 'CHANNEL_ERROR') {
                    console.error(`[Error] Realtime Channel Error: Failed to subscribe. Check if your VITE_SUPABASE_ANON_KEY is a valid Supabase Anon key and not a payment key.`);
                }
            });
    }

    // Mutate moodboard in Supabase, then notify other clients via Realtime Broadcast
    async updateMoodboard(action, payload) {
        if (!this.token || !this.sessionId) return;

        try {
            const response = await fetch(`${API_URL}/api/collaboration/session/${this.sessionId}/update`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({ action, payload })
            });

            if (!response.ok) return;

            const data = await response.json();
            if (data.success && this.channel) {
                // Broadcast update so other clients apply modifications
                this.channel.send({
                    type: 'broadcast',
                    event: 'moodboard-updated',
                    payload: {
                        action,
                        payload,
                        moodboard: data.moodboard,
                        updatedBy: {
                            userId: this.userId,
                            displayName: this.displayName
                        }
                    }
                });
            }
        } catch (err) {
            console.error('Error updating moodboard:', err);
        }
    }

    // Broadcast cursor positions
    updateCursor(cursorData) {
        if (!this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: 'cursor-moved',
            payload: {
                userId: this.userId,
                displayName: this.displayName,
                cursor: cursorData
            }
        });
    }

    // Broadcast typing status
    updateTypingStatus(isTyping, field) {
        if (!this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: 'user-typing',
            payload: {
                userId: this.userId,
                displayName: this.displayName,
                isTyping,
                field
            }
        });
    }

    // Broadcast dragging positions
    moveItem(data) {
        if (!this.channel) return;

        this.channel.send({
            type: 'broadcast',
            event: 'item-moved',
            payload: {
                id: data.id,
                x: data.x,
                y: data.y,
                userId: this.userId
            }
        });
    }

    // Emit endpoint used for reactions
    async emit(event, data) {
        if (!this.token || !this.sessionId || !this.channel) return;

        if (event === 'add-reaction') {
            try {
                const response = await fetch(`${API_URL}/api/collaboration/session/${this.sessionId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ action: 'ADD_REACTION', payload: data })
                });

                if (response.ok) {
                    const resData = await response.json();
                    if (resData.success) {
                        this.channel.send({
                            type: 'broadcast',
                            event: 'reaction-added',
                            payload: {
                                itemId: data.itemId,
                                reaction: data.reaction
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error adding reaction:', err);
            }
        } else if (event === 'remove-reaction') {
            try {
                const response = await fetch(`${API_URL}/api/collaboration/session/${this.sessionId}/update`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    },
                    body: JSON.stringify({ action: 'REMOVE_REACTION', payload: data })
                });

                if (response.ok) {
                    const resData = await response.json();
                    if (resData.success) {
                        this.channel.send({
                            type: 'broadcast',
                            event: 'reaction-removed',
                            payload: {
                                itemId: data.itemId,
                                emoji: data.emoji,
                                userId: data.userId
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error removing reaction:', err);
            }
        }
    }

    // Unsubscribe from channel and notify backend database
    async leaveSession() {
        if (this.channel) {
            this.channel.unsubscribe();
            this.channel = null;
        }

        if (this.token && this.sessionId) {
            try {
                await fetch(`${API_URL}/api/collaboration/session/${this.sessionId}/leave`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            } catch (err) {
                console.error('Error leaving session:', err);
            }
        }

        this.sessionId = null;
        this.inviteCode = null;
        
        setTimeout(() => {
            this.trigger('disconnect', 'left-session');
        }, 100);
    }

    // Disconnect connection completely
    disconnect() {
        this.leaveSession();
        this.token = null;
        this.userId = null;
        this.displayName = null;
        this.photoURL = null;
    }

    // Event registration
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        return () => {
            this.off(event, callback);
        };
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }

    trigger(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(cb => {
                try {
                    cb(data);
                } catch (err) {
                    console.error(`Error in listener for event ${event}:`, err);
                }
            });
        }
    }
}

export default new SocketService();
