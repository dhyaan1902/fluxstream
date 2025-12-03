import React, { useEffect, useRef } from 'react';

interface WebtorPlayerProps {
    magnet: string;
    poster?: string;
    title?: string;
    imdbId?: string;
}

declare global {
    interface Window {
        webtor: any[];
    }
}

export const WebtorPlayer: React.FC<WebtorPlayerProps> = ({ magnet, poster, title, imdbId }) => {
    const playerId = useRef('webtor-' + Math.random().toString(36).substr(2, 9));

    useEffect(() => {
        // Initialize webtor queue if not exists
        window.webtor = window.webtor || [];

        // Push configuration to queue (official pattern from docs)
        window.webtor.push({
            id: playerId.current,
            magnet: magnet,
            poster: poster,
            title: title,
            imdbId: imdbId,
            width: '100%',
            height: '100%',
            header: true,
            controls: true,
        });
    }, [magnet, poster, title, imdbId]);

    return (
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative" style={{ minHeight: '400px' }}>
            <div id={playerId.current} style={{ width: '100%', height: '100%', minHeight: '400px' }} />
        </div>
    );
};
