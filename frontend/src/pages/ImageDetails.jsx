import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; // Import auth instance directly
import { localRecommendationEngine } from '../services/localRecommendationEngine';
import Sidebar, { NavigationEvents } from '../components/Layout/Sidebar';
import '../styles/MainScreen.css';
import '../styles/ImageView.css';

const ImageDetails = ({ user, quota }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { image, allResults } = location.state || {};

    const [recommendations, setRecommendations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [moodboardImages, setMoodboardImages] = useState([]);
    const [offset, setOffset] = useState(0);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);

    // Initial load
    useEffect(() => {
        const fetchRecommendations = async () => {
            if (!image) return;

            setLoading(true);
            try {
                // Reset offset on new image
                setOffset(0);
                setHasMore(true);

                // Get token for authenticated backend requests
                let token = null;
                if (auth.currentUser) {
                    token = await auth.currentUser.getIdToken();
                }

                const recs = await localRecommendationEngine.generateRecommendations(
                    image,
                    allResults || [],
                    20,
                    0, // Initial offset
                    token // Pass token
                );
                setRecommendations(recs);
            } catch (err) {
                console.error('Error generating recommendations:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchRecommendations();
    }, [image, allResults]);

    // Load more function
    const loadMoreRecommendations = async () => {
        if (loadingMore || !hasMore || !image) return;

        setLoadingMore(true);
        const nextOffset = offset + 20;

        try {
            // Get token
            let token = null;
            if (auth.currentUser) {
                token = await auth.currentUser.getIdToken();
            }

            const newRecs = await localRecommendationEngine.generateRecommendations(
                image,
                allResults || [],
                20,
                nextOffset,
                token
            );

            if (newRecs && newRecs.length > 0) {
                // Filter out duplicates based on Image URL to handle fresh IDs for same content
                const existingUrls = new Set(recommendations.map(r => r.image.image));
                const uniqueNewRecs = newRecs.filter(r => !existingUrls.has(r.image.image));

                if (uniqueNewRecs.length > 0) {
                    setRecommendations(prev => [...prev, ...uniqueNewRecs]);
                    setOffset(nextOffset);
                } else {
                    // Stop if we only got duplicates (end of meaningful results)
                    setHasMore(false);
                }
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more recommendations:', error);
        } finally {
            setLoadingMore(false);
        }
    };

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && !loading && !loadingMore && hasMore) {
                    loadMoreRecommendations();
                }
            },
            { threshold: 0.5 }
        );

        const target = document.getElementById('load-more-target');
        if (target) {
            observer.observe(target);
        }

        return () => {
            if (target) observer.unobserve(target);
        };
    }, [loading, loadingMore, hasMore, recommendations, offset]);
    useEffect(() => {
        const searchUnsubscribe = NavigationEvents.subscribe(
            NavigationEvents.VIEWS.SEARCH,
            () => navigate('/')
        );

        const moodboardUnsubscribe = NavigationEvents.subscribe(
            NavigationEvents.VIEWS.MOODBOARD,
            () => navigate('/', { state: { showMoodboard: true } })
        );

        const libraryUnsubscribe = NavigationEvents.subscribe(
            NavigationEvents.VIEWS.LIBRARY,
            () => navigate('/', { state: { showLibrary: true } }) // Assuming MainScreen supports this or we add it
        );

        const auditUnsubscribe = NavigationEvents.subscribe(
            NavigationEvents.VIEWS.AI_AUDIT,
            () => navigate('/', { state: { showAIAudit: true } }) // Assuming MainScreen supports this or we add it
        );

        return () => {
            searchUnsubscribe();
            moodboardUnsubscribe();
            libraryUnsubscribe();
            auditUnsubscribe();
        };
    }, [navigate]);

    // Load saved moodboard
    useEffect(() => {
        const savedMoodboard = localStorage.getItem('moodboardImages');
        if (savedMoodboard) {
            try {
                setMoodboardImages(JSON.parse(savedMoodboard));
            } catch (e) {
                console.error('Error loading moodboard:', e);
            }
        }
    }, []);

    // Redirect if no image data
    useEffect(() => {
        if (!image) {
            navigate('/');
        }
    }, [image, navigate]);


    const handleBack = () => {
        navigate(-1);
    };

    // Explicitly handle "view moodboard" action from Sidebar if strictly needed via prop
    const handleViewMoodboard = () => {
        navigate('/', { state: { showMoodboard: true } });
    };

    const handleMoodboardToggle = (img, e) => {
        if (e) e.stopPropagation();

        const isInMoodboard = moodboardImages.some(item =>
            item._internalId === img._internalId
        );

        let updatedMoodboard;
        if (isInMoodboard) {
            updatedMoodboard = moodboardImages.filter(item => item._internalId !== img._internalId);
        } else {
            const imageWithTime = { ...img, addedAt: new Date().toISOString() };
            updatedMoodboard = [...moodboardImages, imageWithTime];
        }

        setMoodboardImages(updatedMoodboard);
        localStorage.setItem('moodboardImages', JSON.stringify(updatedMoodboard));

        window.dispatchEvent(new CustomEvent('moodboardUpdate', {
            detail: { count: updatedMoodboard.length }
        }));
    };

    const handleRecommendationClick = (recImage) => {
        navigate('/details', {
            state: {
                image: recImage,
                allResults: allResults
            }
        });
        window.scrollTo(0, 0);
    };

    if (!image) return null;

    const scrollRef = useRef(null);

    // Scroll to top when image changes
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
        window.scrollTo(0, 0); // Fallback
    }, [image]);

    return (
        <div className="main-screen">
            <Sidebar
                user={user}
                userQuota={quota}
                currentView="search" // Default to search or maybe null to show nothing active?
                onViewMoodboard={handleViewMoodboard}
            />

            <div className="content-area">
                <div
                    ref={scrollRef}
                    className="image-details-page"
                    style={{
                        minHeight: '100%',
                        paddingBottom: '40px',
                        width: '100%'
                    }}
                >
                    {/* Navigation Header */}
                    <div style={{ marginBottom: '40px', display: 'flex', alignItems: 'center' }}>
                        <button
                            onClick={handleBack}
                            className="back-button"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '8px',
                                border: 'none',
                                background: 'transparent',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#333',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.background = '#eee'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back
                        </button>
                    </div>

                    <div className="details-content" style={{ margin: '0 auto' }}>
                        {/* Main Image Section */}
                        <div className="main-image-container image-details-grid">
                            <div style={{
                                maxWidth: '600px',
                                width: '100%',
                                padding: '20px',
                            }}>
                                <div style={{ position: 'relative', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
                                    {/* Show loader while image loads */}
                                    <img
                                        src={image.fullImage || image.image}
                                        alt={image.title}
                                        onLoad={(e) => {
                                            e.target.style.opacity = 1;
                                        }}
                                        onError={(e) => {
                                            const src = e.target.src;
                                            // Pinterest high-res fallback chain: originals → 736x → 564x
                                            if (src.includes('/originals/')) {
                                                e.target.src = src.replace('/originals/', '/736x/');
                                            } else if (src.includes('/736x/')) {
                                                e.target.src = src.replace('/736x/', '/564x/');
                                            }
                                            // If 564x also fails, just show whatever loads
                                        }}
                                        style={{
                                            width: '100%',
                                            height: 'auto',
                                            maxWidth: '100%',
                                            borderRadius: '8px',
                                            display: 'block',
                                            opacity: 0,
                                            transition: 'opacity 0.3s ease-in-out',
                                            minHeight: '200px',
                                            backgroundColor: '#f5f5f5',
                                            imageRendering: '-webkit-optimize-contrast', // sharpens upscaled images
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="image-details-info">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <h1 style={{
                                        fontSize: '28px',
                                        fontWeight: '600',
                                        color: '#111',
                                        letterSpacing: '-0.5px',
                                        lineHeight: '1.2'
                                    }}>
                                        {image.title || 'Design Inspiration'}
                                    </h1>

                                    {image.source && (
                                        <span style={{
                                            fontSize: '14px',
                                            color: '#666',
                                            fontWeight: '400'
                                        }}>
                                            via {image.source}
                                        </span>
                                    )}
                                </div>

                                <div className="actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                                    <button
                                        onClick={(e) => handleMoodboardToggle(image, e)}
                                        style={{
                                            width: '100%',
                                            padding: '14px 24px',
                                            borderRadius: '8px',
                                            background: moodboardImages.some(i => i._internalId === image._internalId) ? '#333' : '#111',
                                            color: '#fff',
                                            border: 'none',
                                            fontSize: '14px',
                                            fontWeight: '500',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '10px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.target.style.background = '#333'}
                                        onMouseLeave={(e) => {
                                            if (!moodboardImages.some(i => i._internalId === image._internalId)) {
                                                e.target.style.background = '#111';
                                            }
                                        }}
                                    >
                                        {moodboardImages.some(i => i._internalId === image._internalId) ? (
                                            <>
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                Saved
                                            </>
                                        ) : (
                                            'Save to Moodboard'
                                        )}
                                    </button>

                                    {image.url && (
                                        <button
                                            onClick={() => window.open(image.url, '_blank')}
                                            style={{
                                                width: '100%',
                                                padding: '14px 24px',
                                                borderRadius: '8px',
                                                background: '#fff',
                                                color: '#111',
                                                border: '1px solid #e0e0e0',
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                transition: 'background 0.2s',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '8px'
                                            }}
                                            onMouseEnter={(e) => e.target.style.background = '#FAFAFA'}
                                            onMouseLeave={(e) => e.target.style.background = '#fff'}
                                        >
                                            Visit Website
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Recommendations Section */}
                        <div className="recommendations-section">
                            <h2 style={{
                                fontSize: '20px',
                                fontWeight: '600',
                                marginBottom: '30px',
                                color: '#111',
                                letterSpacing: '-0.3px'
                            }}>More like this</h2>

                            {loading && recommendations.length === 0 ? (
                                <div className="masonry-grid">
                                    {Array.from({ length: 12 }).map((_, index) => (
                                        <div key={index} className="masonry-item">
                                            <div
                                                className="masonry-image-container"
                                                style={{
                                                    borderRadius: '8px',
                                                    overflow: 'hidden',
                                                    background: '#f0f0f0',
                                                    position: 'relative'
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        width: '100%',
                                                        height: `${Math.floor(Math.random() * (400 - 200 + 1) + 200)}px`,
                                                        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
                                                        backgroundSize: '200% 100%',
                                                        animation: 'shimmer 1.5s infinite'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : recommendations.length > 0 ? (
                                <>
                                    <div className="masonry-grid">
                                        {recommendations.map((rec, index) => {
                                            if (!rec || !rec.image || !rec.image.image) return null;

                                            const recImage = rec.image;
                                            const isInMoodboard = moodboardImages.some(mb =>
                                                mb._internalId === recImage._internalId
                                            );

                                            return (
                                                <div key={index} className="masonry-item" onClick={() => handleRecommendationClick(recImage)}>
                                                    <div className="masonry-image-container" style={{ position: 'relative', cursor: 'pointer', borderRadius: '8px', overflow: 'hidden' }}>
                                                        <img
                                                            src={recImage.image}
                                                            alt={recImage.title}
                                                            className="masonry-image"
                                                            style={{ width: '100%', display: 'block', transition: 'transform 0.3s' }}
                                                        />
                                                        <div className="image-hover-overlay" style={{
                                                            background: 'linear-gradient(to top, rgba(0,0,0,0.4), transparent)',
                                                            display: 'flex',
                                                            alignItems: 'flex-end',
                                                            justifyContent: 'flex-end',
                                                            padding: '12px'
                                                        }}>
                                                            <button
                                                                className="moodboard-selection-button"
                                                                style={{
                                                                    background: isInMoodboard ? '#111' : '#fff',
                                                                    color: isInMoodboard ? '#fff' : '#111',
                                                                    border: 'none',
                                                                    cursor: 'pointer',
                                                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                                                }}
                                                                onClick={(e) => handleMoodboardToggle(recImage, e)}
                                                            >
                                                                {isInMoodboard ? 'Saved' : 'Save'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Intersection Observer Target for Infinite Scroll */}
                                    <div id="load-more-target" style={{ height: '60px', margin: '40px 0', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                                        {loadingMore && <span>Loading more ideas...</span>}
                                    </div>
                                </>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                    No similar designs found.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageDetails;
