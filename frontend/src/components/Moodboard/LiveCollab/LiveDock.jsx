import React from 'react';
import {
    MousePointer2,
    Hand,
    StickyNote,
    Image as ImageIcon,
    Undo2,
    Redo2,
    ZoomIn,
    ZoomOut,
    Type,
    MoreHorizontal,
    Workflow,
    Sparkles
} from 'lucide-react';
import { motion } from 'framer-motion';

const DockButton = ({ icon: Icon, label, isActive, onClick, disabled = false }) => (
    <div className="dock-btn-wrapper" style={{ position: 'relative' }}>
        <button
            className={`dock-btn ${isActive ? 'active' : ''}`}
            onClick={onClick}
            disabled={disabled}
            title={label}
        >
            <Icon size={20} strokeWidth={1.5} />
        </button>
        {isActive && (
            <motion.div
                layoutId="active-dot"
                className="dock-active-dot"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
            />
        )}
    </div>
);

const Divider = () => <div className="dock-divider" />;

const LiveDock = ({
    activeTool,
    setActiveTool,
    onZoomIn,
    onZoomOut,
    onAddNote,
    onAddImage,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    onOpenAI,
    isAIOpen
}) => {
    return (
        <div className="live-dock-container">
            <motion.div
                className="live-dock glass-panel"
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            >
                {/* Tools Section */}
                <div className="dock-section">
                    <DockButton
                        icon={MousePointer2}
                        label="Select (V)"
                        isActive={activeTool === 'select'}
                        onClick={() => setActiveTool('select')}
                    />
                    <DockButton
                        icon={Hand}
                        label="Pan (H)"
                        isActive={activeTool === 'hand'}
                        onClick={() => setActiveTool('hand')}
                    />
                    <div style={{ width: 1, height: 24, background: 'rgba(0,0,0,0.1)', margin: '0 8px' }} />
                    <DockButton
                        icon={Sparkles}
                        label="Creative Copilot (AI)"
                        isActive={isAIOpen}
                        onClick={onOpenAI}
                    />
                </div>

                <Divider />

                {/* Add Content Section */}
                <div className="dock-section">
                    <DockButton
                        icon={StickyNote}
                        label="Add Sticky Note"
                        onClick={onAddNote}
                    />
                    <DockButton
                        icon={ImageIcon}
                        label="Add Image"
                        onClick={onAddImage}
                    />
                    <DockButton
                        icon={Type}
                        label="Add Text"
                        onClick={() => { }}
                        disabled={true}
                    />
                </div>

                <Divider />

                {/* History Section */}
                <div className="dock-section">
                    <DockButton
                        icon={Undo2}
                        label="Undo (Cmd+Z)"
                        onClick={onUndo}
                        disabled={!canUndo}
                    />
                    <DockButton
                        icon={Redo2}
                        label="Redo (Cmd+Shift+Z)"
                        onClick={onRedo}
                        disabled={!canRedo}
                    />
                </div>

                <Divider />

                {/* View Section */}
                <div className="dock-section">
                    <DockButton
                        icon={ZoomOut}
                        label="Zoom Out (-)"
                        onClick={onZoomOut}
                    />
                    <DockButton
                        icon={ZoomIn}
                        label="Zoom In (+)"
                        onClick={onZoomIn}
                    />
                </div>
            </motion.div>
        </div>
    );
};

export default LiveDock;
