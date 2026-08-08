import { createContext, useContext } from "react";

export type ThemeName = "light" | "dark";

// Clave de persistencia (preferencia de UI por máquina) y tema por defecto.
// El default es "dark" para conservar el look histórico de la aplicación.
// Debe coincidir con el script anti-FOUC de index.html.
export const STORAGE_KEY = "app-theme";
export const DEFAULT_THEME: ThemeName = "dark";

export interface ThemeContextValue {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
);

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  }
  return ctx;
};
