import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';

export type Theme = 'light' | 'dark';

export type ThemeToggleEvent =
  | React.MouseEvent<HTMLElement>
  | MouseEvent
  | { clientX: number; clientY: number }
  | undefined;

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (event?: ThemeToggleEvent) => void;
  setTheme: (theme: Theme, event?: ThemeToggleEvent) => void;
  isTransitioning: boolean;
}

const THEME_STORAGE_KEY = 'rento_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      if (
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: light)').matches
      ) {
        return 'light';
      }
    } catch {
      // Fallback
    }
    return 'dark';
  });

  const [isTransitioning, setIsTransitioning] = useState(false);
  const isTransitioningRef = useRef(false);

  const applyThemeToDOM = (newTheme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;

    if (newTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      if (body) {
        body.classList.add('dark');
        body.classList.remove('light');
      }
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      if (body) {
        body.classList.remove('dark');
        body.classList.add('light');
      }
    }
  };

  useEffect(() => {
    applyThemeToDOM(theme);
  }, []);

  const getRevealOrigin = (event?: ThemeToggleEvent): { x: number; y: number } => {
    if (event && 'clientX' in event && typeof event.clientX === 'number' && event.clientX > 0) {
      return { x: event.clientX, y: event.clientY };
    }

    if (typeof document !== 'undefined') {
      const toggleEl = document.querySelector('[data-theme-toggle]');
      if (toggleEl) {
        const rect = toggleEl.getBoundingClientRect();
        return {
          x: Math.round(rect.left + rect.width / 2),
          y: Math.round(rect.top + rect.height / 2),
        };
      }
    }

    if (typeof window !== 'undefined') {
      return {
        x: Math.round(window.innerWidth - 60),
        y: 40,
      };
    }

    return { x: 0, y: 0 };
  };

  const executeThemeTransition = async (nextTheme: Theme, event?: ThemeToggleEvent) => {
    if (nextTheme === theme) return;

    // Prevent multiple rapid clicks from starting competing transitions
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsTransitioning(true);

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const doc = document as unknown as {
      startViewTransition?: (callback: () => Promise<void> | void) => {
        ready: Promise<void>;
        finished: Promise<void>;
        skipTransition: () => void;
      };
    };

    const hasViewTransitions = typeof doc.startViewTransition === 'function' && !prefersReducedMotion;

    if (!hasViewTransitions) {
      // CSS Fallback for browsers without View Transitions or with prefers-reduced-motion
      try {
        const root = document.documentElement;
        if (!prefersReducedMotion) {
          root.classList.add('theme-fallback-transitioning');
        }

        setThemeState(nextTheme);
        applyThemeToDOM(nextTheme);
        try {
          localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          // ignore
        }

        if (!prefersReducedMotion) {
          window.setTimeout(() => {
            root.classList.remove('theme-fallback-transitioning');
            isTransitioningRef.current = false;
            setIsTransitioning(false);
          }, 450);
        } else {
          isTransitioningRef.current = false;
          setIsTransitioning(false);
        }
      } catch {
        isTransitioningRef.current = false;
        setIsTransitioning(false);
      }
      return;
    }

    // View Transitions API path (Chromium, Edge, Safari 18+)
    const { x, y } = getRevealOrigin(event);
    const endRadius = Math.ceil(
      Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      )
    ) + 30;

    const root = document.documentElement;
    root.style.setProperty('--theme-origin-x', `${x}px`);
    root.style.setProperty('--theme-origin-y', `${y}px`);
    root.style.setProperty('--theme-end-radius', `${endRadius}px`);

    // Safety timeout to guarantee cleanup even if animation is cancelled
    const safetyTimer = window.setTimeout(() => {
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }, 900);

    try {
      const transition = doc.startViewTransition!(() => {
        flushSync(() => {
          setThemeState(nextTheme);
        });
        applyThemeToDOM(nextTheme);
      });

      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch {
        // storage unavailable
      }

      await transition.ready;

      // Animate the incoming theme (::view-transition-new(root))
      // 1. Softened blur & slight zoom at reveal start
      // 2. Sweeping circular/diagonal reveal outward from the toggle origin
      // 3. Smooth unblur & settling to crisp 1.0 scale
      try {
        document.documentElement.animate(
          [
            {
              clipPath: `circle(0px at ${x}px ${y}px)`,
              filter: 'blur(7px)',
              transform: 'scale(1.008)',
            },
            {
              clipPath: `circle(${Math.round(endRadius * 0.55)}px at ${x}px ${y}px)`,
              filter: 'blur(4px)',
              transform: 'scale(1.004)',
              offset: 0.55,
            },
            {
              clipPath: `circle(${endRadius}px at ${x}px ${y}px)`,
              filter: 'blur(1.2px)',
              transform: 'scale(1.001)',
              offset: 0.82,
            },
            {
              clipPath: `circle(${endRadius}px at ${x}px ${y}px)`,
              filter: 'blur(0px)',
              transform: 'scale(1)',
              offset: 1,
            },
          ],
          {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-new(root)',
            fill: 'forwards',
          } as KeyframeAnimationOptions
        );

        // Animate the outgoing theme (::view-transition-old(root))
        // Subtle softening and scale down as the incoming theme sweeps over it
        document.documentElement.animate(
          [
            {
              filter: 'blur(0px)',
              transform: 'scale(1)',
              opacity: 1,
            },
            {
              filter: 'blur(3px)',
              transform: 'scale(0.996)',
              opacity: 0.96,
              offset: 0.3,
            },
            {
              filter: 'blur(5px)',
              transform: 'scale(0.992)',
              opacity: 0.92,
              offset: 1,
            },
          ],
          {
            duration: 650,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            pseudoElement: '::view-transition-old(root)',
            fill: 'forwards',
          } as KeyframeAnimationOptions
        );
      } catch {
        // Browser may not support Web Animations on pseudo-elements; CSS keyframes handle fallback
      }

      await transition.finished;
    } catch {
      // Transition interrupted or skipped
    } finally {
      window.clearTimeout(safetyTimer);
      isTransitioningRef.current = false;
      setIsTransitioning(false);
    }
  };

  const setTheme = (newTheme: Theme, event?: ThemeToggleEvent) => {
    executeThemeTransition(newTheme, event);
  };

  const toggleTheme = (event?: ThemeToggleEvent) => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    executeThemeTransition(nextTheme, event);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

