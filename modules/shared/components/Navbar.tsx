import React, { useState } from 'react';
import { Search, Film, Tv, Clapperboard } from 'lucide-react';
import { ViewState } from '../types';

interface NavbarProps {
  currentView: ViewState;
  onNavigate: (view: ViewState) => void;
  onSearch: (query: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery);
    }
  };

  const navItemClass = (view: ViewState) =>
    `flex items-center space-x-2 px-4 py-2 rounded-md transition-all ${currentView === view
      ? 'bg-blue-600 text-white'
      : 'text-gray-400 hover:text-white hover:bg-gray-800'
    }`;

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black border-b border-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <div
            tabIndex={0}
            className="flex-shrink-0 flex items-center cursor-pointer"
            onClick={() => onNavigate('HOME')}
          >
            <img src="/logo.png" alt="FluxStream" className="h-8 w-8" />
            <span className="ml-3 text-xl font-bold text-white tracking-tight">
              FluxStream
            </span>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-2">
            <button onClick={() => onNavigate('HOME')} className={navItemClass('HOME')}>
              <span>Home</span>
            </button>
            <button onClick={() => onNavigate('MOVIES')} className={navItemClass('MOVIES')}>
              <Clapperboard className="h-4 w-4" />
              <span>Movies</span>
            </button>
            <button onClick={() => onNavigate('SERIES')} className={navItemClass('SERIES')}>
              <Tv className="h-4 w-4" />
              <span>Series</span>
            </button>
            <button onClick={() => onNavigate('ANIME')} className={navItemClass('ANIME')}>
              <Film className="h-4 w-4" />
              <span>Anime</span>
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-48 sm:w-64 bg-gray-900 border border-gray-800 text-white text-sm rounded-md pl-10 pr-4 py-2 focus:outline-none focus:border-blue-600 transition-all placeholder-gray-500"
              />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            </form>
          </div>
        </div>
      </div>
    </nav>
  );
};
