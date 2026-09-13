import express from 'express';
import UserService from '../services/userService.js';
import { emailService } from '../services/emailService.js';
import { supabaseAdmin } from '../config/supabaseClient.js';

export default function setupTeamRoutes(app, { authenticateUser }) {
    // Get team members
    app.get('/api/team/members', authenticateUser, async (req, res) => {
        try {
            const currentUser = await UserService.findByUid(req.user.uid || req.user.id);
            if (!currentUser || !['team', 'team_annual', 'lifetime', 'admin'].includes(currentUser.role)) {
                return res.status(403).json({ error: 'Team features require a Pro plan' });
            }

            // Find all users who have this user as their teamOwner via Supabase
            const { data: teamMembers } = await supabaseAdmin
                .from('profiles')
                .select('id, email, display_name, photo_url')
                .eq('team->>teamOwner', req.user.uid || req.user.id);

            res.json({
                success: true,
                members: (teamMembers || []).map(m => ({
                    uid: m.id, email: m.email,
                    displayName: m.display_name, photoURL: m.photo_url
                }))
            });
        } catch (error) {
            console.error('Error fetching team members:', error);
            res.status(500).json({ error: 'Failed to fetch team members' });
        }
    });

    // Invite a team member
    app.post('/api/team/invite', authenticateUser, async (req, res) => {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ error: 'Email is required' });
            }

            const currentUser = await UserService.findByUid(req.user.uid || req.user.id);
            if (!currentUser || !['team', 'team_annual', 'lifetime', 'admin'].includes(currentUser.role)) {
                return res.status(403).json({ error: 'Team features require a Pro plan' });
            }

            const planLimits = currentUser.getPlanLimits();
            const maxMembers = planLimits.maxTeamMembers || 0;

            if (maxMembers === 0 && !['lifetime', 'admin'].includes(currentUser.role)) {
                return res.status(403).json({ error: 'Your plan does not support team members' });
            }

            // Check how many members currently exist
            const { count } = await supabaseAdmin
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('team->>teamOwner', currentUser.id);
            const currentMembersCount = count || 0;

            if (currentMembersCount >= maxMembers && !['lifetime', 'admin'].includes(currentUser.role)) {
                return res.status(403).json({ error: `You have reached the maximum of ${maxMembers} team members` });
            }

            // Check if user already exists in DB
            let targetUser = await UserService.findByEmail(email);
            if (!targetUser) {
                // Create a placeholder user
                targetUser = await UserService.createUser({
                    uid: 'invited_' + Date.now() + '_' + Math.random().toString(36).substring(7),
                    email: email,
                    role: 'team',
                    team: {
                        isTeamMember: true,
                        teamOwner: currentUser.id
                    }
                });
            } else {
                if (targetUser.team && targetUser.team.isTeamMember) {
                    return res.status(400).json({ error: 'User is already part of a team' });
                }

                await UserService.updateUser(targetUser.id, {
                    team: { isTeamMember: true, teamOwner: currentUser.id },
                    role: 'team'
                });
            }

            // Send the email
            const inviteLink = `https://app.inspoai.live/signup?teamOwner=${currentUser.id}`;
            await emailService.sendTeamInviteEmail(currentUser.displayName || currentUser.email, email, inviteLink);

            res.json({
                success: true,
                message: 'Invitation sent successfully'
            });
        } catch (error) {
            console.error('Error sending team invite:', error);
            res.status(500).json({ error: 'Failed to send team invitation' });
        }
    });
}
