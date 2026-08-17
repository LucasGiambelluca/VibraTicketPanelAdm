import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Tema del panel: dark ("control room") por defecto, claro opcional.
// Todo el sistema visual vive en tokens (theme.css) + antd (main.jsx lee este
// contexto), así que el toggle cambia el panel entero de una.
const STORAGE_KEY = 'vibra-admin-theme';

const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} });

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* storage lleno/bloqueado: el tema igual aplica */ }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(next === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
