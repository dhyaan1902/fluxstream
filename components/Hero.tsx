import React from 'react';
import { Play, Info } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="relative h-[60vh] w-full overflow-hidden bg-black">
      {/* Simple dark overlay instead of image */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black"></div>

      <div className="relative z-10 h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end pb-16">
        <span className="inline-block py-1 px-3 rounded-md bg-blue-600 text-white text-xs font-bold tracking-wider mb-4 w-fit">
          TRENDING
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold text-white mb-4 tracking-tight">
          Decentralized Streaming
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mb-8">
          Stream movies, series, and anime from multiple sources. P2P streaming, cloud embeds, and Stremio addons all in one place.
        </p>

        <div className="flex space-x-4">
          <button tabIndex={0} className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-md font-bold transition-all">
            <Play className="h-5 w-5 fill-current" />
            <span>Explore Catalog</span>
          </button>
          <button tabIndex={0} className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 px-6 py-3 rounded-md font-semibold transition-all">
            <Info className="h-5 w-5" />
            <span>Learn More</span>
          </button>
        </div>
      </div>
    </div>
  );
};
