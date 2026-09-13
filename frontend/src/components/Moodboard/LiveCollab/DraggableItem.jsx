import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import ItemReactions from './ItemReactions';

// Simplified DraggableItem that trusts the parent to handle positioning
// effectively supports both React state updates and direct DOM manipulation via ref
const DraggableItem = forwardRef(({
    item,
    isSelected,
    onSelect,
    onUpdate,
    isBeingEditedBy,
    onAddReactionRequest,
    onAddReaction,
    onRemoveReaction,
    currentUserId
}, ref) => {

    // Extract positioning to ensure it's explicitly applied
    // This allows the parent to control it completely
    const x = item.x || 0;
    const y = item.y || 0;
    const rotation = item.rotation || 0;
    const width = item.width || 200;
    const height = item.height || 200;

    // Use a stable ID for the data attribute
    const stableId = item.id || item._id || item._internalId;

    return (
        <div
            ref={ref}
            data-id={stableId}
            data-rotation={rotation}
            className={`drag-item ${isSelected ? 'selected' : ''}`}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${width}px`,
                height: `${height}px`,
                transform: `translate(${x}px, ${y}px) rotate(${rotation}deg)`,
                zIndex: isSelected ? 1000 : (item.zIndex || 1),
                boxSizing: 'border-box',
                cursor: item.locked ? 'not-allowed' : 'pointer',
                opacity: item.locked ? 0.9 : 1,
                // Critical: Allow pointer events so we can select/drag
                pointerEvents: 'auto'
            }}
            onClick={(e) => {
                e.stopPropagation();
                if (onSelect) onSelect(stableId, e);
            }}
            // Add double click to edit notes
            onDoubleClick={(e) => {
                if (item.type === 'note' && !item.locked && onUpdate) {
                    // Logic for text editing could be moved here or simpler:
                    // Just let the parent handle the "editing" state
                }
            }}
        >
            {/* Selection Ring */}
            {isSelected && !item.locked && (
                <div style={{
                    position: 'absolute',
                    top: -2, left: -2, right: -2, bottom: -2,
                    border: '2px solid #6366f1',
                    borderRadius: 4,
                    pointerEvents: 'none',
                    zIndex: 2000
                }} />
            )}

            {/* Lock UI */}
            {item.locked && (
                <div style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'rgba(0,0,0,0.6)', color: 'white',
                    borderRadius: '50%', padding: 4,
                    zIndex: 2001
                }}>
                    <Lock size={12} />
                </div>
            )}

            {/* Remote User Label */}
            {isBeingEditedBy && (
                <div style={{
                    position: 'absolute', top: -24, left: 0,
                    background: isBeingEditedBy.color || '#f00',
                    color: 'white', padding: '2px 6px', borderRadius: 4,
                    fontSize: 10, fontWeight: 'bold', whiteSpace: 'nowrap',
                    zIndex: 3000
                }}>
                    {isBeingEditedBy.displayName}
                </div>
            )}

            {/* Content Rendering */}
            <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
                {item.type === 'image' ? (
                    <img
                        src={item.fullImage || item.image || item.src}
                        alt="moodboard"
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', userSelect: 'none' }}
                        onError={(e) => {
                            console.error("[Error] Image Load Failed:", item.image || item.src, "Item ID:", stableId);
                            e.target.style.display = 'none'; // Hide broken image so we see container
                        }}
                    />
                ) : (
                    <NoteContent item={item} onUpdate={onUpdate} stableId={stableId} />
                )}
            </div>

            {/* Reactions */}
            {onAddReactionRequest && (
                <ItemReactions
                    itemId={stableId}
                    reactions={item.reactions || []}
                    onAddReactionRequest={onAddReactionRequest}
                    onAddReaction={onAddReaction}
                    onRemoveReaction={onRemoveReaction}
                    currentUserId={currentUserId}
                />
            )}
        </div>
    );
});

// Separated Note Content to manage text area focus properly
const NoteContent = ({ item, onUpdate, stableId }) => {
    const [isEditing, setIsEditing] = React.useState(false);

    const handleTextChange = (e) => {
        if (onUpdate) {
            onUpdate(stableId, { text: e.target.value });
        }
    };

    return (
        <div
            style={{
                width: '100%', height: '100%',
                backgroundColor: item.color || '#fff9c4',
                padding: '16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                userSelect: 'none', // Prevent text selection interfering with drag
                cursor: 'pointer'
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
        >
            {isEditing ? (
                <textarea
                    autoFocus
                    defaultValue={item.text}
                    onBlur={() => setIsEditing(false)}
                    onChange={handleTextChange}
                    onKeyDown={(e) => { e.stopPropagation(); }} // Allow typing
                    style={{
                        width: '100%', height: '100%',
                        background: 'transparent', border: 'none', resize: 'none',
                        textAlign: 'center', fontFamily: 'sans-serif', fontSize: '16px',
                        userSelect: 'text', cursor: 'text'
                    }}
                />
            ) : (
                <div style={{
                    whiteSpace: 'pre-wrap',
                    textAlign: 'center',
                    fontFamily: 'sans-serif',
                    fontSize: '16px',
                    pointerEvents: 'none', // Allow clicks to pass through to parent
                    userSelect: 'none'
                }}>
                    {item.text || 'New Note'}
                </div>
            )}
        </div>
    );
};

export default React.memo(DraggableItem);
