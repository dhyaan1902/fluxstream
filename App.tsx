import React, { useState, useEffect } from 'react';
import { Sidebar } from './modules/shared/components/Sidebar';
import { BottomNavigation } from './modules/shared/components/BottomNavigation';
import { Dashboard } from './modules/shared/components/Dashboard';
import { Hero, MediaCard, DownloadsPanel } from './modules/shared/components'; // Keep Hero, MediaCard, DownloadsPanel
import { LibraryView } from './modules/library/LibraryView';
import { MovieDetailsView } from './modules/movie/components/MovieDetailsView';
import { AnimeDetailsView } from './modules/anime/components/AnimeDetailsView';
import { SeriesDetailsView } from './modules/series/components/SeriesDetailsView';
import { ViewState, MediaType, MediaItem } from './types';
import { fetchTrendingMedia, searchMedia } from './services/geminiService';
import { Loader2, Search } from 'lucide-react';
import { useTVNavigation } from './hooks/useTVNavigation';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const App: React.FC = () => {
  // Mobile check
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enable TV remote navigation
  useTVNavigation();

  const [currentView, setCurrentView] = useState<ViewState>('DASHBOARD');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrl: true,
      action: () => {
        const searchInput = document.getElementById('global-search') as HTMLInputElement;
        searchInput?.focus();
      },
      description: 'Focus search'
    },
    {
      key: '1',
      ctrl: true,
      action: () => handleNavigate('DASHBOARD'),
      description: 'Go to Dashboard'
    },
    {
      key: '2',
      ctrl: true,
      action: () => handleNavigate('HOME'),
      description: 'Go to Discover'
    },
    {
      key: '3',
      ctrl: true,
      action: () => handleNavigate('MOVIES'),
      description: 'Go to Movies'
    },
    {
      key: '4',
      ctrl: true,
      action: () => handleNavigate('ANIME'),
      description: 'Go to Anime'
    },
  ]);

  // Initial Load
  useEffect(() => {
    if (currentView !== 'DASHBOARD' && currentView !== 'DOWNLOADS' && currentView !== 'HISTORY' && currentView !== 'LIBRARY' && currentView !== 'SETTINGS') {
      loadContent(currentView);
    }
  }, [currentView]);

  const loadContent = async (view: ViewState, query?: string) => {
    setLoading(true);
    let items: MediaItem[] = [];

    if (view === 'HOME') {
      items = await fetchTrendingMedia('ALL');
    } else if (view === 'MOVIES') {
      items = await fetchTrendingMedia(MediaType.MOVIE);
    } else if (view === 'SERIES') {
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
    if (view !== 'DASHBOARD' && view !== 'DOWNLOADS' && view !== 'HISTORY' && view !== 'LIBRARY' && view !== 'SETTINGS') {
      loadContent(view);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    setCurrentView('SEARCH');
    setSearchQuery(query);
    loadContent('SEARCH', query);
  };

  const renderContent = () => {
    if (currentView === 'DASHBOARD') {
      return <Dashboard onSelectMedia={setSelectedItem} />;
    }

    if (currentView === 'LIBRARY') {
      return <LibraryView />;
    }

    if (currentView === 'DOWNLOADS') {
      return <DownloadsPanel />;
    }

    if (currentView === 'HISTORY' || currentView === 'SETTINGS') {
      return (
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-slate-400 mb-2">Coming Soon</h2>
          <p className="text-slate-500">This feature is under development</p>
        </div>
      );
    }

    return (
      <>
        {currentView === 'HOME' && !searchQuery && <Hero />}

        <div className="mb-8">
          {isMobile && currentView === 'SEARCH' && (
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="What do you want to watch?"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (e.target.value.trim()) {
                      handleSearch(e.target.value);
                    }
                  }}
                  className="w-full pl-12 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-base shadow-lg"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center">
              {currentView === 'SEARCH' ? (
                searchQuery ? <>Search Results for "<span className="text-cyan-400">{searchQuery}</span>"</> : 'Search'
              ) : (
                <>
                  <span className="w-2 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 rounded-full mr-3"></span>
                  {currentView === 'HOME' ? 'Trending Now' :
                    currentView === 'ANIME' ? 'Top Anime (MyAnimeList)' :
                      currentView === 'SERIES' ? 'Popular Series' : 'YTS Movie Catalog'}
                </>
              )}
            </h2>
          </div>
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
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgba(30, 41, 59, 0.9)',
            color: '#f1f5f9',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
          },
          success: {
            iconTheme: {
              primary: '#06b6d4',
              secondary: '#f1f5f9',
            },
          },
        }}
      />

      {/* Mobile Menu Button - Removed in favor of Bottom Nav */}
      {/* <button ... /> */}

      {/* Mobile Overlay - Removed/Unused with Bottom Nav usually, but can keep if Sidebar is still used for settings? 
          Actually, let's keep Sidebar for non-mobile, or maybe strictly hide it on mobile now.
      */}

      {!isMobile && (
        <Sidebar
          currentView={currentView}
          onNavigate={(view) => handleNavigate(view as ViewState)}
        />
      )}

      {isMobile && (
        <BottomNavigation
          currentView={currentView}
          onNavigate={(view) => handleNavigate(view as ViewState)}
        />
      )}

      {/* Main Content */}
      <div className={`${isMobile ? 'pb-24' : 'lg:ml-64'} min-h-screen transition-all duration-300`}>
        {/* Top Bar */}
        <div className="sticky top-0 z-40 glass-panel border-b border-white/10 px-4 lg:px-8 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-2 lg:gap-4">
            <div className="flex-1 max-w-full lg:max-w-2xl">
              {!isMobile && (
                <div className={`relative transition-all duration-300 ${searchFocused ? 'scale-105' : ''}`}>
                  <Search className="absolute left-3 lg:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 lg:w-5 lg:h-5 text-slate-400" />
                  <input
                    id="global-search"
                    type="text"
                    placeholder="Search movies, series, anime..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (e.target.value.trim()) {
                        handleSearch(e.target.value);
                      }
                    }}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                    className="w-full pl-10 lg:pl-12 pr-4 py-2.5 lg:py-3 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm lg:text-base"
                  />
                </div>
              )}
              {isMobile && (
                <div className="flex items-center gap-2">
                  <img src="/Logo.svg" alt="FluxStream" className="w-8 h-8 rounded-lg" />
                  <span className="font-bold text-lg gradient-text">FluxStream</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-4 ml-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-glow cursor-pointer hover:scale-110 transition-transform">
                <span className="text-white font-bold text-sm">U</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-4 lg:px-8 py-4 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <footer className="glass-panel border-t border-white/10 py-8 mt-12 mx-8 mb-8 rounded-xl">
          <div className="text-center">
            <p className="text-slate-500 mb-4">FluxStream Local Edition. Data provided by YTS.mx & Jikan API.</p>
            <div className="flex justify-center space-x-6 text-sm text-slate-600">
              <a href="#" className="hover:text-cyan-400 transition-colors">DMCA</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">Terms</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a>
              <a href="#" className="hover:text-cyan-400 transition-colors">API</a>
            </div>
          </div>
        </footer>
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
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
            <MovieDetailsView
              item={selectedItem}
              onClose={() => setSelectedItem(null)}
            />
          )
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
