import React from 'react';
import { Star, PlayCircle } from 'lucide-react';
import { MediaItem } from '../types';

interface MediaCardProps {
  item: MediaItem;
  onClick: (item: MediaItem) => void;
}

export const MediaCard: React.FC<MediaCardProps> = ({ item, onClick }) => {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClick(item);
    }
  };

  return (
    <div
      tabIndex={0}
      className="group relative bg-gray-900 rounded-md overflow-hidden cursor-pointer transition-all duration-200 active:scale-95 lg:hover:-translate-y-1 border border-gray-800 lg:hover:border-blue-600"
      onClick={() => onClick(item)}
      onKeyDown={handleKeyPress}
    >
      <div className="aspect-[2/3] w-full relative overflow-hidden bg-gray-950">
        <img
          src={item.posterUrl || 'https://via.placeholder.com/300x450/000000/333333?text=No+Poster'}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-300 lg:group-hover:scale-105"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300x450/000000/333333?text=No+Poster';
          }}
        />

        {/* Hover Overlay - Desktop Only */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200 bg-black/60">
          <PlayCircle className="h-16 w-16 text-white" />
        </div>

        <div className="absolute top-2 right-2 bg-black/80 px-2 py-1 rounded-md flex items-center space-x-1">
          <Star className="h-3 w-3 text-yellow-400 fill-current" />
          <span className="text-xs font-bold text-white">{item.rating > 0 ? item.rating.toFixed(1) : 'N/A'}</span>
        </div>
      </div>

      <div className="p-4">
        <h3 className="text-white font-semibold truncate" title={item.title}>{item.title}</h3>
        <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
          <span>{item.year}</span>
          <span className="border border-gray-800 px-1.5 py-0.5 rounded uppercase">{item.type}</span>
        </div>
      </div>
    </div>
  );
};