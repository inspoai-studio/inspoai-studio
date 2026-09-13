import React from 'react';
import { TrendingUp, FileImage } from 'lucide-react';
import '../../styles/TrendList.css';

const TrendList = ({ data }) => {
    if (!data || !data.trends || data.trends.length === 0) return null;

    return (
        <div className="trend-list-container">
            <div className="trend-header">
                <TrendingUp className="trend-icon" size={24} />
                <h2>{data.title || 'Logo Design Trends'}</h2>
            </div>

            <div className="trends-grid">
                {data.trends.map((trend, index) => (
                    <div key={index} className="trend-card">
                        <div className="trend-image-container">
                            {trend.imageUrl ? (
                                <img src={trend.imageUrl} alt={trend.title} className="trend-image" />
                            ) : (
                                <div className="trend-placeholder">
                                    <FileImage size={32} opacity={0.2} />
                                    <span>{trend.visualKeyword || 'No visual'}</span>
                                </div>
                            )}
                        </div>
                        <div className="trend-content">
                            <div className="trend-number">{index + 1}</div>
                            <h3>{trend.title}</h3>
                            <p>{trend.description}</p>
                            {trend.visualKeyword && (
                                <span className="trend-keyword">Key element: {trend.visualKeyword}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TrendList;
