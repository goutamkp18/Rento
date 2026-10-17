import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', showLabel = false }) => {
  const { theme, toggleTheme, isTransitioning } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      data-theme-toggle
      disabled={isTransitioning}
      onClick={(e) => toggleTheme(e)}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className={`relative inline-flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-brand-500/50 active:scale-90 group cursor-pointer ${
        isTransitioning ? 'pointer-events-none' : ''
      } ${
        isDark
          ? 'bg-navy-900/80 text-amber-300 hover:text-amber-200 border-white/[0.08] hover:border-white/[0.16] shadow-sm hover:shadow-glow'
          : 'bg-white/80 text-slate-700 hover:text-slate-900 border-black/[0.08] hover:border-black/[0.16] shadow-sm'
      } ${className}`}
    >
      <div className="relative w-4 h-4 flex items-center justify-center overflow-hidden">
        <Sun
          className={`w-4 h-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${
            isDark
              ? 'rotate-0 scale-100 opacity-100 text-amber-300'
              : '-rotate-90 scale-0 opacity-0 absolute pointer-events-none'
          }`}
        />
        <Moon
          className={`w-4 h-4 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${
            isDark
              ? 'rotate-90 scale-0 opacity-0 absolute pointer-events-none'
              : 'rotate-0 scale-100 opacity-100 text-slate-700'
          }`}
        />
      </div>

      {showLabel && (
        <span className="text-xs font-semibold select-none transition-colors duration-300">
          {isDark ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};

