import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SquareStack, Layers, Info, Trash2, Lock, Unlock, MoreHorizontal } from 'lucide-react';

const ItemToolbar = ({
    item,
    position,
    onDelete,
    onLock,
    onUnlock,
    onBringToFront,
    onSendToBack,
    onUpdate
}) => {
    if (!item) return null;

    const isLocked = item.locked;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="item-floating-toolbar glass-panel"
            style={{
                position: 'fixed',
                top: position.y - 64, // Slightly higher
                left: position.x,
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px', // Slightly wider gap
                padding: '8px',
                borderRadius: '16px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                border: '1px solid rgba(255, 255, 255, 0.5)',
                zIndex: 5000,
                pointerEvents: 'auto'
            }}
        >
            {!isLocked ? (
                <>
                    <button className="toolbar-btn" onClick={onBringToFront} title="Bring to Front">
                        <SquareStack size={18} strokeWidth={1.5} />
                    </button>
                    <button className="toolbar-btn" onClick={onSendToBack} title="Send to Back">
                        <Layers size={18} strokeWidth={1.5} />
                    </button>
                    <button className="toolbar-btn" onClick={onUpdate} title="Settings">
                        <Info size={18} strokeWidth={1.5} />
                    </button>
                    <div className="toolbar-divider" />
                    <button className="toolbar-btn warning" onClick={onLock} title="Lock">
                        <Lock size={18} strokeWidth={1.5} />
                    </button>
                    <button className="toolbar-btn destructive" onClick={onDelete} title="Delete">
                        <Trash2 size={18} strokeWidth={1.5} />
                    </button>
                </>
            ) : (
                <button className="toolbar-btn" onClick={onUnlock} title="Unlock">
                    <Unlock size={18} strokeWidth={1.5} />
                    <span style={{ fontSize: '13px', marginLeft: '8px', fontWeight: 600 }}>Unlock to Edit</span>
                </button>
            )}

            <div className="toolbar-divider" />
            <button className="toolbar-btn">
                <MoreHorizontal size={18} strokeWidth={1.5} />
            </button>
        </motion.div>
    );
};

export default ItemToolbar;
