import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SocketService from '../../../services/SocketService';

// Function to generate random colors for cursors
const getRandomColor = () => {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#D4A5A5', '#9B59B6', '#3498DB'];
    return colors[Math.floor(Math.random() * colors.length)];
};

const LiveCursors = ({ containerRef, transformRef }) => {
    const [cursors, setCursors] = useState({});
    const [clickAnimations, setClickAnimations] = useState({});

    useEffect(() => {
        // Subscribe to cursor events here to avoid re-rendering the parent LiveBoard
        const offCursorMoved = SocketService.on('cursor-moved', (data) => {
            setCursors(prev => ({
                ...prev,
                [data.userId]: {
                    ...data.cursor,
                    displayName: data.displayName,
                    color: prev[data.userId]?.color || getRandomColor()
                }
            }));
        });

        const offParticipantLeft = SocketService.on('participant-left', (data) => {
            setCursors(prev => {
                const updatedCursors = { ...prev };
                delete updatedCursors[data.userId];
                return updatedCursors;
            });
        });

        return () => {
            if (typeof offCursorMoved === 'function') offCursorMoved();
            if (typeof offParticipantLeft === 'function') offParticipantLeft();
        };
    }, []);

    // Listen for click events from cursors (derived from state changes)
    useEffect(() => {
        Object.entries(cursors).forEach(([userId, cursorData]) => {
            if (cursorData.clicked && !clickAnimations[userId]) {
                setClickAnimations(prev => ({ ...prev, [userId]: true }));
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

    return (
        <div className="cursor-layer" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 9999
        }}>
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
                                damping: 40, // Reduced damping for snappier feel
                                stiffness: 500,
                                mass: 0.2
                            }}
                        >
                            {/* Cursor Icon */}
                            <svg
                                width="45"
                                height="45"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                style={{
                                    filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.2))',
                                    transform: `scale(${clickAnimations[userId] ? 0.9 : 1}) rotate(${clickAnimations[userId] ? -10 : 0}deg)`,
                                    transition: 'transform 0.1s'
                                }}
                            >
                                <path
                                    d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19177L17.9169 12.3673H5.65376Z"
                                    fill={cursorData.color || '#FE5431'}
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                />
                            </svg>

                            {/* Label */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 26,
                                    left: 20,
                                    backgroundColor: cursorData.color || '#FE5431',
                                    color: 'white',
                                    padding: '3px 10px',
                                    borderRadius: 6,
                                    fontSize: 20,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
                                }}
                            >
                                {cursorData.displayName || 'User'}
                            </div>

                            {/* Click Ripple */}
                            {clickAnimations[userId] && (
                                <motion.div
                                    style={{
                                        position: 'absolute',
                                        top: -10,
                                        left: -10,
                                        width: 44,
                                        height: 44,
                                        borderRadius: '50%',
                                        border: `2px solid ${cursorData.color || '#FE5431'}`,
                                        pointerEvents: 'none'
                                    }}
                                    initial={{ scale: 0.5, opacity: 1 }}
                                    animate={{ scale: 1.5, opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                />
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};

export default React.memo(LiveCursors);
