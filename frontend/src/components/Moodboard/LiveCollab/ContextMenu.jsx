import React from 'react';
import { Lock, Unlock, Trash2, Send, BringToFront } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const NOTE_COLORS = ['#fff099', '#cbf0f8', '#ccff90', '#fbbc04', '#d7aefb', '#ffffff'];

const ContextMenu = ({ x, y, itemId, isLocked, type, itemColor, onColorChange, onLock, onUnlock, onDelete, onClose }) => {
    return (
        <AnimatePresence>
            <motion.div
                className="context-menu glass-panel"
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                    position: 'fixed',
                    top: y,
                    left: x,
                    zIndex: 10000,
                    minWidth: 180,
                    padding: 6,
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(12px)',
                    borderRadius: 12,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                    border: '1px solid rgba(255,255,255,0.5)',
                    flexDirection: 'column',
                    display: 'flex'
                }}
                onMouseLeave={onClose}
            >
                {/* Note Colors */}
                {type === 'note' && !isLocked && (
                    <div style={{ padding: '8px 4px', display: 'flex', gap: 6, borderBottom: '1px solid rgba(0,0,0,0.06)', marginBottom: 4, justifyContent: 'center' }}>
                        {NOTE_COLORS.map(color => (
                            <motion.button
                                key={color}
                                onClick={(e) => { e.stopPropagation(); onColorChange(color); }}
                                whileHover={{ scale: 1.2 }}
                                whileTap={{ scale: 0.9 }}
                                style={{
                                    width: 22,
                                    height: 22,
                                    borderRadius: '50%',
                                    background: color,
                                    border: color === (itemColor || '#fff099') ? '2px solid #555' : '1px solid rgba(0,0,0,0.15)',
                                    cursor: 'pointer',
                                    padding: 0
                                }}
                            />
                        ))}
                    </div>
                )}

                {isLocked ? (
                    <button className="context-menu-item" onClick={() => { onUnlock(); onClose(); }}>
                        <Unlock size={14} />
                        <span>Unlock</span>
                    </button>
                ) : (
                    <>
                        <button className="context-menu-item warning" onClick={() => { onLock(); onClose(); }}>
                            <Lock size={14} />
                            <span>Lock</span>
                        </button>
                        <div className="menu-divider" />
                        <button className="context-menu-item" onClick={() => { /* TODO */ onClose(); }}>
                            <BringToFront size={14} />
                            <span>Bring to Front</span>
                        </button>
                        <button className="context-menu-item" onClick={() => { /* TODO */ onClose(); }}>
                            <Send size={14} />
                            <span>Send to Back</span>
                        </button>
                        <div className="menu-divider" />
                        <button className="context-menu-item destructive" onClick={() => { onDelete(); onClose(); }}>
                            <Trash2 size={14} />
                            <span>Delete</span>
                        </button>
                    </>
                )}
            </motion.div>
        </AnimatePresence>
    );
};

export default ContextMenu;
