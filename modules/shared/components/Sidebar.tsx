import React, { useState, useEffect } from 'react';
import { Home, Film, Tv, Sparkles, Download, Settings, Library, TrendingUp, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface SidebarProps {
    currentView: string;
    onNavigate: (view: string) => void;
    mobileMenuOpen?: boolean;
}

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);

        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    return isMobile;
};

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, mobileMenuOpen }) => {
    const navItems = [
        { id: 'DASHBOARD', label: 'Dashboard', icon: TrendingUp },
        { id: 'LIBRARY', label: 'Library', icon: Library }, // Moved Library here
        { id: 'HOME', label: 'Discover', icon: Home },
        { id: 'MOVIES', label: 'Movies', icon: Film },
        { id: 'SERIES', label: 'Series', icon: Tv },
        { id: 'ANIME', label: 'Anime', icon: Sparkles },
        { id: 'DOWNLOADS', label: 'Downloads', icon: Download },
        { id: 'HISTORY', label: 'History', icon: Clock },
    ];

    const isMobile = useIsMobile();

    // Determine sidebar position
    // On desktop: always visible (x: 0)
    // On mobile: visible only if menu is open (x: 0), otherwise hidden (x: -100%)
    // But we need to handle the initial render and transitions correctly.
    // If it's desktop, x is always 0.
    // If it's mobile, x depends on mobileMenuOpen.

    const sidebarVariants = {
        open: { x: 0 },
        closed: { x: '-110%' }
    };

    return (
        <motion.aside
            initial={false}
            animate={!isMobile || mobileMenuOpen ? "open" : "closed"}
            variants={sidebarVariants}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className={`fixed left-0 top-0 h-screen w-64 glass-panel border-r border-white/10 flex flex-col z-50 lg:translate-x-0`}
            style={{
                background: 'rgba(15, 23, 42, 0.95)', // Increased opacity for mobile readability
                backdropFilter: 'blur(20px)',
            }}
        >
            {/* Logo */}
            <div className="p-6 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <img
                        src="/Logo.svg"
                        alt="FluxStream Logo"
                        className="w-10 h-10 rounded-xl shadow-glow"
                    />
                    <div>
                        <h1 className="text-xl font-bold gradient-text">FluxStream</h1>
                        <p className="text-xs text-slate-400">Local Edition</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                            <motion.button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                whileHover={{ x: 4 }}
                                whileTap={{ scale: 0.98 }}
                                className={`
                                    w-full flex items-center gap-3 px-4 py-3 rounded-xl
                                    transition-all duration-200 group relative overflow-hidden
                                    ${isActive
                                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 shadow-glow'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                                    }
                                `}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNav"
                                        className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-xl"
                                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                                <Icon className={`w-5 h-5 relative z-10 ${isActive ? 'text-cyan-400' : ''}`} />
                                <span className="font-medium relative z-10">{item.label}</span>
                                {isActive && (
                                    <div className="ml-auto w-2 h-2 rounded-full bg-cyan-400 shadow-glow relative z-10" />
                                )}
                            </motion.button>
                        );
                    })}
                </div>
            </nav>

            {/* Settings */}
            <div className="p-4 border-t border-white/10">
                <motion.button
                    onClick={() => onNavigate('SETTINGS')}
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
                >
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">Settings</span>
                </motion.button>

                {/* Storage Info */}
                <div className="mt-4 p-3 rounded-lg bg-white/5 border border-white/10">
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                        <span>Cache Usage</span>
                        <span className="text-cyan-400 font-semibold">0%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '0%' }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-600"
                        />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">0 GB / 4 GB</p>
                </div>
            </div>
        </motion.aside>
    );
};
