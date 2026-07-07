import React, { createContext, useContext, useEffect } from 'react';

// Admin panel uses dark theme always (Control Room v2.6).
// Provider kept for API compatibility — `theme` is always 'dark'.
const ThemeContext = createContext({ theme: 'dark', toggle: () => {}, setTheme: () => {} });

export function ThemeProvider({ children }) {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.style.colorScheme = 'dark';
  }, []);

  const value = { theme: 'dark', toggle: () => {}, setTheme: () => {} };
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
