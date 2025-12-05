import React from 'react';
import { Home, Search, Library, Download, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface BottomNavigationProps {
    currentView: string;
    onNavigate: (view: string) => void;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentView, onNavigate }) => {
    const navItems = [
        { id: 'HOME', label: 'Home', icon: Home },
        { id: 'SEARCH', label: 'Search', icon: Search },
        { id: 'LIBRARY', label: 'Library', icon: Library },
        { id: 'DOWNLOADS', label: 'Downloads', icon: Download },
        { id: 'DASHBOARD', label: 'Stats', icon: TrendingUp },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[60] lg:hidden bg-slate-950/80 backdrop-blur-xl border-t border-white/10 pb-safe">
            <div className="flex justify-around items-center px-2 py-3">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;

                    return (
                        <button
                            key={item.id}
                            onClick={() => onNavigate(item.id)}
                            className={`flex flex-col items-center justify-center p-2 min-w-[64px] rounded-xl transition-all duration-200 ${isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <div className={`relative p-1.5 rounded-lg ${isActive ? 'bg-cyan-500/10' : ''}`}>
                                <Icon className={`w-6 h-6 ${isActive ? 'fill-current opacity-20' : ''}`} />
                                <Icon className="w-6 h-6 absolute top-1.5 left-1.5" />
                                {isActive && (
                                    <motion.div
                                        layoutId="bottomNavDot"
                                        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-cyan-400 rounded-full"
                                    />
                                )}
                            </div>
                            <span className="text-[10px] font-medium mt-1">{item.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
