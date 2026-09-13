import React from 'react';
import { Download, ExternalLink, Image as ImageIcon } from 'lucide-react';
import '../../styles/BrandProfileCard.css';

const BrandProfileCard = ({ data }) => {
    if (!data) return null;

    const { brandName, domain, history, logos } = data;

    const handleDownload = (url, isSvg) => {
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.download = `${brandName.toLowerCase().replace(/\s+/g, '-')}-logo.${isSvg ? 'svg' : 'png'}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="brand-profile-container">
            <div className="brand-profile-header">
                <h2>{brandName} Logo & Brand Assets</h2>
                {domain && (
                    <a href={`https://${domain}`} target="_blank" rel="noopener noreferrer" className="brand-domain-link">
                        {domain} <ExternalLink size={14} />
                    </a>
                )}
            </div>

            <div className="brand-logos-grid">
                {/* SVG Logo Card */}
                <div className="brand-logo-card">
                    <div className="logo-preview-box checkerboard-bg">
                        {logos?.svg ? (
                            <img src={logos.svg} alt={`${brandName} SVG Logo`} />
                        ) : (
                            <div className="no-logo-placeholder">
                                <ImageIcon size={32} opacity={0.3} />
                                <span>No SVG Available</span>
                            </div>
                        )}
                    </div>
                    <div className="logo-card-footer">
                        <div>
                            <h4>Vector Logo</h4>
                            <span className="format-badge">SVG</span>
                        </div>
                        <button
                            className="download-btn"
                            onClick={() => handleDownload(logos?.svg, true)}
                            disabled={!logos?.svg}
                        >
                            <Download size={16} /> Download
                        </button>
                    </div>
                </div>

                {/* PNG Logo Card */}
                <div className="brand-logo-card">
                    <div className="logo-preview-box checkerboard-bg">
                        {logos?.png ? (
                            <img src={logos.png} alt={`${brandName} PNG Logo`} />
                        ) : (
                            <div className="no-logo-placeholder">
                                <ImageIcon size={32} opacity={0.3} />
                                <span>No PNG Available</span>
                            </div>
                        )}
                    </div>
                    <div className="logo-card-footer">
                        <div>
                            <h4>Raster Logo</h4>
                            <span className="format-badge">PNG</span>
                        </div>
                        <button
                            className="download-btn"
                            onClick={() => handleDownload(logos?.png, false)}
                            disabled={!logos?.png}
                        >
                            <Download size={16} /> Download
                        </button>
                    </div>
                </div>
            </div>

            {history && (
                <div className="brand-history-section">
                    <h3>Brand History</h3>
                    <div className="history-content">
                        {history.split('\n\n').map((paragraph, idx) => (
                            <p key={idx}>{paragraph}</p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrandProfileCard;
