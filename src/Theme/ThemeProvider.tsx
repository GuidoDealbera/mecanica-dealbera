import React, { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_THEME,
  STORAGE_KEY,
  ThemeContext,
  ThemeName,
} from "./themeContext";

const readStoredTheme = (): ThemeName => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* localStorage puede no estar disponible: se usa el default */
  }
  return DEFAULT_THEME;
};

// Aplica el tema como clase en <html> (HeroUI lee el tema de ahí) y setea el
// color-scheme para que los controles nativos (scrollbars, inputs) acompañen.
const applyTheme = (theme: ThemeName): void => {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.style.colorScheme = theme;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<ThemeName>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* si no se puede persistir, el tema igual queda aplicado en memoria */
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => setThemeState(next), []);
  const toggleTheme = useCallback(
    () => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
    []
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
