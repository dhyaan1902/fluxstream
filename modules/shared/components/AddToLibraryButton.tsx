import React, { useEffect, useState } from 'react';
import { BookmarkPlus, BookmarkCheck, Loader2 } from 'lucide-react';
import { MediaItem } from '../../../types';
import { libraryService } from '../../../services/libraryService';

interface AddToLibraryButtonProps {
    item: MediaItem;
    className?: string;
}

export const AddToLibraryButton: React.FC<AddToLibraryButtonProps> = ({ item, className = '' }) => {
    const [inLibrary, setInLibrary] = useState(false);
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        const checkLibrary = async () => {
            try {
                const exists = await libraryService.exists(item.id);
                setInLibrary(exists);
            } catch (e) {
                console.error('Failed to check library:', e);
            } finally {
                setChecking(false);
            }
        };
        checkLibrary();
    }, [item.id]);

    const toggle = async () => {
        setLoading(true);
        try {
            if (inLibrary) {
                await libraryService.remove(item.id);
                setInLibrary(false);
            } else {
                await libraryService.add(item);
                setInLibrary(true);
            }
        } catch (e) {
            console.error('Failed to toggle library:', e);
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <button
                disabled
                className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 transition-all ${className}`}
            >
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Checking...</span>
            </button>
        );
    }

    return (
        <button
            onClick={toggle}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${inLibrary
                ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30'
                : 'bg-white/5 text-slate-300 hover:bg-white/10 border border-white/10'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
        >
            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
            ) : inLibrary ? (
                <BookmarkCheck className="w-5 h-5" />
            ) : (
                <BookmarkPlus className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="truncate">{inLibrary ? 'In Library' : 'Add to Library'}</span>
        </button>
    );
};
