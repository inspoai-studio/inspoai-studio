import React from 'react';
import { Copy, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const LiveToolbar = ({ sessionCode, activeUsers, onExit, isConnected = true }) => {

    const copyCode = () => {
        navigator.clipboard.writeText(sessionCode);
        toast.success("Session code copied to clipboard");
    };

    const getUserInitials = (name) => {
        return name ? name.substring(0, 2).toUpperCase() : '??';
    };

    return (
        <div className="live-topbar-container" style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 2000,
            pointerEvents: 'none'
        }}>
            {/* Left: Back/Exit */}
            <div style={{ pointerEvents: 'auto' }}>
                <button
                    className="glass-btn"
                    onClick={onExit}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 16px', background: 'rgba(255,255,255,0.85)',
                        border: '1px solid rgba(255,255,255,0.4)', borderRadius: 12,
                        backdropFilter: 'blur(10px)', fontWeight: 600, color: '#333',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.05)', cursor: 'pointer', marginLeft: '8rem'
                    }}
                >
                    <ArrowLeft size={18} />
                    <span>Exit Session</span>
                </button>
            </div>

            {/* Center: Session Info */}
            <div style={{
                pointerEvents: 'auto',
                background: 'rgba(255,255,255,0.85)',
                padding: '6px 16px',
                borderRadius: 20,
                display: 'flex', alignItems: 'center', gap: 12,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.4)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
                <span className="live-indicator" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                        className="pulsing-dot"
                        style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: isConnected ? '#10b981' : '#ef4444',
                            boxShadow: isConnected ? '0 0 0 2px rgba(16, 185, 129, 0.2)' : 'none'
                        }}
                    />
                    <span style={{
                        color: isConnected ? '#059669' : '#dc2626',
                        fontWeight: 700,
                        fontSize: 12,
                        letterSpacing: 0.5
                    }}>
                        {isConnected ? 'LIVE' : 'DISCONNECTED'}
                    </span>
                </span>
                <span style={{ width: 1, height: 16, background: '#ddd' }}></span>
                <span
                    className="code-text select-all"
                    onClick={copyCode}
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#444', fontWeight: 500 }}
                    title="Copy Invite Code"
                >
                    {sessionCode} <Copy size={13} style={{ opacity: 0.6 }} />
                </span>
            </div>

            {/* Right: Participants */}
            <div style={{ pointerEvents: 'auto' }}>
                <div className="users-section">
                    <div className="user-avatars-stack">
                        {activeUsers.slice(0, 4).map((user, index) => (
                            <div
                                key={user.userId || index}
                                className="user-avatar-ring"
                                title={user.displayName}
                                style={{ zIndex: activeUsers.length - index, marginLeft: index === 0 ? 0 : -10 }}
                            >
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt={user.displayName} />
                                ) : (
                                    <div className="avatar-placeholder" style={{ background: '#333' }}>
                                        {getUserInitials(user.displayName)}
                                    </div>
                                )}
                            </div>
                        ))}
                        {activeUsers.length > 4 && (
                            <div className="user-avatar-ring overflow-counter" style={{ marginLeft: -10, zIndex: 0 }}>
                                +{activeUsers.length - 4}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LiveToolbar;
