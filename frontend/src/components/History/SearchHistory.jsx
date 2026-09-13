import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HistoryService from '../../services/HistoryService';
import '../../styles/SearchHistory.css';
import { auth } from '../../firebase';
import {
    Clock,
    Search,
    Trash2,
    X,
    Image,
    AlertCircle,
    RefreshCw
} from 'lucide-react';

const SearchHistory = () => {
    const navigate = useNavigate();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [historyLimit, setHistoryLimit] = useState(5);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                fetchHistory();
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchHistory = async () => {
        try {
            setLoading(true);
            const response = await HistoryService.getHistory();
            setHistory(response.history || []);
            setHistoryLimit(response.limit || 5);
            setError(null);
        } catch (err) {
            console.error('Error fetching history:', err);
            setError('Failed to load your search history');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (index) => {
        if (window.confirm('Are you sure you want to delete this search from history?')) {
            try {
                await HistoryService.deleteHistoryEntry(index);
                setHistory(history.filter((_, i) => i !== index));
                setShowModal(false);
            } catch (err) {
                console.error('Error deleting history entry:', err);
                alert('Failed to delete history entry. Please try again.');
            }
        }
    };

    const handleClearAll = async () => {
        if (window.confirm('Are you sure you want to clear all search history? This action cannot be undone.')) {
            try {
                await HistoryService.clearAllHistory();
                setHistory([]);
            } catch (err) {
                console.error('Error clearing history:', err);
                alert('Failed to clear history. Please try again.');
            }
        }
    };

    const openEntry = (entry) => {
        setSelectedEntry(entry);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedEntry(null);
    };

    const repeatSearch = (entry) => {
        // Navigate back to search with the same parameters
        const params = new URLSearchParams({
            q: entry.query,
            ...(entry.params?.industry && { industry: entry.params.industry }),
            ...(entry.params?.designStyle && { designStyle: entry.params.designStyle }),
            ...(entry.params?.color && { color: entry.params.color }),
            ...(entry.params?.font && { font: entry.params.font })
        });
        navigate(`/?${params.toString()}`);
    };

    const handleImageError = (e) => {
        e.target.onerror = null;
        e.target.src = '/image-placeholder.svg';
    };

    if (loading) {
        return (
            <div className="search-history">
                <h1>Search History</h1>
                <div className="loading-spinner">
                    <div className="spinner"></div>
                    <p>Loading your search history...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="search-history">
                <h1>Search History</h1>
                <div className="error-message">
                    <p><AlertCircle size={20} className="error-icon" /> {error}</p>
                    <button onClick={fetchHistory} className="retry-button">
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="search-history">
            <div className="history-header">
                <div>
                    <h1>Search History</h1>
                    <p className="history-subtitle">
                        {history.length} of {historyLimit} searches saved
                        {user?.role === 'admin' && <span className="admin-badge">Admin (10 max)</span>}
                    </p>
                </div>
                {history.length > 0 && (
                    <button onClick={handleClearAll} className="clear-all-button">
                        <Trash2 size={16} /> Clear All
                    </button>
                )}
            </div>

            {history.length === 0 ? (
                <div className="empty-history">
                    <Search size={64} className="empty-history-icon" />
                    <h2>No Search History Yet</h2>
                    <p>Your search history will appear here automatically</p>
                    <button onClick={() => navigate('/')} className="start-search-button">
                        Start Searching
                    </button>
                </div>
            ) : (
                <div className="history-grid">
                    {history.map((entry, index) => (
                        <div
                            key={index}
                            className="history-card"
                            onClick={() => openEntry(entry)}
                            role="button"
                            tabIndex={0}
                        >
                            <div className="history-preview">
                                {entry.images && entry.images.length > 0 ? (
                                    <div className={`history-images-grid count-${Math.min(entry.images.length, 4)}`}>
                                        {entry.images.slice(0, 4).map((img, idx) => (
                                            <img
                                                key={idx}
                                                src={img.url || img.thumbnail}
                                                alt={img.title || 'Search result'}
                                                onError={handleImageError}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="placeholder-img">
                                        <Image size={48} className="placeholder-icon" />
                                    </div>
                                )}
                            </div>

                            <div className="history-info">
                                <h3>{entry.query}</h3>
                                <div className="history-meta">
                                    <div className="meta-item">
                                        <Clock size={14} className="meta-icon" />
                                        {new Date(entry.timestamp).toLocaleDateString()}
                                    </div>
                                    {entry.params && Object.keys(entry.params).length > 0 && (
                                        <span className="params-count">
                                            {Object.keys(entry.params).length} filters
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="history-actions">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        repeatSearch(entry);
                                    }}
                                    className="action-button repeat"
                                    title="Repeat this search"
                                >
                                    <RefreshCw size={16} />
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(index);
                                    }}
                                    className="action-button delete"
                                    title="Delete from history"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* History Entry Modal */}
            {showModal && selectedEntry && (
                <div className="history-modal-overlay" onClick={closeModal}>
                    <div className="history-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-modal" onClick={closeModal}>
                            <X size={20} />
                        </button>

                        <h2>{selectedEntry.query}</h2>
                        <div className="modal-meta">
                            <p><strong><Clock size={16} /> Searched:</strong> {new Date(selectedEntry.timestamp).toLocaleString()}</p>
                            {selectedEntry.params && Object.keys(selectedEntry.params).length > 0 && (
                                <div className="modal-params">
                                    <strong>Filters:</strong>
                                    <div className="params-tags">
                                        {Object.entries(selectedEntry.params).map(([key, value]) => (
                                            value && <span key={key} className="param-tag">{key}: {value}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="modal-images-grid">
                            {selectedEntry.images && selectedEntry.images.length > 0 ? (
                                selectedEntry.images.map((img, idx) => (
                                    <div key={idx} className="modal-image">
                                        <img
                                            src={img.url || img.thumbnail}
                                            alt={img.title || `Image ${idx + 1}`}
                                            onError={handleImageError}
                                        />
                                        <div className="image-info">
                                            <p className="image-title">{img.title}</p>
                                            <p className="image-source">{img.source}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>No images in this search</p>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button onClick={() => repeatSearch(selectedEntry)} className="repeat-search-button">
                                <RefreshCw size={16} /> Repeat Search
                            </button>
                            <button onClick={() => handleDelete(history.indexOf(selectedEntry))} className="delete-button">
                                <Trash2 size={16} /> Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SearchHistory;
