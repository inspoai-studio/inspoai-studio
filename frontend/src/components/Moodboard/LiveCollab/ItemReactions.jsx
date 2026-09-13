import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smile } from 'lucide-react';

// Dumb component that just renders bubbles and the button
const ItemReactions = ({ itemId, reactions = [], onAddReactionRequest, onAddReaction, onRemoveReaction, currentUserId }) => {

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
        if (!acc[reaction.emoji]) {
            acc[reaction.emoji] = {
                emoji: reaction.emoji,
                count: 0,
                users: []
            };
        }
        acc[reaction.emoji].count++;
        acc[reaction.emoji].users.push(reaction.user);
        return acc;
    }, {});

    const handleReactionClick = (e) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent focus stealing

        // Get button position relative to VIEWPORT (for global picker positioning)
        const rect = e.currentTarget.getBoundingClientRect();

        onAddReactionRequest({
            itemId,
            x: rect.left + rect.width / 2, // Center horizontally
            y: rect.top - 10 // Slightly above the button
        });
    };

    return (
        <div
            className="item-reactions-container"
            style={{
                position: 'absolute',
                bottom: -35,
                left: '50%', // Center visually
                transform: 'translateX(-50%)', // Center
                display: 'flex',
                gap: 6,
                alignItems: 'center',
                pointerEvents: 'auto',
                zIndex: 100
            }}
            onMouseDown={(e) => e.stopPropagation()} // Stop drag initiation
            onClick={(e) => e.stopPropagation()}     // Stop selection
        >
            {/* Existing Reactions */}
            <AnimatePresence>
                {Object.values(groupedReactions).map((reaction) => (
                    <ReactionBubble
                        key={reaction.emoji}
                        reaction={reaction}
                        currentUserId={currentUserId}
                        onRemove={() => onRemoveReaction(itemId, reaction.emoji)}
                        onAdd={() => onAddReaction(itemId, reaction.emoji)}
                    />
                ))}
            </AnimatePresence>


            {/* Add Reaction Button */}
            <motion.button
                className="add-reaction-btn"
                onClick={handleReactionClick}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                style={{
                    background: 'rgba(255,255,255,0.9)',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 12,
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                }}
            >
                <Smile size={16} color="#666" />
            </motion.button>
        </div>
    );
};

const ReactionBubble = ({ reaction, onRemove, onAdd, currentUserId }) => {
    // Check if current user has reacted with this emoji
    const hasReacted = reaction.users.some(u => u.userId === currentUserId);

    return (
        <motion.div
            className="reaction-bubble"
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 8px',
                borderRadius: 12,
                background: hasReacted ? '#E3F2FD' : 'rgba(255,255,255,0.95)', // Highlight if I reacted
                border: hasReacted ? '1px solid #2196F3' : '1px solid rgba(0,0,0,0.1)',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                userSelect: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
            initial={{ scale: 0, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0, y: -20 }}
            whileHover={{ scale: 1.1 }}
            onClick={(e) => {
                e.stopPropagation();
                if (hasReacted) onRemove();
                else if (onAdd) onAdd();
            }}
            title={`${reaction.users.map(u => u.displayName).join(', ')}`}
        >
            <span style={{ fontSize: 16 }}>{reaction.emoji}</span>
            <span style={{ color: hasReacted ? '#1565C0' : '#666' }}>{reaction.count}</span>
        </motion.div>
    );
};

// Export constants and picker for global use
export const EMOJI_REACTIONS = ['👍', '❤️', '🔥', '🎉', '😍', '👏', '💡', '✨'];

export const ReactionPicker = ({ onReact, onClose, position }) => {
    return (
        <motion.div
            className="reaction-picker glass-panel"
            style={{
                position: 'fixed', // Fixed to viewport
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -100%)', // Center horizontally, place above
                display: 'flex',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 12,
                zIndex: 10000,
                boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.5)'
            }}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
        >
            {EMOJI_REACTIONS.map((emoji) => (
                <motion.button
                    key={emoji}
                    className="reaction-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        onReact(emoji);
                    }}
                    whileHover={{ scale: 1.3 }}
                    whileTap={{ scale: 0.9 }}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        fontSize: 24,
                        cursor: 'pointer',
                        padding: 4,
                        borderRadius: 6,
                        transition: 'background 0.2s'
                    }}
                >
                    {emoji}
                </motion.button>
            ))}
        </motion.div>
    );
};

export default ItemReactions;
