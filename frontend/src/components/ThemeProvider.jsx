import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const normalize = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';
const readTheme = () => {
  if (typeof window === 'undefined') return 'system';
  try { return normalize(window.localStorage.getItem('theme')); } catch { return 'system'; }
};

function useThemeState(enabled) {
  const [theme, updateTheme] = useState(readTheme);
  const [resolvedTheme, setResolvedTheme] = useState('light');
  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;
    let media;
    try { media = window.matchMedia?.('(prefers-color-scheme: dark)'); } catch { /* Older/embedded browsers. */ }
    const apply = () => {
      const resolved = theme === 'system' ? (media?.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = resolved;
      // Shared Tailwind variants and legacy tokens must resolve the same theme.
      document.documentElement.classList.toggle('dark', resolved === 'dark');
      setResolvedTheme(resolved);
    };
    apply();
    try { window.localStorage.setItem('theme', theme); } catch { /* Storage may be unavailable. */ }
    if (media?.addEventListener) media.addEventListener('change', apply);
    else media?.addListener?.(apply);
    const storageChanged = event => {
      if (event.key === 'theme' || event.key === null) updateTheme(normalize(event.newValue));
    };
    window.addEventListener('storage', storageChanged);
    return () => {
      if (media?.removeEventListener) media.removeEventListener('change', apply);
      else media?.removeListener?.(apply);
      window.removeEventListener('storage', storageChanged);
    };
  }, [theme, enabled]);
  return { theme, resolvedTheme, setTheme: value => updateTheme(normalize(value)) };
}

export default function ThemeProvider({ children }) {
  const value = useThemeState(true);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  // Standalone selectors remain usable; inside the app only the provider listens.
  const fallback = useThemeState(!context);
  return context || fallback;
}
