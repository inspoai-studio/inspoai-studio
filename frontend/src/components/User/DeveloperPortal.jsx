import React from 'react';
import { Code2 } from 'lucide-react';

const DeveloperPortal = () => {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '80vh',
            fontFamily: "'Inter', sans-serif",
            textAlign: 'center',
            color: '#111',
            padding: '40px 24px',
            position: 'relative'
        }}>
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '320px',
                height: '320px',
                background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)',
                zIndex: 0,
                pointerEvents: 'none'
            }} />
            
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '480px' }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 14px',
                    borderRadius: '99px',
                    background: 'rgba(139, 92, 246, 0.08)',
                    color: '#8b5cf6',
                    fontSize: '13px',
                    fontWeight: 600,
                    marginBottom: '24px'
                }}>
                    <Code2 size={14} />
                    <span>InspoAI API Portal</span>
                </div>
                
                <h1 style={{
                    fontSize: '36px',
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.15,
                    marginBottom: '16px',
                    color: '#000000'
                }}>
                    Developer API Access <br />
                    <span style={{
                        background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Coming Soon
                    </span>
                </h1>
                
                <p style={{
                    fontSize: '15px',
                    color: '#666666',
                    lineHeight: 1.6,
                    marginBottom: '32px'
                }}>
                    We are currently polishing our external API access. Once released, you'll be able to query our curation index and UI dataset directly from your apps.
                </p>
                
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '16px'
                }}>
                    <div style={{
                        padding: '12px 24px',
                        background: '#000000',
                        color: '#ffffff',
                        fontSize: '14px',
                        fontWeight: 600,
                        borderRadius: '12px',
                        cursor: 'default',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        Join the API Waitlist
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeveloperPortal;
