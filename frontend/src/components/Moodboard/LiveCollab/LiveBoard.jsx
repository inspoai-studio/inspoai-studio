import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trash2, Image as ImageIcon, Type, MousePointer2, Move, ZoomIn, ZoomOut, Check, X, RotateCcw, RotateCw, Hand, Lock, Unlock } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { ReactionPicker } from './ItemReactions';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Toaster, toast } from 'sonner';
import { v4 as uuidv4 } from 'uuid';
import Moveable from 'react-moveable';
import Selecto from 'react-selecto';
import { useLiveItemSync } from './useLiveItemSync';
import SocketService from '../../../services/SocketService';
import DraggableItem from './DraggableItem';
import LiveToolbar from './LiveToolbar';
import LiveDock from './LiveDock';
import AIToolPanel from './AIToolPanel';
import LiveCursors from './LiveCursors';
import { useLiveHistory } from './useLiveHistory';
import '../../../styles/LiveCollab.css';
import { auth } from '../../../firebase';
import Sidebar from '../../Layout/Sidebar';
import ItemToolbar from './ItemToolbar';

const LiveBoard = ({ user, quota }) => {
    const { inviteCode } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const { state } = location;

    const [session, setSession] = useState(null);
    const [items, setItems] = useState([]);
    const [activeUsers, setActiveUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [debugLog, setDebugLog] = useState("");
    const [error, setError] = useState(null);
    const [isConnected, setIsConnected] = useState(true);

    // Tools & UI State
    const [activeTool, setActiveTool] = useState('select');
    const [selectedItemIds, setSelectedItemIds] = useState(new Set());
    const [targets, setTargets] = useState([]);
    const [activeReactionPicker, setActiveReactionPicker] = useState(null);
    const [isAIOpen, setIsAIOpen] = useState(false);

    // History
    const { addToHistory, undo, redo, canUndo, canRedo } = useLiveHistory();

    // Generic Item Update (Text, Color, etc.)
    const handleItemUpdate = useCallback((id, updates) => {
        setItems(prev => prev.map(item => {
            if (item.id === id || item._internalId === id || item._id === id) {
                return { ...item, ...updates };
            }
            return item;
        }));

        SocketService.updateMoodboard('UPDATE_IMAGE', {
            id,
            updates
        });
    }, []);

    // AI Item Handler
    // AI Item Handler
    const handleAIAddItem = useCallback((newItem) => {
        setItems(prevItems => [...prevItems, newItem]);
        addToHistory({ type: 'ADD', id: newItem.id, item: newItem });

        // Use specific events expected by backend
        if (newItem.type === 'image') {
            SocketService.updateMoodboard('ADD_IMAGE', { image: newItem });
        } else {
            SocketService.updateMoodboard('ADD_NOTE', { note: newItem });
        }
    }, [addToHistory]);

    // Refs for DOM & Logic
    const itemRefs = useLiveItemSync(setItems); // USE THE NEW HOOK
    const containerRef = useRef(null);
    // Track transform state - Ensure valid initialization
    const transformRef = useRef({ scale: 1, positionX: 0, positionY: 0 });
    const fileInputRef = useRef(null);
    const lastCursorUpdate = useRef(0);
    const lastDragUpdate = useRef(0);

    // Store drag start state for history
    const dragStartMap = useRef(new Map());


    // Initialize Session
    useEffect(() => {
        const initSession = async () => {
            // Ensure user is authenticated
            const currentUser = auth.currentUser;
            if (!currentUser) {
                navigate('/login', { state: { from: location.pathname } });
                return;
            }

            try {
                const token = await currentUser.getIdToken();
                SocketService.connect(token);

                const searchParams = new URLSearchParams(location.search);
                const isCreateMode = searchParams.get('create') === 'true';

                if (isCreateMode && state?.moodboardData) {
                    // CREATE NEW SESSION

                    // Prepare initial items with positions and GUARANTEE UNIQUE IDs
                    const preparedImages = (state.moodboardData.images || []).map((img, idx) => ({
                        ...img,
                        id: uuidv4(), // Force fresh ID
                        reactions: [],
                        locked: false,
                        x: img.x || (100 + (idx % 4) * 220),
                        y: img.y || (100 + Math.floor(idx / 4) * 220),
                        width: img.width || 200,
                        height: img.height || 200,
                        rotation: img.rotation || 0,
                        type: 'image'
                    }));

                    const response = await SocketService.createSession({
                        title: state.moodboardData.title || 'Live Moodboard',
                        images: preparedImages
                    });

                    setSession(response.session);
                    setItems(response.session.moodboard.images);
                    setActiveUsers(response.session.participants);

                    window.history.replaceState(null, '', `/live/${response.inviteCode}`);
                    // Auto-copy for convenience
                    navigator.clipboard.writeText(response.inviteCode).catch(() => { });
                    toast.success(`Session created! Code: ${response.inviteCode} (Copied to clipboard)`, { duration: 5000 });
                } else if (inviteCode) {
                    // JOIN EXISTING SESSION
                    const response = await SocketService.joinSession(inviteCode);

                    setSession(response.session);

                    // Patch existing items if they lack IDs
                    // WARNING: If IDs are missing from server, this causes sync issues between clients.
                    // We only generate IDs if absolutely necessary, but consistent syncing depends on server IDs.
                    const validItems = (response.session.moodboard.images || []).map(img => ({
                        ...img,
                        id: img.id || img._internalId || img._id || uuidv4(),
                        locked: img.locked || false,
                        // Ensure we carry over _id if it exists to help matching
                        _id: img._id
                    }));

                    setItems(validItems);
                    setActiveUsers(response.session.participants);
                    toast.success('Joined session successfully');
                } else {
                    setError("No session info provided");
                }
            } catch (err) {
                console.error("Session init error:", err);
                setError(err.message);
                toast.error(`Error: ${err.message}`);
            } finally {
                setLoading(false);
            }
        };

        initSession();

        return () => {
            SocketService.disconnect();
        };
    }, [inviteCode, state, navigate, location]);


    // Socket Listeners
    useEffect(() => {
        const offMoodboardUpdate = SocketService.on('moodboard-updated', (data) => {
            if (data.action === 'UPDATE_IMAGE') {
                setItems(prev => {
                    const newItems = [...prev];
                    const index = data.payload.index;
                    const id = data.payload.id;
                    let itemIndex = index;

                    if (itemIndex === undefined || !newItems[itemIndex]) {
                        itemIndex = newItems.findIndex(i => i.id === id || i._internalId === id || i._id === id);
                    }

                    if (itemIndex !== -1) {
                        newItems[itemIndex] = {
                            ...newItems[itemIndex],
                            ...data.payload.updates
                        };
                    }
                    return newItems;
                });
            } else if (data.action === 'ADD_IMAGE') {
                // Handle Add
                setItems(prev => {
                    // Avoid duplicates
                    if (prev.find(i => i.id === data.payload.image.id)) return prev;
                    return [...prev, data.payload.image];
                });
            } else if (data.action === 'REMOVE_IMAGE') {
                setItems(prev => prev.filter(item => item.id !== data.payload.id && item._internalId !== data.payload.id));
            } else {
                setItems(data.moodboard.images);
            }
        });

        const offParticipantJoined = SocketService.on('participant-joined', (data) => {
            if (data.participants) setActiveUsers(data.participants);
            toast.info(`${data.participant?.displayName || 'User'} joined`);
        });
        const offParticipantLeft = SocketService.on('participant-left', (data) => {
            if (data.participants) setActiveUsers(data.participants);
        });

        // Reaction listeners
        const offReactionAdded = SocketService.on('reaction-added', (data) => {
            setItems(prev => prev.map(item => {
                if (item.id === data.itemId || item._internalId === data.itemId) {
                    const reactions = item.reactions || [];
                    if (reactions.some(r => r.emoji === data.reaction.emoji && r.user.userId === data.reaction.user.userId)) {
                        return item;
                    }
                    return { ...item, reactions: [...reactions, data.reaction] };
                }
                return item;
            }));
        });

        const offReactionRemoved = SocketService.on('reaction-removed', (data) => {
            setItems(prev => prev.map(item => {
                if (item.id === data.itemId || item._internalId === data.itemId) {
                    const reactions = (item.reactions || []).filter(
                        r => !(r.emoji === data.emoji && r.user.userId === data.userId)
                    );
                    return { ...item, reactions };
                }
                return item;
            }));
        });

        return () => {
            if (typeof offMoodboardUpdate === 'function') offMoodboardUpdate();
            if (typeof offParticipantJoined === 'function') offParticipantJoined();
            if (typeof offParticipantLeft === 'function') offParticipantLeft();
            if (typeof offReactionAdded === 'function') offReactionAdded();
            if (typeof offReactionRemoved === 'function') offReactionRemoved();
        };
    }, []);

    // Connection Monitoring
    useEffect(() => {
        const cleanupConnect = SocketService.on('connect', () => setIsConnected(true));
        const cleanupDisconnect = SocketService.on('disconnect', () => setIsConnected(false));

        return () => {
            if (cleanupConnect) cleanupConnect();
            if (cleanupDisconnect) cleanupDisconnect();
        };
    }, []);
    // Sync Moveable targets with selection - FILTER LOCKED ITEMS
    useEffect(() => {
        const newTargets = [];
        selectedItemIds.forEach(id => {
            const item = items.find(i => i.id === id || i._internalId === id);
            // DO NOT allow Moveable to control locked items
            if (item && !item.locked && itemRefs.current[id]) {
                newTargets.push(itemRefs.current[id]);
            }
        });
        setTargets(newTargets);
    }, [selectedItemIds, items]);

    // Handlers defined with useCallback
    const handleSelect = useCallback((id, e) => {
        if (activeTool === 'hand') return;

        if (e && e.shiftKey) {
            setSelectedItemIds(prev => {
                const newSet = new Set(prev);
                if (newSet.has(id)) newSet.delete(id);
                else newSet.add(id);
                return newSet;
            });
        } else {
            // Right click triggers select too if not selected
            // But we need to check if 'id' is in selectedItemIds.
            // selectedItemIds is a dependency now.

            // Optimization: functional update doesn't need prev state in dep array?
            // Actually dragging logic calls this? No, click calls this.

            setSelectedItemIds(prev => {
                if (!prev.has(id)) return new Set([id]);
                return prev;
            });
        }
    }, [activeTool]); // Removed selectedItemIds from dep array by using careful set logic if possible, but actually it's fine.

    const handleBackgroundClick = useCallback((e) => {
        if (activeTool === 'hand') return;
        if (e && (e.target.closest('.live-toolbar') || e.target.closest('.live-dock') || e.target.closest('.picker-backdrop'))) return;

        setSelectedItemIds(new Set());
        setActiveReactionPicker(null);
    }, [activeTool]);

    // LOCKING Feature
    const toggleLock = (itemId, lockedStatus) => {
        handleItemUpdate(itemId, { locked: lockedStatus });
        // If locking, remove from selection so Moveable disappears
        if (lockedStatus) {
            setSelectedItemIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(itemId);
                return newSet;
            });
        }
        setContextMenu(null);
    };

    const handleBringToFront = useCallback((itemId) => {
        const maxZ = Math.max(...items.map(i => i.zIndex || 1), 0);
        handleItemUpdate(itemId, { zIndex: maxZ + 1 });
    }, [items, handleItemUpdate]);

    const handleSendToBack = useCallback((itemId) => {
        const minZ = Math.min(...items.map(i => i.zIndex || 1), 0);
        handleItemUpdate(itemId, { zIndex: minZ - 1 });
    }, [items, handleItemUpdate]);

    const handleDeleteItem = (itemId) => {
        const item = items.find(i => i.id === itemId || i._internalId === itemId);
        if (!item) return;

        // History
        addToHistory({ type: 'REMOVE', id: itemId, item: item });

        // Optimistic
        setItems(prev => prev.filter(i => (i.id !== itemId && i._internalId !== itemId)));
        setSelectedItemIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
        });

        // Server
        const index = items.findIndex(item => item.id === itemId || item._internalId === itemId);
        SocketService.updateMoodboard('REMOVE_IMAGE', { id: itemId, index });
    };


    // Helper to get center of current view
    const getViewportCenter = () => {
        // Default to center of canvas
        let x = 1500;
        let y = 1500;

        if (transformRef.current && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const { scale, positionX, positionY } = transformRef.current;
            // Center = (ContainerCenter - Translate) / Scale
            x = ((rect.width / 2) - positionX) / scale;
            y = ((rect.height / 2) - positionY) / scale;
        }

        // Safety bounds
        if (!Number.isFinite(x)) x = 1500;
        if (!Number.isFinite(y)) y = 1500;

        return { x, y };
    };

    // ADD CONTENT HANDLERS
    const handleAddNote = () => {
        const id = uuidv4();
        const { x, y } = getViewportCenter();

        const note = {
            id,
            type: 'note',
            text: 'New Sticky Note',
            color: '#fff099',
            x: x - 100, // Center origin
            y: y - 100,
            width: 200,
            height: 200,
            rotation: 0,
            locked: false
        };

        // History
        addToHistory({ type: 'ADD', id: id, item: note });

        // Optimistic
        setItems(prev => [...prev, note]);

        // Server
        SocketService.updateMoodboard('ADD_IMAGE', { image: note });
        toast.success("Note added");
    };

    // --- UTILS ---
    const compressImage = (file) => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1000;
                    const MAX_HEIGHT = 1000;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    // Compress to JPEG 0.7
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
            };
        });
    };

    const handleAddImage = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Image too large. Max 5MB.");
            return;
        }

        const loadingToast = toast.loading("Processing image...");

        try {
            const compressedDataUrl = await compressImage(file);
            const id = uuidv4();
            const { x, y } = getViewportCenter();

            const imageItem = {
                id,
                type: 'image',
                image: compressedDataUrl,
                x: x - 150, // Center origin (300/2)
                y: y - 150,
                width: 300,
                height: 300,
                rotation: 0,
                locked: false
            };


            // History
            addToHistory({ type: 'ADD', id: id, item: imageItem });

            setItems(prev => [...prev, imageItem]);
            SocketService.updateMoodboard('ADD_IMAGE', { image: imageItem });
            toast.dismiss(loadingToast);
            toast.success("Image added");
        } catch (err) {
            console.error(err);
            toast.dismiss(loadingToast);
            toast.error("Failed to process image");
        }
    };


    const handleUndo = () => undo(items, (id, updates) => handleItemUpdate(id, updates));
    const handleRedo = () => redo((id, updates) => handleItemUpdate(id, updates));

    // Handlers
    const handleCursorMove = useCallback((e) => {
        const now = Date.now();
        if (now - lastCursorUpdate.current > 50) {
            lastCursorUpdate.current = now;
            const firstSelected = selectedItemIds.size > 0 ? Array.from(selectedItemIds)[0] : null;

            // Convert Screen Coordinates to Canvas Coordinates
            // logic: canvasX = (screenX - containerRect.left - positionX) / scale
            // We use transformRef to get current transforms

            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                const { scale, positionX, positionY } = transformRef.current;

                // LiveBoard container is flex-1, so its rect is our viewport reference
                // But e.clientX is global.
                // offsetX is safer if target is container? No, target varies.
                // Using clientX and container rect is robust.

                const canvasX = (e.clientX - rect.left - positionX) / scale;
                const canvasY = (e.clientY - rect.top - positionY) / scale;

                SocketService.updateCursor({
                    x: canvasX,
                    y: canvasY,
                    selectedItem: firstSelected,
                    isDragging: selectedItemIds.size > 0
                });
            }
        }
    }, [selectedItemIds]);

    const handleMouseDown = useCallback(() => {
        SocketService.updateCursor({ clicked: true });
        setTimeout(() => {
            SocketService.updateCursor({ clicked: false });
        }, 100);
    }, []);

    const handleReactionRequest = useCallback(({ itemId, x, y }) => {
        setActiveReactionPicker({ itemId, x, y });
    }, []);

    const handleGlobalReact = (emoji) => {
        if (activeReactionPicker) {
            handleAddReaction(activeReactionPicker.itemId, emoji);
            setActiveReactionPicker(null);
        }
    };

    const handleAddReaction = (itemId, emoji) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setItems(prev => prev.map(item => {
            if (item.id === itemId || item._internalId === itemId) {
                const reactions = item.reactions || [];
                return {
                    ...item,
                    reactions: [...reactions, {
                        emoji,
                        user: {
                            userId: currentUser.uid,
                            displayName: currentUser.displayName || 'Anonymous'
                        },
                        timestamp: Date.now()
                    }]
                };
            }
            return item;
        }));

        SocketService.emit('add-reaction', {
            itemId,
            emoji,
            user: {
                userId: currentUser.uid,
                displayName: currentUser.displayName || 'Anonymous'
            }
        });
    };

    const handleRemoveReaction = useCallback((itemId, emoji) => {
        const currentUser = auth.currentUser;
        if (!currentUser) return;

        setItems(prev => prev.map(item => {
            if (item.id === itemId || item._internalId === itemId) {
                const reactions = (item.reactions || []).filter(
                    r => !(r.emoji === emoji && r.user.userId === currentUser.uid)
                );
                return { ...item, reactions };
            }
            return item;
        }));

        SocketService.emit('remove-reaction', {
            itemId,
            emoji,
            userId: currentUser.uid
        });
    }, []);

    const handleExit = () => {
        if (window.confirm("Are you sure you want to leave the live session?")) {
            SocketService.leaveSession();
            navigate('/moodboard');
        }
    };

    // --- KEYBOARD SHORTCUTS ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'v') setActiveTool('select');
            if (e.key === 'h') setActiveTool('hand');
            if ((e.key === 'Backspace' || e.key === 'Delete') && selectedItemIds.size > 0) {
                // Check if any selected are locked
                const canDelete = Array.from(selectedItemIds).every(id => {
                    const item = items.find(i => i.id === id);
                    return item && !item.locked;
                });
                if (canDelete) {
                    selectedItemIds.forEach(id => handleDeleteItem(id));
                } else {
                    toast.error("Cannot delete locked items");
                }
            }
            if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) handleRedo();
                else handleUndo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItemIds, items, undo, redo]);

    if (loading) return <div className="main-screen"><Sidebar user={user} userQuota={quota} /><div className="live-board-loading">Loading Session...</div></div>;
    if (error) return <div className="main-screen"><Sidebar user={user} userQuota={quota} /><div className="live-board-error">{error}</div></div>;

    return (
        <div className="main-screen" style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex' }}>
            <Toaster position="top-center" richColors />
            <Sidebar user={user} userQuota={quota} />

            <div
                className={`live-board-container ${activeTool}-tool`}
                onMouseMove={handleCursorMove}
                onMouseDown={handleMouseDown}
                ref={containerRef}
                onClick={handleBackgroundClick}
                style={{
                    flex: 1,
                    position: 'relative',
                    height: '100%',
                    overflow: 'hidden',
                    cursor: activeTool === 'hand' ? 'grab' : 'default'
                }}
            >
                <LiveToolbar
                    sessionCode={session?.inviteCode || inviteCode}
                    activeUsers={activeUsers}
                    onExit={handleExit}
                    isConnected={isConnected}
                />

                {/*
                  REMOVE CURSOR OVERLAY FROM HERE.
                  It needs to be inside TransformComponent to move with the canvas.
                */}

                {/* HIDDEN FILE INPUT */}
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleAddImage}
                />

                {/* Global Reaction Picker */}
                <AnimatePresence>
                    {activeReactionPicker && (
                        <>
                            <div
                                className="picker-backdrop"
                                style={{
                                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999
                                }}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveReactionPicker(null);
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                            />
                            <ReactionPicker
                                position={activeReactionPicker}
                                onReact={handleGlobalReact}
                                onClose={() => setActiveReactionPicker(null)}
                            />
                        </>
                    )}
                </AnimatePresence>

                <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
                    {debugLog && (
                        <div className="bg-black/75 text-white px-3 py-1 rounded text-xs font-mono">
                            {debugLog}
                        </div>
                    )}
                </div>

                {/* Infinite Canvas */}
                <TransformWrapper
                    initialScale={1}
                    minScale={0.1}
                    maxScale={4}
                    centerOnInit={false}
                    onPanning={() => {
                        setActiveReactionPicker(null);
                    }}
                    onZooming={() => {
                        setActiveReactionPicker(null);
                    }}
                    panning={{
                        disabled: activeTool === 'select' || selectedItemIds.size > 0
                    }}
                    doubleClick={{ disabled: true }}
                    // Sync transform state to ref for cursor calculations
                    onTransformed={(r) => {
                        transformRef.current = r.state;
                    }}
                >
                    {(transformState) => {
                        const { scale, zoomIn, zoomOut } = transformState;
                        // Ensure ref is populated on first render if possible, though onTransformed handles updates
                        if (transformRef.current.scale !== scale) {
                            transformRef.current = transformState.state || { scale, positionX: transformState.positionX, positionY: transformState.positionY };
                        }

                        return (
                            <>
                                {/* LIVE DOCK CONTROLS */}
                                <LiveDock
                                    activeTool={activeTool}
                                    setActiveTool={setActiveTool}
                                    onZoomIn={() => zoomIn()}
                                    onZoomOut={() => zoomOut()}
                                    onAddNote={handleAddNote}
                                    onAddImage={() => fileInputRef.current?.click()}
                                    canUndo={canUndo}
                                    canRedo={canRedo}
                                    onUndo={handleUndo}
                                    onRedo={handleRedo}
                                    onOpenAI={() => setIsAIOpen(prev => !prev)}
                                    isAIOpen={isAIOpen}
                                />

                                <AIToolPanel
                                    isOpen={isAIOpen}
                                    onClose={() => setIsAIOpen(false)}
                                    onAddItem={handleAIAddItem}
                                    getViewportCenter={getViewportCenter}
                                />

                                {/* NEW: ITEM FLOATING TOOLBAR REMOVED AS PER USER REQUEST */}

                                <TransformComponent
                                    wrapperStyle={{ width: '100%', height: '100%' }}
                                    contentStyle={{ width: '100%', height: '100%' }}
                                >
                                    <div
                                        className="infinite-canvas-content"
                                        style={{
                                            width: '3000px',
                                            height: '3000px',
                                            position: 'relative',
                                            pointerEvents: activeTool === 'hand' ? 'none' : 'auto' // Passthrough events for panning
                                        }}
                                    >
                                        {/* Live Cursors (Self-contained) */}
                                        <LiveCursors />

                                        {items.map((item, index) => {
                                            const stableId = item.id || item._id || item._internalId;
                                            return (
                                                <div
                                                    key={stableId || index}
                                                >
                                                    <DraggableItem
                                                        ref={el => { if (el) itemRefs.current[stableId] = el; }}
                                                        item={item}
                                                        isSelected={selectedItemIds.has(stableId)}
                                                        isBeingEditedBy={null}
                                                        onSelect={handleSelect}
                                                        onUpdate={handleItemUpdate}
                                                        onAddReactionRequest={handleReactionRequest}
                                                        onAddReaction={handleAddReaction}
                                                        onRemoveReaction={handleRemoveReaction}
                                                    />
                                                </div>
                                            )
                                        })}

                                        {/* CONTROLLER (Only for Unlocked & Selected) */}
                                        {activeTool === 'select' && targets.length > 0 && (
                                            <Moveable
                                                target={targets}
                                                zoom={scale || 1}
                                                draggable={true}
                                                resizable={true}
                                                rotatable={true}

                                                /* Snapping disabled for smooth movement */
                                                snappable={false}

                                                /* SINGLE EVENTS + HISTORY TRACKING */
                                                onDragStart={e => {
                                                    const id = e.target.getAttribute('data-id');
                                                    const item = items.find(i => i.id === id || i._internalId === id);
                                                    if (item) {
                                                        e.set([item.x, item.y]);
                                                        dragStartMap.current.set(id, { x: item.x, y: item.y });
                                                    }
                                                }}
                                                onDrag={e => {
                                                    e.target.style.transform = e.transform;

                                                    const now = Date.now();
                                                    if (now - lastDragUpdate.current > 30) {
                                                        lastDragUpdate.current = now;
                                                        const id = e.target.getAttribute('data-id');
                                                        if (id) {
                                                            const [x, y] = e.translate;
                                                            SocketService.moveItem({ id, x, y });
                                                        }
                                                    }
                                                }}
                                                onDragEnd={e => {
                                                    const id = e.target.getAttribute('data-id');
                                                    if (e.lastEvent && id) {
                                                        const [x, y] = e.lastEvent.translate;

                                                        // Ensure coordinates are valid numbers
                                                        if (Number.isFinite(x) && Number.isFinite(y)) {
                                                            const start = dragStartMap.current.get(id);
                                                            if (start && (start.x !== x || start.y !== y)) {
                                                                addToHistory({
                                                                    type: 'UPDATE',
                                                                    id,
                                                                    before: { x: start.x, y: start.y },
                                                                    after: { x, y }
                                                                });
                                                            }
                                                            handleItemUpdate(id, { x, y });
                                                            // Also emit a final volatile move to ensure eventual consistency for laggards
                                                            SocketService.moveItem({ id, x, y });
                                                        }
                                                    }
                                                }}

                                                // Implement similar for resize/rotate history later if needed (keep it simple for now)
                                                // Just handling drag logic for now
                                                onResize={e => {
                                                    e.target.style.width = `${e.width}px`;
                                                    e.target.style.height = `${e.height}px`;
                                                    e.target.style.transform = e.drag.transform;
                                                }}
                                                onResizeEnd={e => {
                                                    const id = e.target.getAttribute('data-id');
                                                    if (e.lastEvent && id) {
                                                        const [x, y] = e.lastEvent.drag.translate;
                                                        const { width, height } = e.lastEvent;
                                                        handleItemUpdate(id, { x, y, width, height });
                                                    }
                                                }}
                                                onRotate={e => { e.target.style.transform = e.drag.transform; }}
                                                onRotateEnd={e => {
                                                    const id = e.target.getAttribute('data-id');
                                                    if (e.lastEvent && id) handleItemUpdate(id, { rotation: e.lastEvent.rotation });
                                                }}

                                                /* GROUP EVENTS */
                                                onDragGroupStart={e => {
                                                    e.events.forEach(ev => {
                                                        const id = ev.target.getAttribute('data-id');
                                                        const item = items.find(i => i.id === id || i._internalId === id);
                                                        if (item) {
                                                            ev.set([item.x, item.y]);
                                                        }
                                                    });
                                                }}
                                                onDragGroup={e => {
                                                    e.events.forEach(ev => {
                                                        ev.target.style.transform = ev.transform;
                                                    });

                                                    const now = Date.now();
                                                    if (now - lastDragUpdate.current > 40) {
                                                        lastDragUpdate.current = now;
                                                        e.events.forEach(ev => {
                                                            const id = ev.target.getAttribute('data-id');
                                                            if (id) {
                                                                const [x, y] = ev.translate;
                                                                SocketService.moveItem({ id, x, y });
                                                            }
                                                        });
                                                    }
                                                }}
                                                onDragGroupEnd={e => {
                                                    e.events.forEach(ev => {
                                                        const id = ev.target.getAttribute('data-id');
                                                        if (ev.lastEvent && id) {
                                                            const [x, y] = ev.lastEvent.translate;
                                                            handleItemUpdate(id, { x, y });
                                                        }
                                                    });
                                                }}
                                                onResizeGroup={e => {
                                                    e.events.forEach(ev => {
                                                        ev.target.style.width = `${ev.width}px`;
                                                        ev.target.style.height = `${ev.height}px`;
                                                        ev.target.style.transform = ev.drag.transform;
                                                    });
                                                }}
                                                onResizeGroupEnd={e => {
                                                    e.events.forEach(ev => {
                                                        const id = ev.target.getAttribute('data-id');
                                                        if (ev.lastEvent && id) {
                                                            const [x, y] = ev.lastEvent.drag.translate;
                                                            const { width, height } = ev.lastEvent;
                                                            handleItemUpdate(id, { x, y, width, height });
                                                        }
                                                    });
                                                }}
                                                onRotateGroup={e => {
                                                    e.events.forEach(ev => ev.target.style.transform = ev.drag.transform);
                                                }}
                                                onRotateGroupEnd={e => {
                                                    e.events.forEach(ev => {
                                                        const id = ev.target.getAttribute('data-id');
                                                        if (ev.lastEvent && id) handleItemUpdate(id, { rotation: ev.lastEvent.rotation });
                                                    });
                                                }}
                                            />
                                        )}

                                        {/* Selection Tool (Blue Rectangle) */}
                                        {activeTool === 'select' && (
                                            <Selecto
                                                dragContainer={".infinite-canvas-content"}
                                                selectableTargets={[".drag-item"]}
                                                hitRate={0}
                                                selectByClick={true}
                                                selectFromInside={false}
                                                toggle={true}
                                                ratio={0}
                                                onSelect={e => {
                                                    const ids = new Set(e.selected.map(el => el.getAttribute('data-id')));
                                                    setSelectedItemIds(ids);
                                                }}
                                                onDragStart={e => {
                                                    const target = e.inputEvent.target;
                                                    // Allow panning overrides (Shift)
                                                    if (activeTool === 'hand' || e.inputEvent.shiftKey) {
                                                        e.stop();
                                                        return;
                                                    }
                                                    // If clicking on a Moveable control or a Target that is already selected, don't start selection
                                                    if (target.closest('.moveable-control') || (targets.includes(target.closest('.drag-item')) && !e.inputEvent.shiftKey)) {
                                                        e.stop();
                                                    }
                                                }}
                                            />
                                        )}

                                    </div>
                                </TransformComponent>
                            </>
                        );
                    }}
                </TransformWrapper>
            </div>
        </div>
    );
};

export default LiveBoard;
