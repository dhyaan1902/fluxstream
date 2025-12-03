

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Hero } from './components/Hero';
import { MediaCard } from './components/MediaCard';
import { DetailsView } from './components/DetailsView';
import { AnimeDetailsView } from './components/AnimeDetailsView';
import { SeriesDetailsView } from './components/SeriesDetailsView';
import { ViewState, MediaType, MediaItem } from './types';
import { fetchTrendingMedia, searchMedia } from './services/geminiService';
import { Loader2 } from 'lucide-react';
import { useTVNavigation } from './hooks/useTVNavigation';

const App: React.FC = () => {
  // Enable TV remote navigation
  useTVNavigation();

  const [currentView, setCurrentView] = useState<ViewState>('HOME');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Initial Load
  useEffect(() => {
    loadContent('HOME');
  }, []);

  const loadContent = async (view: ViewState, query?: string) => {
    setLoading(true);
    let items: MediaItem[] = [];

    if (view === 'HOME') {
      items = await fetchTrendingMedia('ALL');
    } else if (view === 'MOVIES') {
      items = await fetchTrendingMedia(MediaType.MOVIE);
    } else if (view === 'SERIES') {
      // Mapping Series to Anime/Movies Mix for now as no public series API is safe
      items = await fetchTrendingMedia(MediaType.SERIES);
    } else if (view === 'ANIME') {
      items = await fetchTrendingMedia(MediaType.ANIME);
    } else if (view === 'SEARCH' && query) {
      items = await searchMedia(query);
    }

    setMediaItems(items);
    setLoading(false);
  };

  const handleNavigate = (view: ViewState) => {
    setCurrentView(view);
    setSearchQuery('');
    loadContent(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    setCurrentView('SEARCH');
    setSearchQuery(query);
    loadContent('SEARCH', query);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500/30">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onSearch={handleSearch}
      />

      {currentView === 'HOME' && !searchQuery && <Hero />}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-white flex items-center">
            {currentView === 'SEARCH' ? (
              <>Search Results for "<span className="text-cyan-400">{searchQuery}</span>"</>
            ) : (
              <>
                <span className="w-2 h-8 bg-cyan-500 rounded-full mr-3"></span>
                {currentView === 'HOME' ? 'Trending Now' :
                  currentView === 'ANIME' ? 'Top Anime (MyAnimeList)' :
                    currentView === 'SERIES' ? 'Popular Series' : 'YTS Movie Catalog'}
              </>
            )}
          </h2>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-64">
            <Loader2 className="h-12 w-12 text-cyan-500 animate-spin mb-4" />
            <p className="text-slate-400 animate-pulse">Syncing with Decentralized Network...</p>
          </div>
        ) : (
          <>
            {mediaItems.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-xl text-slate-500">No results found. Try a different search.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                {mediaItems.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    onClick={setSelectedItem}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-500 mb-4">FluxStream Project. Data provided by YTS.mx & Jikan API.</p>
          <div className="flex justify-center space-x-6 text-sm text-slate-600">
            <a href="#" className="hover:text-cyan-400 transition-colors">DMCA</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Terms</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a>
            <a href="#" className="hover:text-cyan-400 transition-colors">API</a>
          </div>
        </div>
      </footer>

      {/* Detail Modal */}
      {selectedItem && (
        selectedItem.type === MediaType.ANIME ? (
          <AnimeDetailsView
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        ) : selectedItem.type === MediaType.SERIES ? (
          <SeriesDetailsView
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        ) : (
          <DetailsView
            item={selectedItem}
            onClose={() => setSelectedItem(null)}
          />
        )
      )}
    </div>
  );
};

export default App;
