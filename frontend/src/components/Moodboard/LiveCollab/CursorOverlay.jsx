import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const CursorOverlay = ({ cursors }) => {
    const [clickAnimations, setClickAnimations] = useState({});

    // Listen for click events from cursors
    useEffect(() => {
        Object.entries(cursors).forEach(([userId, cursorData]) => {
            if (cursorData.clicked && !clickAnimations[userId]) {
                // Trigger click animation
                setClickAnimations(prev => ({ ...prev, [userId]: true }));

                // Remove animation after 600ms
                setTimeout(() => {
                    setClickAnimations(prev => {
                        const updated = { ...prev };
                        delete updated[userId];
                        return updated;
                    });
                }, 600);
            }
        });
    }, [cursors]);

    // Debug: Log cursor data
    useEffect(() => {
    }, [cursors]);

    return (
        <div className="cursor-container" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 9999 }}>
            <AnimatePresence>
                {Object.entries(cursors).map(([userId, cursorData]) => {
                    if (!cursorData || cursorData.x === undefined) return null;

                    return (
                        <motion.div
                            key={userId}
                            className="cursor-wrapper"
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                pointerEvents: 'none'
                            }}
                            initial={{ opacity: 0, scale: 0.3 }}
                            animate={{
                                x: cursorData.x,
                                y: cursorData.y,
                                opacity: 1,
                                scale: 1
                            }}
                            exit={{ opacity: 0, scale: 0.3 }}
                            transition={{
                                type: "spring",
                                damping: 30,
                                stiffness: 400,
                                mass: 0.3
                            }}
                        >
                            {/* Cursor Trail Effect */}
                            {cursorData.isDragging && (
                                <motion.div
                                    style={{
                                        position: 'absolute',
                                        top: -4,
                                        left: -4,
                                        width: 32,
                                        height: 32,
                                        borderRadius: '50%',
                                        background: `radial-gradient(circle, ${cursorData.color || '#FE5431'}40, transparent)`,
                                        pointerEvents: 'none'
                                    }}
                                    animate={{
                                        scale: [1, 1.8, 1],
                                        opacity: [0.4, 0.1, 0.4]
                                    }}
                                    transition={{
                                        duration: 1.5,
                                        repeat: Infinity,
                                        ease: 'easeInOut'
                                    }}
                                />
                            )}

                            {/* Cursor Icon with enhanced shadow */}
                            <motion.svg
                                width="28"
                                height="28"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                    filter: 'drop-shadow(0px 3px 10px rgba(0,0,0,0.25))'
                                }}
                                animate={{
                                    scale: clickAnimations[userId] ? 0.85 : 1,
                                    rotate: clickAnimations[userId] ? -5 : 0
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 500,
                                    damping: 15
                                }}
                            >
                                <path
                                    d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L17.9169 12.3673H5.65376Z"
                                    fill={cursorData.color || '#FE5431'}
                                    stroke="white"
                                    strokeWidth="1.8"
                                    strokeLinejoin="round"
                                />
                            </motion.svg>

                            {/* Click Ripple Effect - Enhanced */}
                            <AnimatePresence>
                                {clickAnimations[userId] && (
                                    <>
                                        <motion.div
                                            style={{
                                                position: 'absolute',
                                                top: -8,
                                                left: -8,
                                                width: 44,
                                                height: 44,
                                                borderRadius: '50%',
                                                border: `3px solid ${cursorData.color || '#FE5431'}`,
                                                pointerEvents: 'none'
                                            }}
                                            initial={{ scale: 0.3, opacity: 0.9 }}
                                            animate={{ scale: 2.5, opacity: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.6, ease: 'easeOut' }}
                                        />
                                        <motion.div
                                            style={{
                                                position: 'absolute',
                                                top: -4,
                                                left: -4,
                                                width: 36,
                                                height: 36,
                                                borderRadius: '50%',
                                                backgroundColor: `${cursorData.color || '#FE5431'}30`,
                                                pointerEvents: 'none'
                                            }}
                                            initial={{ scale: 0.5, opacity: 0.6 }}
                                            animate={{ scale: 2, opacity: 0 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.5, ease: 'easeOut' }}
                                        />
                                    </>
                                )}
                            </AnimatePresence>

                            {/* User Name Label - Enhanced */}
                            <motion.div
                                className="cursor-label"
                                style={{
                                    position: 'absolute',
                                    top: 24,
                                    left: 24,
                                    backgroundColor: cursorData.color || '#FE5431',
                                    color: 'white',
                                    padding: '5px 10px',
                                    borderRadius: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2), 0 2px 4px rgba(0,0,0,0.1)',
                                    userSelect: 'none',
                                    backdropFilter: 'blur(8px)',
                                    border: '1.5px solid rgba(255,255,255,0.3)'
                                }}
                                initial={{ opacity: 0, y: -8, scale: 0.8 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20
                                }}
                            >
                                {cursorData.displayName || 'Anonymous'}

                                {/* Selection Indicator - Enhanced */}
                                {cursorData.selectedItem && (
                                    <motion.span
                                        style={{
                                            marginLeft: 8,
                                            display: 'inline-block',
                                            fontSize: 14
                                        }}
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 400,
                                            damping: 15
                                        }}
                                    >
                                        ✓
                                    </motion.span>
                                )}

                                {/* Dragging Indicator */}
                                {cursorData.isDragging && (
                                    <motion.span
                                        style={{
                                            marginLeft: 8,
                                            display: 'inline-block',
                                            fontSize: 11,
                                            opacity: 0.9
                                        }}
                                        animate={{
                                            opacity: [0.6, 1, 0.6]
                                        }}
                                        transition={{
                                            duration: 1.2,
                                            repeat: Infinity,
                                            ease: 'easeInOut'
                                        }}
                                    >
                                        ⋯
                                    </motion.span>
                                )}
                            </motion.div>

                            {/* Active Indicator Pulse */}
                            <motion.div
                                style={{
                                    position: 'absolute',
                                    top: 10,
                                    left: 10,
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    backgroundColor: cursorData.color || '#FE5431',
                                    boxShadow: `0 0 8px ${cursorData.color || '#FE5431'}`
                                }}
                                animate={{
                                    scale: [1, 1.3, 1],
                                    opacity: [0.8, 1, 0.8]
                                }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: 'easeInOut'
                                }}
                            />
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default CursorOverlay;
