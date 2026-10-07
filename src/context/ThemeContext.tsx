import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
} from 'react';
import { flushSync } from 'react-dom';

export type AppTheme = 'dark' | 'light';

interface ThemeContextType {
  /** The theme the user picked (what the toggle shows). */
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
  /** Effective look right now: true in light theme AND while printing. */
  isLight: boolean;
  /** True only between the browser's beforeprint and afterprint events. */
  isPrinting: boolean;
}

const STORAGE_KEY = 'pe_studio_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readSavedTheme(): AppTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    /* storage unavailable (private mode etc.) – fall back to dark */
  }
  return 'dark';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(readSavedTheme);
  const [isPrinting, setIsPrinting] = useState(false);

  const setTheme = useCallback((newTheme: AppTheme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Printing always uses the light shades (saves ink, reads well on paper).
  // flushSync makes React re-render – and the oscilloscope canvas redraw – BEFORE
  // the browser lays out the page for printing.
  useEffect(() => {
    const before = () => flushSync(() => setIsPrinting(true));
    const after = () => setIsPrinting(false);
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  const isLight = theme === 'light' || isPrinting;

  // Layout effect: the class flips before children's (passive) canvas-draw effects run,
  // so canvas code always reads the colours of the theme it is drawing for.
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('theme-light', isLight);
    root.classList.toggle('dark', !isLight);

    // Mobile browser chrome follows the page background.
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    const bg = getComputedStyle(root).getPropertyValue('--color-slate-950').trim();
    if (bg) meta.content = bg;
  }, [isLight]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, isLight, isPrinting }}>
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

/**
 * Reads a palette colour (the same CSS variables Tailwind uses) as a hex string,
 * for <canvas> drawing where `var(--…)` is not understood.
 *
 *   const tc = useThemeColor();
 *   ctx.fillStyle = tc('sky-400');
 *
 * Call `tc` lazily (inside the draw function), not during render, so it sees the
 * colours of the theme that is actually on screen. The returned function changes
 * identity when the theme changes, so it can be listed in hook dependency arrays
 * to trigger a redraw.
 */
export function useThemeColor(): (token: string) => string {
  const { isLight } = useTheme();
  return useCallback(
    (token: string) => {
      void isLight; // dependency only – forces a new function (and a redraw) per theme
      const value = getComputedStyle(document.documentElement)
        .getPropertyValue(`--color-${token}`)
        .trim();
      return value || '#ff00ff'; // loud magenta = unknown token, easy to spot
    },
    [isLight],
  );
}

/** '#rrggbb' + alpha → 'rgba(r, g, b, a)' (for translucent canvas fills). */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
