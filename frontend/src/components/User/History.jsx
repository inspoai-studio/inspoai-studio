import React from 'react';
import '../../styles/MainScreen.css';

const SearchHistory = ({ history, onSelectHistory }) => {
  if (!history || history.length === 0) {
    return null;
  }

  // Function to format time (e.g., "2 hours ago", "Yesterday", etc.)
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) {
      return 'Just now';
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
    }

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    }

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) {
      return 'Yesterday';
    }

    if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    }

    // For older dates, show the actual date
    return date.toLocaleDateString();
  };

  // Function to get relevant tags from a search params object
  const getRelevantTags = (params) => {
    const tags = [];

    if (params.industry) {
      tags.push(params.industry);
    }

    if (params.designStyle) {
      tags.push(params.designStyle);
    }

    if (params.font) {
      tags.push(params.font);
    }

    // Limit to 3 tags max
    return tags.slice(0, 3);
  };

  return (
    <div className="recent-searches">
      <div className="recent-searches-heading">Recent Searches</div>
      {history.slice(0, 5).map((item, index) => (
        <div
          key={`${item.query}-${index}`}
          className="recent-search-item"
          onClick={() => onSelectHistory(item)}
        >
          <div>
            <div className="recent-search-query">{item.query}</div>
            {item.params && (
              <div className="recent-search-tags">
                {getRelevantTags(item.params).map((tag, tagIndex) => (
                  <span key={tagIndex} className="recent-search-tag">
                    {tag}
                  </span>
                ))}
                {item.params.color && (
                  <span
                    className="recent-search-tag color-tag"
                    style={{
                      backgroundColor: item.params.color,
                      color: isLightColor(item.params.color) ? '#333' : '#fff'
                    }}
                  >
                    Color
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="recent-search-time">{formatTime(item.timestamp)}</div>
        </div>
      ))}
    </div>
  );
};

// Helper function to determine if a color is light (for text contrast)
function isLightColor(color) {
  // Default to dark if color is not valid
  if (!color || typeof color !== 'string') return false;

  // For hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  }

  // For rgb/rgba colors
  if (color.startsWith('rgb')) {
    const rgbMatch = color.match(/(\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);

      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5;
    }
  }

  return false;
}

export default SearchHistory;