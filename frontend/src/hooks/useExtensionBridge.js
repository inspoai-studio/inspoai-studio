// =========================================================
// useExtensionBridge — Inspo AI Frontend
// Listens for postMessage events from the Chrome extension
// and adds captured images directly into the active moodboard
// =========================================================

import { useEffect } from 'react';

const MOODBOARD_KEY = 'moodboardImages';

export function useExtensionBridge() {
    useEffect(() => {
        const handleMessage = (event) => {
            // Only process INSPO_ADD_IMAGE messages from the extension
            // The extension sidebar shell posts from chrome-extension:// origin
            if (event.data?.type !== 'INSPO_ADD_IMAGE') return;

            const { imageUrl, pageUrl, pageTitle, domain, altText, base64 } = event.data.payload || {};

            if (!imageUrl) return;

            // Build the moodboard image object — matches existing MoodboardPreview schema
            // Prefer base64 as the image src when available — this ensures images from
            // LinkedIn, Twitter, and other hotlink-protected CDNs will upload correctly
            // to Cloudinary when the moodboard is shared.
            const newImage = {
                image: base64 || imageUrl,          // prefer base64 so Cloudinary can always upload it
                _originalUrl: imageUrl,             // keep original for deduplication & source display
                title: pageTitle || domain || 'Web capture',
                source: domain || '',
                url: pageUrl || '',
                altText: altText || '',
                addedAt: Date.now(),
                _fromExtension: true,
                _hasBase64: !!base64,               // flag so backend knows to use uploadBase64()
            };

            // Read current board, append, write back
            try {
                const existing = JSON.parse(localStorage.getItem(MOODBOARD_KEY) || '[]');

                // Deduplicate by imageUrl
                const alreadyAdded = existing.some(
                    (img) => (img._originalUrl || img.image || img.url) === imageUrl
                );

                if (!alreadyAdded) {
                    const updated = [...existing, newImage];
                    localStorage.setItem(MOODBOARD_KEY, JSON.stringify(updated));

                    // Fire the existing moodboardUpdate event so MoodboardPreview re-renders
                    window.dispatchEvent(
                        new CustomEvent('moodboardUpdate', { detail: { count: updated.length } })
                    );

                } else {
                }
            } catch (err) {
                console.error('[InspoAI Bridge] Failed to update moodboard:', err);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);
}

