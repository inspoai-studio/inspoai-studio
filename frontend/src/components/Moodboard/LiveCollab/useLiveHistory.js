import { useState, useCallback } from 'react';
import SocketService from '../../../services/SocketService';

export const useLiveHistory = () => {
    const [past, setPast] = useState([]);
    const [future, setFuture] = useState([]);

    const addToHistory = useCallback((action) => {
        setPast(prev => [...prev, action]);
        setFuture([]); // Clear future on new action
    }, []);

    const performUndo = useCallback((currentItems, updateCallback) => {
        setPast(prev => {
            if (prev.length === 0) return prev;
            const newPast = [...prev];
            const action = newPast.pop();

            // Execute Inverse
            switch (action.type) {
                case 'UPDATE':
                    updateCallback(action.id, action.before);
                    break;
                case 'ADD':
                    // Inverse of Add is Remove
                    SocketService.updateMoodboard('REMOVE_IMAGE', { id: action.id });
                    // We assume updateCallback handles local optimistic updates or we do it manually?
                    // Ideally LiveBoard handles "REMOVE_IMAGE" socket event which we can trigger locally?
                    // For now, let's use the updateCallback if it supports removal, or assume calling SocketService triggers local listener eventually?
                    // Actually, for "undo", we often want immediate feedback.
                    // But for now, let's delegate to the SocketService and let the listener handle the UI update to avoid conflict.
                    break;
                case 'REMOVE':
                    // Inverse of Remove is Add
                    SocketService.updateMoodboard('ADD_IMAGE', { image: action.item });
                    break;
                case 'ADD_EDGE':
                    SocketService.updateMoodboard('REMOVE_EDGE', { id: action.edge.id });
                    break;
                case 'REMOVE_EDGE':
                    SocketService.updateMoodboard('ADD_EDGE', { edge: action.edge });
                    break;
            }

            setFuture(f => [action, ...f]);
            return newPast;
        });
    }, []);

    const performRedo = useCallback((updateCallback) => {
        setFuture(prev => {
            if (prev.length === 0) return prev;
            const newFuture = [...prev];
            const action = newFuture.shift();

            // Execute Action again
            switch (action.type) {
                case 'UPDATE':
                    updateCallback(action.id, action.after);
                    break;
                case 'ADD':
                    SocketService.updateMoodboard('ADD_IMAGE', { image: action.item });
                    break;
                case 'REMOVE':
                    SocketService.updateMoodboard('REMOVE_IMAGE', { id: action.id });
                    break;
                case 'ADD_EDGE':
                    SocketService.updateMoodboard('ADD_EDGE', { edge: action.edge });
                    break;
                case 'REMOVE_EDGE':
                    SocketService.updateMoodboard('REMOVE_EDGE', { id: action.edge.id });
                    break;
            }

            setPast(p => [...p, action]);
            return newFuture;
        });
    }, []);

    return {
        addToHistory,
        undo: performUndo,
        redo: performRedo,
        canUndo: past.length > 0,
        canRedo: future.length > 0
    };
};
