import React from 'react';

interface InstantPlayerProps {
    magnet: string;
    title?: string;
}

export const InstantPlayer: React.FC<InstantPlayerProps> = ({ magnet, title }) => {
    // InstantIO URL format: https://instant.io/#<magnet>
    const encodedMagnet = encodeURIComponent(magnet);
    const instantUrl = `https://instant.io/#${encodedMagnet}`;

    return (
        <div className="w-full h-full bg-black rounded-xl overflow-hidden relative">
            <iframe
                src={instantUrl}
                className="w-full h-full"
                allowFullScreen
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                referrerPolicy="no-referrer"
                sandbox="allow-scripts allow-same-origin allow-forms"
                title={title || 'Instant.io Player'}
            />
        </div>
    );
};
