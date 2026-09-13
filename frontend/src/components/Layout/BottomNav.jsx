import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../../styles/BottomNav.css';
import { NavigationEvents } from './Sidebar';

const BottomNav = ({ moodboardCount = 0, user }) => {
    const navigate = useNavigate();
    const location = useLocation();

    const getActiveView = () => {
        const path = location.pathname;
        if (path.includes('/creator-studio')) return 'creator_studio';
        if (path.includes('/moodboard')) return 'moodboard';
        if (path.includes('/audit')) return 'ai_audit';
        if (path.includes('/profile')) return 'profile';
        if (path.includes('/library')) return 'library';
        if (path.includes('/scanner')) return 'brand_scanner';
        return 'search';
    };

    const activeView = getActiveView();
    const isExtensionMode = new URLSearchParams(location.search).get('mode') === 'extension' ||
        sessionStorage.getItem('inspo_extension_mode') === 'true';

    const allNavItems = [
        {
            id: 'search',
            icon: '/Search.svg',
            label: 'Search',
            onClick: () => {
                navigate('/search');
                NavigationEvents.publish(NavigationEvents.VIEWS.SEARCH);
            }
        },
        {
            id: 'moodboard',
            icon: '/ji.svg',
            label: 'Board',
            badge: moodboardCount > 0 ? moodboardCount : null,
            onClick: () => {
                navigate('/moodboard');
                NavigationEvents.publish(NavigationEvents.VIEWS.MOODBOARD);
            }
        },
        {
            id: 'profile',
            icon: user?.photoURL || '/User.svg',
            label: 'Profile',
            onClick: () => {
                navigate('/profile');
                NavigationEvents.publish(NavigationEvents.VIEWS.PROFILE);
            }
        },
        {
            id: 'creator_studio',
            icon: '/Text.svg',
            label: 'Creator',
            onClick: () => {
                navigate('/creator-studio');
                NavigationEvents.publish(NavigationEvents.VIEWS.CREATOR_STUDIO);
            }
        },
        {
            id: 'library',
            icon: '/Moodboard.svg',
            label: 'History',
            onClick: () => {
                navigate('/library');
                NavigationEvents.publish(NavigationEvents.VIEWS.LIBRARY);
            }
        }
    ];

    const navItems = isExtensionMode
        ? allNavItems.filter(item => !['search', 'creator_studio', 'library'].includes(item.id))
        : allNavItems;

    return (
        <nav className="bottom-nav">
            {navItems.map((item) => (
                <button
                    key={item.id}
                    className={`bottom-nav-item ${activeView === item.id ? 'active' : ''}`}
                    onClick={item.onClick}
                >
                    <div className="bottom-nav-icon-container">
                        <img
                            src={item.icon}
                            alt={item.label}
                            className="bottom-nav-icon"
                            style={item.id === 'profile' ? {
                                borderRadius: '50%',
                                objectFit: 'cover',
                                width: '24px',
                                height: '24px',
                                border: '1.5px solid #eee'
                            } : {}}
                            onError={(e) => { if (item.id === 'profile') e.target.src = '/User.svg' }}
                        />
                        {item.badge && <span className="bottom-nav-badge">{item.badge}</span>}
                    </div>
                    <span className="bottom-nav-label">{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default BottomNav;
