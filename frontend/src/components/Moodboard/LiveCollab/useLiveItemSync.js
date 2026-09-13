import { useEffect, useRef } from 'react';
import SocketService from '../../../services/SocketService';

/**
 * Custom hook to handle high-performance live synchronization of moodboard items.
 * Bypasses React state for movement updates to ensure 60fps performance.
 * 
 * @param {Function} setItems - React state setter for items (used for final consistency)
 * @returns {Object} itemRefs - Ref object to attach to item elements
 */
export const useLiveItemSync = (setItems) => {
    // Map of item ID -> DOM Element
    const itemRefs = useRef({});

    useEffect(() => {
        // Listen for volatile move events
        const offSyncMove = SocketService.on('item-moved', (data) => {
            const { id, x, y } = data;

            // 1. Direct DOM Manipulation (FAST)
            const element = itemRefs.current[id];

            if (element) {
                // We MUST preserve rotation if it exists
                const rotation = element.getAttribute('data-rotation') || 0;
                element.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                element.setAttribute('data-x', x);
                element.setAttribute('data-y', y);
            } else {
                // Fallback for when ref is missing
                const fallbackEl = document.querySelector(`[data-id="${id}"]`);
                if (fallbackEl) {
                    const rotation = fallbackEl.getAttribute('data-rotation') || 0;
                    fallbackEl.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg)`;
                }
            }
        });

        // 2. State Update (CONSISTENCY)
        // REMOVED: Updating state on every volatile move causes re-renders that reset the DOM transform
        // We rely on 'moodboard-updated' (UPDATE_IMAGE) for the final persistent state.
        // setItems(prev => prev.map(item => {
        //     // Check all possible ID variants
        //     // if (item.id === id || item._id === id || item._internalId === id) {
        //     //     return { ...item, x, y };
        //     // }
        //     return item;
        // }));

        return () => {
            offSyncMove();
        };
    }, [setItems]);

    return itemRefs;
};
